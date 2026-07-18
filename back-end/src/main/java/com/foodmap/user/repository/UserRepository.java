package com.foodmap.user.repository;

import com.foodmap.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    /** Đăng nhập bằng username hoặc email (tương đương MultiFieldModelBackend) */
    @Query("SELECT u FROM User u WHERE u.username = :identifier OR u.email = :identifier")
    Optional<User> findByUsernameOrEmail(@Param("identifier") String identifier);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    /**
     * Celery cleanup_inactive_users equivalent:
     * Khóa tài khoản không active trong 30 ngày (is_active = false)
     */
    @Modifying
    @Query("""
        UPDATE User u SET u.active = false
        WHERE u.lastLogin < :cutoff
        AND u.staff = false AND u.superuser = false
        """)
    int deactivateInactiveUsers(@Param("cutoff") LocalDateTime cutoff);
}
