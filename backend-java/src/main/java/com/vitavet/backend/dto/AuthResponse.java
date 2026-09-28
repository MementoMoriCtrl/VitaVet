package com.vitavet.backend.dto;

import com.vitavet.backend.model.Rol;

public record AuthResponse(
        String token,
        Integer idUsuario,
        String nombre,
        String apellido,
        String correo,
        Rol rol) {
}
