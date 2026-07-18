package com.foodmap.user.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OtpServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private ValueOperations<String, String> valueOps;

    @InjectMocks
    private OtpService otpService;

    @Test
    void sendOtp_ShouldSaveToRedisAndSendEmail() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        otpService.sendOtp("test@example.com");

        verify(valueOps).set(eq("otp_test@example.com"), anyString(), any());
        verify(mailSender).send(any(SimpleMailMessage.class));
    }

    @Test
    void verifyOtp_ShouldReturnTrue_WhenOtpMatches() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("otp_test@example.com")).thenReturn("123456");

        boolean result = otpService.verifyOtp("test@example.com", "123456");

        assertThat(result).isTrue();
        verify(redisTemplate).delete("otp_test@example.com");
    }

    @Test
    void verifyOtp_ShouldReturnFalse_WhenOtpExpired() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("otp_test@example.com")).thenReturn(null);

        boolean result = otpService.verifyOtp("test@example.com", "123456");

        assertThat(result).isFalse();
    }

    @Test
    void verifyOtp_ShouldReturnFalse_WhenOtpWrong() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("otp_test@example.com")).thenReturn("654321");

        boolean result = otpService.verifyOtp("test@example.com", "123456");

        assertThat(result).isFalse();
    }
}
