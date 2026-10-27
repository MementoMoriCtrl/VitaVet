package com.vitavet.backend.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.sql.SQLException;
import java.util.HashSet;

import com.vitavet.backend.dto.RegistroRequest;
import com.vitavet.backend.model.Usuario;
import com.vitavet.backend.repository.UsuarioRepository;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

class RegistroServiceTest {
    private final UsuarioRepository usuarios = mock(UsuarioRepository.class);
    private final RegistroService servicio = spy(new RegistroService(usuarios, new BCryptPasswordEncoder()));
    private final RegistroRequest datos = new RegistroRequest("Juan", "Perez", "12345678",
            "juan@example.com", "987654321", "clave-segura");

    private DataIntegrityViolationException colision() {
        return new DataIntegrityViolationException("detalle SQL",
                new ConstraintViolationException("duplicate", new SQLException("duplicate", "23000", 1062),
                        "vitavet.uq_usuario_nombre_usuario"));
    }

    @Test
    void identificadoresSonPrivadosValidosYDistintos() {
        assertFalse(datos.toString().contains(datos.password()));
        var nombres = new HashSet<String>();
        for (int i = 0; i < 1000; i++) {
            String nombre = servicio.generarNombreUsuario();
            assertTrue(nombre.matches("u_[0-9a-f]{32}"));
            assertTrue(nombre.length() <= 50);
            assertTrue(nombres.add(nombre));
        }
    }

    @Test
    void colisionReintentaConOtraEntidadYNombre() {
        doReturn("u_colision", "u_nuevo").when(servicio).generarNombreUsuario();
        when(usuarios.saveAndFlush(any())).thenThrow(colision()).thenAnswer(i -> i.getArgument(0));
        servicio.registrar(datos);
        var captor = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarios, times(2)).saveAndFlush(captor.capture());
        assertEquals("u_colision", captor.getAllValues().get(0).getNombreUsuario());
        assertEquals("u_nuevo", captor.getAllValues().get(1).getNombreUsuario());
        assertNotSame(captor.getAllValues().get(0), captor.getAllValues().get(1));
        assertNull(captor.getAllValues().get(1).getIdUsuario());
    }

    @Test
    void colisionesPersistentesSeLimitanATresIntentos() {
        when(usuarios.saveAndFlush(any())).thenThrow(colision());
        var error = assertThrows(ResponseStatusException.class, () -> servicio.registrar(datos));
        assertEquals(503, error.getStatusCode().value());
        verify(usuarios, times(3)).saveAndFlush(any());
        assertFalse(error.getReason().contains("SQL"));
    }

    @Test
    void conflictoDeCorreoConcurrenteNoReintenta() {
        when(usuarios.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate correo"));
        var error = assertThrows(ResponseStatusException.class, () -> servicio.registrar(datos));
        assertEquals(409, error.getStatusCode().value());
        verify(usuarios).saveAndFlush(any());
    }
}
