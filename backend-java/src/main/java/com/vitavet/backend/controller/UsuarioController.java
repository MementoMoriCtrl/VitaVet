package com.vitavet.backend.controller;

import com.vitavet.backend.model.Rol;
import com.vitavet.backend.model.Usuario;
import com.vitavet.backend.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.ResponseEntity;
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
        return usuarioRepository.findById(Integer.valueOf(jwt.getSubject()))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
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
