package com.vitavet.backend.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import tools.jackson.databind.ObjectMapper;
import com.vitavet.backend.dto.AuthResponse;
import com.vitavet.backend.dto.LoginRequest;
import com.vitavet.backend.model.Rol;
import com.vitavet.backend.model.Usuario;
import com.vitavet.backend.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.server.resource.authentication.BearerTokenAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationProvider;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String TEST_SECRET = "test-secret-for-vita-vet-jwt-32-bytes-minimum";

    @Mock
    private UsuarioRepository usuarioRepository;

    private BCryptPasswordEncoder passwordEncoder;
    private JwtDecoder jwtDecoder;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        var key = new javax.crypto.spec.SecretKeySpec(
                TEST_SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256");
        JwtEncoder jwtEncoder = NimbusJwtEncoder.withSecretKey(key)
                .algorithm(MacAlgorithm.HS256)
                .build();
        jwtDecoder = NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        passwordEncoder = new BCryptPasswordEncoder();
        authService = new AuthService(usuarioRepository, passwordEncoder, new JwtService(jwtEncoder, 3600));
    }

    @Test
    void loginAdminContrasenaLegadaLaActualizaYDevuelveJwtSinPassword() throws Exception {
        Usuario admin = usuario("1992");
        when(usuarioRepository.findByCorreo(admin.getCorreo())).thenReturn(java.util.Optional.of(admin));

        AuthResponse response = authService.login(new LoginRequest(admin.getCorreo(), "1992"));

        assertEquals(Rol.ADMIN, response.rol());
        assertEquals(6, response.idUsuario());
        assertNotEquals("1992", admin.getPassword());
        assertTrue(passwordEncoder.matches("1992", admin.getPassword()));
        verify(usuarioRepository).save(admin);

        String json = new ObjectMapper().writeValueAsString(response);
        assertFalse(json.contains("password"));
        assertFalse(json.contains("1992"));
        assertFalse(new ObjectMapper().writeValueAsString(admin).contains("password"));

        var jwt = jwtDecoder.decode(response.token());
        assertEquals("6", jwt.getSubject());
        assertEquals(admin.getCorreo(), jwt.getClaimAsString("correo"));
        assertEquals("ADMIN", jwt.getClaimAsString("rol"));
        assertTrue(jwt.getIssuedAt().isBefore(Instant.now().plusSeconds(1)));
        assertTrue(jwt.getExpiresAt().isAfter(Instant.now()));

        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverter.setAuthoritiesClaimName("rol");
        authoritiesConverter.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authoritiesConverter);
        JwtAuthenticationProvider provider = new JwtAuthenticationProvider(jwtDecoder);
        provider.setJwtAuthenticationConverter(converter);

        var authentication = provider.authenticate(new BearerTokenAuthenticationToken(response.token()));
        assertTrue(authentication.isAuthenticated());
        assertTrue(authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN")));
    }

    @Test
    void loginConHashBcryptNoVuelveAMigrarLaContrasena() {
        Usuario cliente = usuario(passwordEncoder.encode("clave-segura"));
        when(usuarioRepository.findByCorreo(cliente.getCorreo())).thenReturn(java.util.Optional.of(cliente));

        authService.login(new LoginRequest(cliente.getCorreo(), "clave-segura"));

        verify(usuarioRepository, never()).save(cliente);
    }

    @Test
    void rechazaContrasenaIncorrecta() {
        Usuario admin = usuario("1992");
        when(usuarioRepository.findByCorreo(admin.getCorreo())).thenReturn(java.util.Optional.of(admin));

        assertThrows(BadCredentialsException.class,
                () -> authService.login(new LoginRequest(admin.getCorreo(), "incorrecta")));
        verify(usuarioRepository, never()).save(admin);
    }

    @Test
    void rechazaCorreoInexistenteConElMismoErrorDeCredenciales() {
        when(usuarioRepository.findByCorreo("inexistente@vitavet.test"))
                .thenReturn(java.util.Optional.empty());

        assertThrows(BadCredentialsException.class,
                () -> authService.login(new LoginRequest("inexistente@vitavet.test", "cualquier-clave")));
    }

    private Usuario usuario(String password) {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(6);
        usuario.setNombre("Nicolas");
        usuario.setApellido("Suarez");
        usuario.setCorreo("nsm_26k@gmail.com");
        usuario.setPassword(password);
        usuario.setTelefono("999999999");
        usuario.setRol(Rol.ADMIN);
        return usuario;
    }
}
