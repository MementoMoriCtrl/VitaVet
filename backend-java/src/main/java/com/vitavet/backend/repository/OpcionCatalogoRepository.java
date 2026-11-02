package com.vitavet.backend.repository;

import java.util.List;
import com.vitavet.backend.model.OpcionCatalogo;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OpcionCatalogoRepository extends JpaRepository<OpcionCatalogo, Integer> {
    List<OpcionCatalogo> findByCategoriaOrderByIdAsc(String categoria);
    boolean existsByCategoriaAndEtiqueta(String categoria, String etiqueta);
}
