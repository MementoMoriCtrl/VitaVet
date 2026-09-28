package com.vitavet.backend.security;

import org.springframework.security.oauth2.jwt.Jwt;

public final class JwtIdentity {

    private JwtIdentity() {
    }

    public static Integer userId(Jwt jwt) {
        return Integer.valueOf(jwt.getSubject());
    }

    public static boolean isAdmin(Jwt jwt) {
        return "ADMIN".equals(jwt.getClaimAsString("rol"));
    }
}
