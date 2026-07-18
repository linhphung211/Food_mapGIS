package com.foodmap.user.dto;

import jakarta.validation.constraints.Email;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;

/** Tương đương PatchedUserProfileSerializer */
@Data
public class UpdateProfileRequest {

    @Email(message = "Email không hợp lệ.")
    private String email;

    private LocalDate birthday;

    private MultipartFile avatar;
}
