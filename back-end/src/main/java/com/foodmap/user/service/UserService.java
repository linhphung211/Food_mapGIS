package com.foodmap.user.service;

import com.foodmap.security.JwtTokenProvider;
import com.foodmap.user.dto.*;
import com.foodmap.user.entity.User;
import com.foodmap.user.entity.UserSession;
import com.foodmap.user.repository.UserRepository;
import com.foodmap.user.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserSessionRepository sessionRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final S3UploadService s3UploadService;

    // ===================================================================
    // REGISTER
    // ===================================================================
    @Transactional
    public void register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username đã tồn tại.");
        }
        if (request.getEmail() != null && userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email này đã được sử dụng.");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .birthday(request.getBirthday())
                .role(User.Role.valueOf(request.getRole() != null ? request.getRole() : "user"))
                .build();

        userRepository.save(user);
        log.info("User mới đã đăng ký: {}", user.getUsername());
    }

    // ===================================================================
    // LOGIN (Single-device session logic từ Django)
    // ===================================================================
    @Transactional
    public Map<String, Object> login(LoginRequest request, String ipAddress, String userAgent) {
        // Bước 1: Xác thực credentials
        User user = userRepository.findByUsernameOrEmail(request.getUsername())
                .orElseThrow(() -> new BadCredentialsException("Thông tin đăng nhập không chính xác"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BadCredentialsException("Thông tin đăng nhập không chính xác");
        }

        if (!user.isActive()) {
            throw new BadCredentialsException("Tài khoản đã bị vô hiệu hoá.");
        }

        String truncatedAgent = userAgent != null
                ? userAgent.substring(0, Math.min(userAgent.length(), 250))
                : "";

        // Bước 2: Kiểm tra chặn đa thiết bị
        boolean blockedByOtherDevice = sessionRepository
                .existsActiveSessionOnOtherDevice(user.getId(), truncatedAgent);

        if (blockedByOtherDevice) {
            throw new IllegalStateException(
                    "Tài khoản hiện đang được đăng nhập ở 1 thiết bị khác, vui lòng thử lại sau.");
        }

        // Bước 3: Tìm session cũ của thiết bị này
        Optional<UserSession> existingSessionOpt = sessionRepository
                .findByUserIdAndUserAgent(user.getId(), truncatedAgent);

        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user.getUsername());
        String accessToken = jwtTokenProvider.generateAccessToken(user.getUsername());
        UserSession session;
        String msg;

        LocalDateTime now = LocalDateTime.now();

        if (existingSessionOpt.isPresent() && existingSessionOpt.get().getExpiredAt().isAfter(now)) {
            // Bước 4a: Hồi sinh session cũ
            session = existingSessionOpt.get();
            session.refreshExpiry(newRefreshToken);
            sessionRepository.save(session);
            msg = "Session cũ đã được hồi sinh và gia hạn.";
        } else {
            // Bước 4b: Tạo session mới
            session = UserSession.builder()
                    .user(user)
                    .refreshToken(newRefreshToken)
                    .expiredAt(now.plusDays(7))
                    .ipAddress(ipAddress)
                    .userAgent(truncatedAgent)
                    .build();
            sessionRepository.save(session);
            msg = "Tạo phiên làm việc mới thành công.";
        }

        // Cập nhật last_login
        user.setLastLogin(now);
        userRepository.save(user);

        return Map.of(
                "access", accessToken,
                "refresh", newRefreshToken,
                "message", msg,
                "role", user.getRole().name(),
                "session_id", session.getSessionId().toString(),
                "user", UserProfileResponse.from(user)
        );
    }

    // ===================================================================
    // LOGOUT
    // ===================================================================
    @Transactional
    public void logout(UUID sessionId) {
        sessionRepository.deleteById(sessionId);
        log.info("Session {} đã bị xoá (logout).", sessionId);
    }

    // ===================================================================
    // ME — Lấy thông tin cá nhân + kiểm tra session
    // ===================================================================
    @Transactional
    public UserProfileResponse getMe(String username, String userAgent) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User không tồn tại"));

        String truncatedAgent = userAgent != null
                ? userAgent.substring(0, Math.min(userAgent.length(), 250))
                : "";

        UserSession session = sessionRepository
                .findByUserIdAndUserAgent(user.getId(), truncatedAgent)
                .orElseThrow(() -> new SecurityException("Phiên làm việc không tồn tại hoặc hết hạn"));

        if (session.isRevoked()) {
            throw new SecurityException("Phiên làm việc đã bị vô hiệu hóa hoặc hết hạn");
        }

        // Gia hạn session
        session.refreshExpiry(null);
        sessionRepository.save(session);

        return UserProfileResponse.from(user);
    }

    // ===================================================================
    // UPDATE PROFILE
    // ===================================================================
    @Transactional
    public UserProfileResponse updateProfile(String username, UpdateProfileRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User không tồn tại"));

        if (request.getEmail() != null) {
            // Kiểm tra email trùng
            userRepository.findByEmail(request.getEmail())
                    .filter(u -> !u.getId().equals(user.getId()))
                    .ifPresent(u -> { throw new IllegalArgumentException("Email này đã được sử dụng."); });
            user.setEmail(request.getEmail());
        }

        if (request.getBirthday() != null) {
            user.setBirthday(request.getBirthday());
        }

        // Upload avatar lên Supabase S3 nếu có file
        MultipartFile avatarFile = request.getAvatar();
        if (avatarFile != null && !avatarFile.isEmpty()) {
            String avatarUrl = s3UploadService.upload(avatarFile, "avatars");
            user.setAvatar(avatarUrl);
        }

        userRepository.save(user);
        return UserProfileResponse.from(user);
    }

    // ===================================================================
    // VERIFY OTP — Xác thực email sau khi OTP đúng
    // ===================================================================
    @Transactional
    public void verifyEmail(String username, String email) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User không tồn tại"));
        user.setEmail(email);
        user.setEmailVerified(true);
        userRepository.save(user);
    }
}
