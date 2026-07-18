package com.foodmap.user.scheduler;

import com.foodmap.user.repository.UserRepository;
import com.foodmap.user.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Tương đương Celery Beat trong Django.
 * Chạy định kỳ để dọn dẹp user không active và session hết hạn.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserCleanupScheduler {

    private final UserRepository userRepository;
    private final UserSessionRepository sessionRepository;

    /**
     * Tương đương: cleanup_inactive_users (Celery task)
     * Cron: Chạy lúc 00:00 mỗi đêm
     */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void deactivateInactiveUsers() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(30);
        int count = userRepository.deactivateInactiveUsers(cutoff);
        log.info("[SCHEDULER] Đã khóa {} tài khoản không hoạt động trong 30 ngày.", count);
    }

    /**
     * Tương đương: cleanup_expired_sessions (Celery task)
     * Cron: Chạy lúc 00:30 mỗi đêm
     */
    @Scheduled(cron = "0 30 0 * * *")
    @Transactional
    public void cleanupExpiredSessions() {
        int count = sessionRepository.deleteExpiredSessions(LocalDateTime.now());
        if (count > 0) {
            log.info("[SCHEDULER] Đã xóa {} session hết hạn.", count);
        } else {
            log.info("[SCHEDULER] Không có session nào hết hạn để xóa.");
        }
    }
}
