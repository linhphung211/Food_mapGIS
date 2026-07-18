package com.foodmap.user.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

/** Tương đương RegisterSerializer */
@Data
public class RegisterRequest {

    @NotBlank(message = "Username không được để trống")
    @Pattern(
        regexp = "^[a-zA-Z](?=.*[0-9!@#$%^&*]).*$",
        message = "Username bắt đầu bằng chữ, chứa ít nhất 1 số hoặc ký tự đặc biệt."
    )
    private String username;

    @Email(message = "Email không hợp lệ.")
    private String email;

    @NotBlank(message = "Password không được để trống")
    @Size(min = 8, message = "Password phải có ít nhất 8 ký tự")
    private String password;

    private LocalDate birthday;

    private String role = "user";  // default: user
}
