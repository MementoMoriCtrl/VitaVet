package com.vitavet.backend.service;

import java.util.List;
import com.vitavet.backend.model.OpcionCatalogo;
import com.vitavet.backend.repository.OpcionCatalogoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CatalogoService {
    private final OpcionCatalogoRepository opciones;

    public CatalogoService(OpcionCatalogoRepository opciones) { this.opciones = opciones; }

    public List<OpcionCatalogo> listar(String categoria) {
        return opciones.findByCategoriaOrderByIdAsc(categoria);
    }

    public void validar(String categoria, String valor, int maximo) {
        if (valor == null || valor.isBlank() || valor.length() > maximo
                || !opciones.existsByCategoriaAndEtiqueta(categoria, valor)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Selecciona una opción válida del catálogo de " + categoria + ".");
        }
    }
}
