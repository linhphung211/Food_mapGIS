package com.foodmap.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {

    private JwtTokenProvider provider;

    @BeforeEach
    void setUp() {
        String secret = "test-secret-key-that-is-long-enough-for-hs256-at-least-64-characters-long";
        provider = new JwtTokenProvider(secret, 3600000L, 604800000L);
    }

    @Test
    void generateAccessToken_ShouldBeValidatable() {
        String token = provider.generateAccessToken("testuser");
        assertThat(provider.validateToken(token)).isTrue();
        assertThat(provider.getUsernameFromToken(token)).isEqualTo("testuser");
    }

    @Test
    void generateRefreshToken_ShouldBeValidatable() {
        String token = provider.generateRefreshToken("testuser");
        assertThat(provider.validateToken(token)).isTrue();
    }

    @Test
    void validateToken_ShouldReturnFalse_WhenTokenIsInvalid() {
        assertThat(provider.validateToken("invalid.token.here")).isFalse();
    }
}
