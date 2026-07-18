package com.foodmap.user.controller;

import com.foodmap.user.dto.*;
import com.foodmap.user.service.OtpService;
import com.foodmap.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Tương đương UserViewSet trong Django.
 * Tất cả routes giữ nguyên URL pattern để frontend không cần thay đổi.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "Quản lý người dùng")
public class UserController {

    private final UserService userService;
    private final OtpService otpService;

    // POST /api/users/register/
    @PostMapping("/register/")
    @Operation(summary = "Đăng ký tài khoản")
    public ResponseEntity<Map<String, String>> register(
            @Valid @RequestBody RegisterRequest request) {
        userService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("msg", "Đăng ký thành công"));
    }

    // POST /api/users/login/
    @PostMapping("/login/")
    @Operation(summary = "Đăng nhập")
    public ResponseEntity<Map<String, Object>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {

        String ipAddress = httpRequest.getRemoteAddr();
        String userAgent = httpRequest.getHeader("User-Agent");

        try {
            Map<String, Object> response = userService.login(request, ipAddress, userAgent);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // POST /api/users/logout/
    @PostMapping("/logout/")
    @Operation(summary = "Đăng xuất", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<Void> logout(@RequestBody Map<String, String> body) {
        String sessionIdStr = body.get("session_id");
        userService.logout(UUID.fromString(sessionIdStr));
        return ResponseEntity.noContent().build();
    }

    // GET /api/users/me/
    @GetMapping("/me/")
    @Operation(summary = "Lấy thông tin cá nhân", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<?> me(
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest httpRequest) {
        try {
            String userAgent = httpRequest.getHeader("User-Agent");
            UserProfileResponse profile = userService.getMe(userDetails.getUsername(), userAgent);
            return ResponseEntity.ok(profile);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // PATCH /api/users/update_profile/
    @PatchMapping("/update_profile/")
    @Operation(summary = "Cập nhật thông tin", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<?> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @ModelAttribute UpdateProfileRequest request) {
        try {
            UserProfileResponse updated = userService.updateProfile(userDetails.getUsername(), request);
            return ResponseEntity.ok(Map.of(
                    "message", "Cập nhật thông tin hiệp sĩ thành công!",
                    "data", updated
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // POST /api/users/send-otp/
    @PostMapping("/send-otp/")
    @Operation(summary = "Gửi mã OTP")
    public ResponseEntity<Map<String, String>> sendOtp(
            @Valid @RequestBody SendOtpRequest request) {
        otpService.sendOtp(request.getEmail());
        return ResponseEntity.ok(Map.of("message", "Mã OTP đã được gửi đến Email của cha mẹ!"));
    }

    // POST /api/users/verify-otp/
    @PostMapping("/verify-otp/")
    @Operation(summary = "Xác thực OTP", security = @SecurityRequirement(name = "Bearer"))
    public ResponseEntity<?> verifyOtp(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody VerifyOtpRequest request) {

        if (!otpService.verifyOtp(request.getEmail(), request.getOtp())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Mã OTP không chính xác hoặc đã hết hạn"));
        }

        userService.verifyEmail(userDetails.getUsername(), request.getEmail());
        return ResponseEntity.ok(Map.of("message", "Xác thực Email thành công! Chúc mừng hiệp sĩ!"));
    }
}
