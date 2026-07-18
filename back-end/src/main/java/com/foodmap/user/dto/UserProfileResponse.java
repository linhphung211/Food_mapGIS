package com.foodmap.user.dto;

import com.foodmap.user.entity.User;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

/** Tương đương UserProfileSerializer */
@Data
@Builder
public class UserProfileResponse {
    private Long id;
    private String username;
    private String email;
    private String avatar;
    private LocalDate birthday;
    private String role;

    public static UserProfileResponse from(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .avatar(user.getAvatar())
                .birthday(user.getBirthday())
                .role(user.getRole().name())
                .build();
    }
}
