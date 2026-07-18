package com.foodmap.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Map sang bảng `user` (giữ nguyên schema Django)
 */
@Entity
@Table(name = "\"user\"")   // Escape từ khóa reserved "user" trong PostgreSQL
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 150)
    private String username;

    @Column(nullable = false, length = 128)
    private String password;

    @Column(unique = true, length = 254)
    private String email;

    @Column(name = "first_name", length = 150)
    private String firstName;

    @Column(name = "last_name", length = 150)
    private String lastName;

    /** ROLE: user | merchant */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private Role role = Role.user;

    /** Đường dẫn ảnh đại diện (Supabase S3) */
    @Column(length = 500)
    private String avatar;

    private LocalDate birthday;

    @Column(name = "is_email_verified")
    @Builder.Default
    private boolean emailVerified = false;

    @Column(name = "is_active")
    @Builder.Default
    private boolean active = true;

    @Column(name = "is_staff")
    @Builder.Default
    private boolean staff = false;

    @Column(name = "is_superuser")
    @Builder.Default
    private boolean superuser = false;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    @CreationTimestamp
    @Column(name = "date_joined", updatable = false)
    private LocalDateTime dateJoined;

    /** Roles tương đương Django ROLE_CHOICES */
    public enum Role {
        user, merchant
    }
}
