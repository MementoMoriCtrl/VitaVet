package com.vitavet.backend.security;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.hibernate.exception.ConstraintViolationException;

import com.vitavet.backend.dto.RegistroRequest;
import com.vitavet.backend.model.EstadoUsuario;
import com.vitavet.backend.model.Rol;
import com.vitavet.backend.model.Usuario;
import com.vitavet.backend.repository.UsuarioRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RegistroService {
    private final UsuarioRepository usuarios;
    private final PasswordEncoder passwordEncoder;

    public RegistroService(UsuarioRepository usuarios, PasswordEncoder passwordEncoder) {
        this.usuarios = usuarios;
        this.passwordEncoder = passwordEncoder;
    }

    public void registrar(RegistroRequest datos) {
        if (datos == null || !textoValido(datos.nombre(), 50)
                || !textoValido(datos.apellido(), 50) || !textoValido(datos.dni(), 20)
                || !textoValido(datos.correo(), 100)
                || !datos.correo().trim().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
                || !textoValido(datos.telefono(), 20)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Completa todos los campos con valores válidos y respeta sus longitudes máximas.");
        }
        // BCrypt admite como máximo 72 bytes; no truncar contraseñas silenciosamente.
        if (datos.password() == null || datos.password().isBlank() || datos.password().length() < 8
                || datos.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes UTF-8.");
        }
        if (usuarios.existsByDni(datos.dni().trim())) conflicto("El DNI ya está registrado.");
        if (usuarios.existsByCorreo(datos.correo().trim())) conflicto("El correo ya está registrado.");

        String passwordCodificada = passwordEncoder.encode(datos.password());
        // Cada saveAndFlush usa su propia transacción de repositorio. No envolver el
        // bucle en una transacción: una colisión debe revertirse antes del reintento.
        for (int intento = 0; intento < 3; intento++) {
            Usuario usuario = new Usuario();
            usuario.setNombre(datos.nombre().trim());
            usuario.setApellido(datos.apellido().trim());
            usuario.setDni(datos.dni().trim());
            usuario.setNombreUsuario(generarNombreUsuario());
            usuario.setCorreo(datos.correo().trim());
            usuario.setTelefono(datos.telefono().trim());
            usuario.setPassword(passwordCodificada);
            usuario.setRol(Rol.CLIENTE);
            usuario.setEstado(EstadoUsuario.PENDIENTE);
            try {
                // Flush dentro de la llamada: también captura conflictos de solicitudes concurrentes.
                usuarios.saveAndFlush(usuario);
                return;
            } catch (DataIntegrityViolationException exception) {
                if (!colisionNombreUsuario(exception)) {
                    conflicto("No se pudo crear la cuenta: el DNI o correo ya está registrado o entra en conflicto con los datos existentes.");
                }
            }
        }
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "No se pudo generar el identificador de la cuenta. Inténtalo de nuevo.");
    }

    String generarNombreUsuario() {
        return "u_" + UUID.randomUUID().toString().replace("-", "");
    }

    private boolean colisionNombreUsuario(Throwable exception) {
        for (Throwable causa = exception; causa != null; causa = causa.getCause()) {
            if (causa instanceof ConstraintViolationException violacion) {
                String nombre = violacion.getConstraintName();
                if (nombre != null) {
                    nombre = nombre.replace("`", "").replace("'", "").replace("\"", "");
                    nombre = nombre.substring(nombre.lastIndexOf('.') + 1);
                    if (nombre.equalsIgnoreCase("uq_usuario_nombre_usuario")) return true;
                }
            }
        }
        return false;
    }

    private boolean textoValido(String valor, int maximo) {
        return valor != null && !valor.isBlank() && valor.trim().length() <= maximo;
    }

    private void conflicto(String mensaje) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, mensaje);
    }
}
