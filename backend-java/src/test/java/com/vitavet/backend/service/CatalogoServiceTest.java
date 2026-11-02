package com.vitavet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.vitavet.backend.repository.OpcionCatalogoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class CatalogoServiceTest {
    @Test
    void validaPertenenciaLongitudYObligatoriedad() {
        var repo = mock(OpcionCatalogoRepository.class);
        var servicio = new CatalogoService(repo);
        when(repo.existsByCategoriaAndEtiqueta("sexo", "No determinado")).thenReturn(true);
        assertDoesNotThrow(() -> servicio.validar("sexo", "No determinado", 20));
        for (String valor : new String[] { null, "", " ", "Inexistente", "x".repeat(21) }) {
            var error = assertThrows(ResponseStatusException.class, () -> servicio.validar("sexo", valor, 20));
            assertEquals(400, error.getStatusCode().value());
        }
        verify(repo, never()).existsByCategoriaAndEtiqueta("sexo", "x".repeat(21));
    }
}
