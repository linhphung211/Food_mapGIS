package com.foodmap.websocket;

import com.foodmap.user.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.UUID;

/**
 * WebSocket handler tương đương LoginControlConsumer (Django Channels).
 *
 * Frontend kết nối: ws://localhost:8000/ws/session/{session_id}/
 *
 * Khi connect → đánh dấu session is_revoked=false (active)
 * Khi disconnect → đánh dấu session is_revoked=true (đăng xuất / mất kết nối)
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class LoginControlHandler {

    private final UserSessionRepository sessionRepository;

    /**
     * Xử lý tin nhắn từ client để "kích hoạt" session.
     * Client gửi: /app/session/{session_id}/connect
     */
    @MessageMapping("/session/{sessionId}/connect")
    public void connectSession(@DestinationVariable String sessionId) {
        try {
            UUID uuid = UUID.fromString(sessionId);
            int updated = sessionRepository.findById(uuid)
                    .map(session -> {
                        session.setRevoked(false);
                        sessionRepository.save(session);
                        log.info("Session {} đã được kích hoạt (WebSocket connect).", sessionId);
                        return 1;
                    })
                    .orElse(0);

            if (updated == 0) {
                log.warn("Session {} không tồn tại, bỏ qua.", sessionId);
            }
        } catch (IllegalArgumentException e) {
            log.warn("Session ID không hợp lệ: {}", sessionId);
        }
    }

    /**
     * Khi WebSocket disconnect → revoke session (is_revoked=true).
     * Tương đương disconnect() trong Django Channels LoginControlConsumer.
     */
    @EventListener
    public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
        // Lấy session attribute nếu frontend gửi kèm session_id
        String sessionIdAttr = (String) event.getMessage().getHeaders()
                .getOrDefault("session_id", null);

        if (sessionIdAttr != null) {
            try {
                UUID uuid = UUID.fromString(sessionIdAttr);
                sessionRepository.findById(uuid).ifPresent(session -> {
                    session.setRevoked(true);
                    sessionRepository.save(session);
                    log.info("Session {} đã bị revoke (WebSocket disconnect).", sessionIdAttr);
                });
            } catch (IllegalArgumentException ignored) { }
        }
    }
}
