package com.foodmap.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Map sang bảng `user_session` (giữ nguyên schema Django)
 * Dùng để track single-device login và WebSocket session.
 */
@Entity
@Table(name = "user_session")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "session_id", columnDefinition = "uuid")
    private UUID sessionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Refresh token JWT (unique, index) */
    @Column(name = "refresh_token", nullable = false, unique = true, length = 512)
    private String refreshToken;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    /**
     * is_revoked = true  → đã đăng xuất / bị đá ra (WebSocket disconnect)
     * is_revoked = false → đang active
     */
    @Column(name = "is_revoked")
    @Builder.Default
    private boolean revoked = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Thời điểm hết hạn của refresh token (7 ngày kể từ lần đăng nhập cuối) */
    @Column(name = "expired_at", nullable = false)
    private LocalDateTime expiredAt;

    // ===== Business Logic =====

    /** Gia hạn session thêm 7 ngày (tương đương refresh_expiry trong Django) */
    public void refreshExpiry(String newToken) {
        this.expiredAt = LocalDateTime.now().plusDays(7);
        this.revoked = false;
        if (newToken != null) {
            this.refreshToken = newToken;
        }
    }

    /** Session còn hợp lệ khi chưa bị revoke và chưa hết hạn */
    public boolean isValid() {
        return !revoked && expiredAt.isAfter(LocalDateTime.now());
    }
}
