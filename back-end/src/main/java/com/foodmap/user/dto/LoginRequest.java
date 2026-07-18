package com.foodmap.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Tương đương LoginRequest serializer */
@Data
public class LoginRequest {

    @NotBlank(message = "Username không được để trống")
    private String username;

    @NotBlank(message = "Password không được để trống")
    private String password;
}
