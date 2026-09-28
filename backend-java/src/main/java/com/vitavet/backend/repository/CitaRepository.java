package com.vitavet.backend.repository;

import com.vitavet.backend.model.Cita;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CitaRepository extends JpaRepository<Cita, Integer> {

    @Query("SELECT c FROM Cita c, Mascota m WHERE c.idMascota = m.idMascota AND m.idUsuario = :idUsuario")
    List<Cita> findAllByUsuarioId(@Param("idUsuario") Integer idUsuario);

    @Query("SELECT c FROM Cita c, Mascota m WHERE c.idMascota = m.idMascota " +
            "AND c.idCita = :idCita AND m.idUsuario = :idUsuario")
    Optional<Cita> findByIdCitaAndUsuarioId(
            @Param("idCita") Integer idCita,
            @Param("idUsuario") Integer idUsuario);

    @Query("SELECT COUNT(c) > 0 FROM Cita c, Mascota m WHERE c.idMascota = m.idMascota " +
            "AND c.idCita = :idCita AND m.idUsuario = :idUsuario")
    boolean existsByIdCitaAndUsuarioId(
            @Param("idCita") Integer idCita,
            @Param("idUsuario") Integer idUsuario);
}
