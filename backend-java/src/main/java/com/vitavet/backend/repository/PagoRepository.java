package com.vitavet.backend.repository;

import com.vitavet.backend.model.Pago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PagoRepository extends JpaRepository<Pago, Integer> {

    @Query("SELECT p FROM Pago p, Cita c, Mascota m WHERE p.idCita = c.idCita " +
            "AND c.idMascota = m.idMascota AND m.idUsuario = :idUsuario")
    List<Pago> findAllByUsuarioId(@Param("idUsuario") Integer idUsuario);

    @Query("SELECT p FROM Pago p, Cita c, Mascota m WHERE p.idCita = c.idCita " +
            "AND c.idMascota = m.idMascota AND p.idPago = :idPago AND m.idUsuario = :idUsuario")
    Optional<Pago> findByIdPagoAndUsuarioId(
            @Param("idPago") Integer idPago,
            @Param("idUsuario") Integer idUsuario);

    @Query("SELECT COUNT(p) > 0 FROM Pago p, Cita c, Mascota m WHERE p.idCita = c.idCita " +
            "AND c.idMascota = m.idMascota AND p.idPago = :idPago AND m.idUsuario = :idUsuario")
    boolean existsByIdPagoAndUsuarioId(
            @Param("idPago") Integer idPago,
            @Param("idUsuario") Integer idUsuario);
}
