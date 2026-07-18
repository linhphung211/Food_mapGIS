package com.foodmap.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Random;

/**
 * Tương đương send_otp / verify_otp view trong Django.
 * Dùng Redis để lưu OTP tạm thời (5 phút).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OtpService {

    private static final String OTP_KEY_PREFIX = "otp_";
    private static final Duration OTP_TTL = Duration.ofMinutes(5);

    private final StringRedisTemplate redisTemplate;
    private final JavaMailSender mailSender;

    /**
     * Tạo OTP 6 số, lưu vào Redis 5 phút, gửi email.
     */
    public void sendOtp(String email) {
        String otp = String.format("%06d", new Random().nextInt(999999));

        // Lưu vào Redis: key = "otp_<email>", value = otp, TTL = 5 phút
        redisTemplate.opsForValue().set(OTP_KEY_PREFIX + email, otp, OTP_TTL);

        // Gửi email
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("Mã xác thực cho Hiệp sĩ Rùa 🐢");
        message.setText("Mã OTP của con là: " + otp + ". Mã này sẽ hết hạn sau 5 phút nhé!");
        mailSender.send(message);

        log.info("OTP đã gửi đến email: {}", email);
    }

    /**
     * Xác thực OTP nhập vào có khớp với Redis không.
     * @return true nếu hợp lệ, false nếu sai hoặc hết hạn
     */
    public boolean verifyOtp(String email, String otpInput) {
        String storedOtp = redisTemplate.opsForValue().get(OTP_KEY_PREFIX + email);

        if (storedOtp == null) {
            return false;   // Đã hết hạn hoặc không tồn tại
        }

        if (!storedOtp.equals(otpInput)) {
            return false;   // Sai OTP
        }

        // Xóa OTP sau khi dùng xong (tương đương cache.delete() Django)
        redisTemplate.delete(OTP_KEY_PREFIX + email);
        return true;
    }
}
