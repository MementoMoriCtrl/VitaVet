package com.vitavet.backend.dto;

public record RegistroRequest(String nombre, String apellido, String dni,
        String correo, String telefono, String password) {
    @Override
    public String toString() {
        return "RegistroRequest[datos protegidos]";
    }
}
