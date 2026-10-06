package com.vitavet.backend.controller;

import com.vitavet.backend.model.Pago;
import com.vitavet.backend.repository.CitaRepository;
import com.vitavet.backend.repository.PagoRepository;
import com.vitavet.backend.security.JwtIdentity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pagos")
public class PagoController {

    private final PagoRepository pagoRepository;
    private final CitaRepository citaRepository;

    public PagoController(PagoRepository pagoRepository, CitaRepository citaRepository) {
        this.pagoRepository = pagoRepository;
        this.citaRepository = citaRepository;
    }

    @GetMapping
    public List<Pago> listar(@AuthenticationPrincipal Jwt jwt) {
        return JwtIdentity.isAdmin(jwt)
                ? pagoRepository.findAll()
                : pagoRepository.findAllByUsuarioId(JwtIdentity.userId(jwt));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Pago> buscar(@PathVariable Integer id, @AuthenticationPrincipal Jwt jwt) {
        return buscarPorIdentidad(id, jwt)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Pago> crear(@RequestBody Pago pago, @AuthenticationPrincipal Jwt jwt) {
        if (!JwtIdentity.isAdmin(jwt)
                && !citaRepository.existsByIdCitaAndUsuarioId(pago.getIdCita(), JwtIdentity.userId(jwt))) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(pagoRepository.save(pago));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Pago> actualizar(
            @PathVariable Integer id,
            @RequestBody Pago datos,
            @AuthenticationPrincipal Jwt jwt) {

        return buscarPorIdentidad(id, jwt)
                .map(pago -> {
                    if (!JwtIdentity.isAdmin(jwt)) {
                        if (!citaRepository.existsByIdCitaAndUsuarioId(
                                datos.getIdCita(), JwtIdentity.userId(jwt))) {
                            return ResponseEntity.notFound().<Pago>build();
                        }
                        if (datos.getIdCita() == null || !datos.getIdCita().equals(pago.getIdCita())) {
                            return ResponseEntity.status(403).<Pago>build();
                        }
                        if (!java.util.Objects.equals(datos.getMonto(), pago.getMonto())
                                || !java.util.Objects.equals(datos.getEstado(), pago.getEstado())) {
                            return ResponseEntity.status(403).<Pago>build();
                        }
                        pago.setModalidad(datos.getModalidad());
                        pago.setMetodo(datos.getMetodo());
                        return ResponseEntity.ok(pagoRepository.save(pago));
                    }
                    pago.setIdCita(datos.getIdCita());
                    pago.setModalidad(datos.getModalidad());
                    pago.setMetodo(datos.getMetodo());
                    pago.setMonto(datos.getMonto());
                    pago.setEstado(datos.getEstado());

                    return ResponseEntity.ok(pagoRepository.save(pago));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Integer id, @AuthenticationPrincipal Jwt jwt) {
        if (!JwtIdentity.isAdmin(jwt)) {
            return ResponseEntity.status(403).build();
        }
        return buscarPorIdentidad(id, jwt)
                .map(pago -> {
                    pagoRepository.delete(pago);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private java.util.Optional<Pago> buscarPorIdentidad(Integer id, Jwt jwt) {
        return JwtIdentity.isAdmin(jwt)
                ? pagoRepository.findById(id)
                : pagoRepository.findByIdPagoAndUsuarioId(id, JwtIdentity.userId(jwt));
    }
}
