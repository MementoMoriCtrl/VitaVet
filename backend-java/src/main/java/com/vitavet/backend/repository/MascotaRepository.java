package com.vitavet.backend.repository;

import com.vitavet.backend.model.Mascota;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MascotaRepository extends JpaRepository<Mascota, Integer> {
    java.util.List<Mascota> findByIdUsuario(Integer idUsuario);

    java.util.Optional<Mascota> findByIdMascotaAndIdUsuario(Integer idMascota, Integer idUsuario);

    boolean existsByIdMascotaAndIdUsuario(Integer idMascota, Integer idUsuario);
}
