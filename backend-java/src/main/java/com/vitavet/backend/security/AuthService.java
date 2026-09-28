package com.vitavet.backend.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import com.vitavet.backend.dto.AuthResponse;
import com.vitavet.backend.dto.LoginRequest;
import com.vitavet.backend.model.Usuario;
import com.vitavet.backend.repository.UsuarioRepository;
import org.springframework.security.authentication.BadCredentialsException;
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
            if (passwordMatches) {
                usuario.setPassword(passwordEncoder.encode(request.password()));
                usuarioRepository.save(usuario);
            }
        }

        if (!passwordMatches) {
            throw new BadCredentialsException("Correo o contraseña incorrectos");
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
