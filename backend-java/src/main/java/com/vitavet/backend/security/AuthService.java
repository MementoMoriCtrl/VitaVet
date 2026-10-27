package com.vitavet.backend.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import com.vitavet.backend.dto.AuthResponse;
import com.vitavet.backend.dto.LoginRequest;
import com.vitavet.backend.model.Usuario;
import com.vitavet.backend.model.EstadoUsuario;
import com.vitavet.backend.repository.UsuarioRepository;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        if (request == null || request.correo() == null || request.password() == null) {
            throw new BadCredentialsException("Correo o contraseña incorrectos");
        }

        Usuario usuario = usuarioRepository.findByCorreo(request.correo())
                .orElseThrow(() -> new BadCredentialsException("Correo o contraseña incorrectos"));

        String storedPassword = usuario.getPassword();
        boolean passwordMatches;
        if (isBcryptHash(storedPassword)) {
            passwordMatches = passwordEncoder.matches(request.password(), storedPassword);
        } else {
            passwordMatches = MessageDigest.isEqual(
                    request.password().getBytes(StandardCharsets.UTF_8),
                    storedPassword.getBytes(StandardCharsets.UTF_8));
        }

        if (!passwordMatches) {
            throw new BadCredentialsException("Correo o contraseña incorrectos");
        }

        // Solo revelar el estado una vez comprobadas las credenciales.
        if (usuario.getEstado() != EstadoUsuario.ACTIVO) {
            String mensaje = usuario.getEstado() == EstadoUsuario.PENDIENTE
                    ? "Tu cuenta está pendiente de activación. No puedes iniciar sesión todavía."
                    : "Tu cuenta no está activa. No puedes iniciar sesión. Contacta con administración.";
            throw new DisabledException(mensaje);
        }

        if (!isBcryptHash(storedPassword)) {
            usuario.setPassword(passwordEncoder.encode(request.password()));
            usuarioRepository.save(usuario);
        }

        return new AuthResponse(
                jwtService.createToken(usuario),
                usuario.getIdUsuario(),
                usuario.getNombre(),
                usuario.getApellido(),
                usuario.getCorreo(),
                usuario.getRol());
    }

    private boolean isBcryptHash(String value) {
        return value != null && value.matches("^\\$2[aby]\\$\\d{2}\\$.*");
    }
}
