package com.vitavet.backend.controller;

import com.vitavet.backend.model.Rol;
import com.vitavet.backend.model.EstadoUsuario;
import com.vitavet.backend.model.Usuario;
import com.vitavet.backend.dto.ActualizarPerfilRequest;
import com.vitavet.backend.repository.UsuarioRepository;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin
public class UsuarioController {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public UsuarioController(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    public List<Usuario> listarUsuarios() {
        return usuarioRepository.findAll();
    }

    @GetMapping("/me")
    public ResponseEntity<Usuario> obtenerUsuarioAutenticado(@AuthenticationPrincipal Jwt jwt) {
        return usuarioAutenticado(jwt)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/me")
    public ResponseEntity<?> actualizarUsuarioAutenticado(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody ActualizarPerfilRequest datosUsuario) {

        if (!datosPerfilValido(datosUsuario)) {
            return ResponseEntity.badRequest().build();
        }
        String correo = datosUsuario.getCorreo().trim();

        return usuarioAutenticado(jwt)
                .map(usuario -> {
                    return usuarioRepository.findByCorreo(correo)
                            .filter(otroUsuario -> !otroUsuario.getIdUsuario().equals(usuario.getIdUsuario()))
                            .<ResponseEntity<?>>map(otroUsuario -> ResponseEntity.status(HttpStatus.CONFLICT).build())
                            .orElseGet(() -> {
                                usuario.setNombre(datosUsuario.getNombre().trim());
                                usuario.setApellido(datosUsuario.getApellido().trim());
                                usuario.setCorreo(correo);
                                usuario.setTelefono(datosUsuario.getTelefono().trim());
                                return ResponseEntity.ok(usuarioRepository.save(usuario));
                            });
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private java.util.Optional<Usuario> usuarioAutenticado(Jwt jwt) {
        return usuarioRepository.findById(Integer.valueOf(jwt.getSubject()));
    }

    private boolean datosPerfilValido(ActualizarPerfilRequest datosUsuario) {
        return datosUsuario != null
                && textoValido(datosUsuario.getNombre(), 50)
                && textoValido(datosUsuario.getApellido(), 50)
                && textoValido(datosUsuario.getCorreo(), 100)
                && textoValido(datosUsuario.getTelefono(), 20);
    }

    private boolean textoValido(String valor, int longitudMaxima) {
        return valor != null && !valor.isBlank() && valor.trim().length() <= longitudMaxima;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Usuario> obtenerUsuario(@PathVariable Integer id) {
        return usuarioRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> crearUsuario(@RequestBody Usuario usuario) {
        if (!datosUsuarioValidos(usuario, true)
                || usuario.getPassword() == null
                || usuario.getPassword().isBlank()
                || usuario.getPassword().length() > 255) {
            return error(HttpStatus.BAD_REQUEST, "Completa los datos del usuario con valores válidos.");
        }
        normalizarDatos(usuario);
        if (usuario.getRol() == null) {
            usuario.setRol(Rol.CLIENTE);
        }
        if (usuario.getEstado() == null) {
            usuario.setEstado(EstadoUsuario.PENDIENTE);
        }
        String conflicto = conflictoIdentidad(usuario, null);
        if (conflicto != null) {
            return error(HttpStatus.CONFLICT, conflicto);
        }
        usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));
        try {
            return ResponseEntity.ok(usuarioRepository.save(usuario));
        } catch (DataIntegrityViolationException exception) {
            return error(HttpStatus.CONFLICT, mensajeConflictoUnico(exception));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizarUsuario(
            @PathVariable Integer id,
            @RequestBody Usuario datosUsuario) {

        if (datosUsuario == null) {
            return ResponseEntity.badRequest().build();
        }
        return usuarioRepository.findById(id)
                .map(usuario -> {
                    if (datosUsuario.getNombre() != null) usuario.setNombre(datosUsuario.getNombre().trim());
                    if (datosUsuario.getApellido() != null) usuario.setApellido(datosUsuario.getApellido().trim());
                    if (datosUsuario.getDni() != null) usuario.setDni(datosUsuario.getDni().trim());
                    if (datosUsuario.getNombreUsuario() != null) {
                        usuario.setNombreUsuario(datosUsuario.getNombreUsuario().trim());
                    }
                    if (datosUsuario.getCorreo() != null) usuario.setCorreo(datosUsuario.getCorreo().trim());
                    if (datosUsuario.getRol() != null) {
                        usuario.setRol(datosUsuario.getRol());
                    }
                    if (datosUsuario.getEstado() != null) {
                        usuario.setEstado(datosUsuario.getEstado());
                    }
                    if (datosUsuario.getPassword() != null && !datosUsuario.getPassword().isBlank()) {
                        usuario.setPassword(passwordEncoder.encode(datosUsuario.getPassword()));
                    }
                    if (datosUsuario.getTelefono() != null) {
                        usuario.setTelefono(datosUsuario.getTelefono().trim());
                    }

                    if (!datosUsuarioValidos(usuario, false)) {
                        return ResponseEntity.badRequest().<Usuario>build();
                    }
                    String conflicto = conflictoIdentidad(usuario, id);
                    if (conflicto != null) {
                        return error(HttpStatus.CONFLICT, conflicto);
                    }
                    try {
                        return ResponseEntity.ok(usuarioRepository.save(usuario));
                    } catch (DataIntegrityViolationException exception) {
                        return error(HttpStatus.CONFLICT, mensajeConflictoUnico(exception));
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private boolean datosUsuarioValidos(Usuario usuario, boolean incluirPassword) {
        return usuario != null
                && textoValido(usuario.getNombre(), 50)
                && textoValido(usuario.getApellido(), 50)
                && textoValido(usuario.getDni(), 20)
                && textoValido(usuario.getNombreUsuario(), 50)
                && textoValido(usuario.getCorreo(), 100)
                && correoValido(usuario.getCorreo())
                && textoValido(usuario.getTelefono(), 20)
                && (!incluirPassword || usuario.getPassword() != null);
    }

    private boolean correoValido(String correo) {
        return correo != null && correo.trim().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }

    private void normalizarDatos(Usuario usuario) {
        usuario.setNombre(usuario.getNombre().trim());
        usuario.setApellido(usuario.getApellido().trim());
        usuario.setDni(usuario.getDni().trim());
        usuario.setNombreUsuario(usuario.getNombreUsuario().trim());
        usuario.setCorreo(usuario.getCorreo().trim());
        usuario.setTelefono(usuario.getTelefono().trim());
    }

    private String conflictoIdentidad(Usuario usuario, Integer idExcluido) {
        boolean correoDuplicado = idExcluido == null
                ? usuarioRepository.existsByCorreo(usuario.getCorreo())
                : usuarioRepository.existsByCorreoAndIdUsuarioNot(usuario.getCorreo(), idExcluido);
        if (correoDuplicado) return "El correo ya está registrado.";

        boolean dniDuplicado = idExcluido == null
                ? usuarioRepository.existsByDni(usuario.getDni())
                : usuarioRepository.existsByDniAndIdUsuarioNot(usuario.getDni(), idExcluido);
        if (dniDuplicado) return "El DNI ya está registrado";

        boolean nombreUsuarioDuplicado = idExcluido == null
                ? usuarioRepository.existsByNombreUsuario(usuario.getNombreUsuario())
                : usuarioRepository.existsByNombreUsuarioAndIdUsuarioNot(usuario.getNombreUsuario(), idExcluido);
        if (nombreUsuarioDuplicado) return "El nombre de usuario ya está registrado";
        return null;
    }

    private String mensajeConflictoUnico(DataIntegrityViolationException exception) {
        for (Throwable causa = exception; causa != null; causa = causa.getCause()) {
            if (causa instanceof ConstraintViolationException violacion) {
                String restriccion = violacion.getConstraintName();
                if (restriccion != null) {
                    restriccion = restriccion.replace("`", "").replace("'", "").replace("\"", "").trim();
                    int separador = restriccion.lastIndexOf('.');
                    if (separador >= 0) {
                        restriccion = restriccion.substring(separador + 1);
                    }
                    if (restriccion.equalsIgnoreCase("uq_usuario_dni")) {
                        return "El DNI ya está registrado";
                    }
                    if (restriccion.equalsIgnoreCase("uq_usuario_nombre_usuario")) {
                        return "El nombre de usuario ya está registrado";
                    }
                }
            }
        }
        return "El correo, DNI o nombre de usuario ya está registrado.";
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarUsuario(@PathVariable Integer id) {

        if (!usuarioRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        usuarioRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
