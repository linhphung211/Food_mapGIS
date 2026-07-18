package com.foodmap.user.repository;

import com.foodmap.user.entity.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {

    Optional<UserSession> findByUserIdAndUserAgent(Long userId, String userAgent);

    Optional<UserSession> findByRefreshToken(String refreshToken);

    /** Kiểm tra có session nào đang active ở thiết bị khác không */
    @Query("""
        SELECT COUNT(s) > 0 FROM UserSession s
        WHERE s.user.id = :userId
        AND s.revoked = false
        AND s.userAgent <> :userAgent
        """)
    boolean existsActiveSessionOnOtherDevice(@Param("userId") Long userId,
                                              @Param("userAgent") String userAgent);

    /** Celery cleanup_expired_sessions equivalent */
    @Modifying
    @Query("DELETE FROM UserSession s WHERE s.expiredAt < :now")
    int deleteExpiredSessions(@Param("now") LocalDateTime now);
}
