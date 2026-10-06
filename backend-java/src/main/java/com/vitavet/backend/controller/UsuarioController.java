package com.vitavet.backend.controller;

import com.vitavet.backend.model.Rol;
import com.vitavet.backend.model.Usuario;
import com.vitavet.backend.dto.ActualizarPerfilRequest;
import com.vitavet.backend.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    public Usuario crearUsuario(@RequestBody Usuario usuario) {
        if (usuario.getRol() == null) {
            usuario.setRol(Rol.CLIENTE);
        }
        usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));
        return usuarioRepository.save(usuario);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Usuario> actualizarUsuario(
            @PathVariable Integer id,
            @RequestBody Usuario datosUsuario) {

        return usuarioRepository.findById(id)
                .map(usuario -> {
                    usuario.setNombre(datosUsuario.getNombre());
                    usuario.setApellido(datosUsuario.getApellido());
                    usuario.setCorreo(datosUsuario.getCorreo());
                    if (datosUsuario.getRol() != null) {
                        usuario.setRol(datosUsuario.getRol());
                    }
                    if (datosUsuario.getPassword() != null && !datosUsuario.getPassword().isBlank()) {
                        usuario.setPassword(passwordEncoder.encode(datosUsuario.getPassword()));
                    }
                    usuario.setTelefono(datosUsuario.getTelefono());

                    return ResponseEntity.ok(usuarioRepository.save(usuario));
                })
                .orElse(ResponseEntity.notFound().build());
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
