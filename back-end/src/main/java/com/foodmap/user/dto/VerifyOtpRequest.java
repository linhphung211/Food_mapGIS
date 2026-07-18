package com.foodmap.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VerifyOtpRequest {

    @NotBlank
    @Email
    private String email;

    @NotBlank(message = "OTP không được để trống")
    private String otp;
}
