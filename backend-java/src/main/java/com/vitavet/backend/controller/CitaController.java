package com.vitavet.backend.controller;

import com.vitavet.backend.model.Cita;
import com.vitavet.backend.repository.MascotaRepository;
import com.vitavet.backend.repository.CitaRepository;
import com.vitavet.backend.security.JwtIdentity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/citas")
@CrossOrigin
public class CitaController {

    private final CitaRepository citaRepository;
    private final MascotaRepository mascotaRepository;

    public CitaController(CitaRepository citaRepository, MascotaRepository mascotaRepository) {
        this.citaRepository = citaRepository;
        this.mascotaRepository = mascotaRepository;
    }

    @GetMapping
    public List<Cita> listarCitas(@AuthenticationPrincipal Jwt jwt) {
        return JwtIdentity.isAdmin(jwt)
                ? citaRepository.findAll()
                : citaRepository.findAllByUsuarioId(JwtIdentity.userId(jwt));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Cita> obtenerCita(@PathVariable Integer id, @AuthenticationPrincipal Jwt jwt) {
        return buscarPorIdentidad(id, jwt)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Cita> crearCita(@RequestBody Cita cita, @AuthenticationPrincipal Jwt jwt) {
        if (!JwtIdentity.isAdmin(jwt)) {
            if (!mascotaRepository.existsByIdMascotaAndIdUsuario(
                    cita.getIdMascota(), JwtIdentity.userId(jwt))) {
                return ResponseEntity.notFound().build();
            }
        }
        cita.setEstado("Programada");
        return ResponseEntity.ok(citaRepository.save(cita));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Cita> actualizarCita(
            @PathVariable Integer id,
            @RequestBody Cita datosCita,
            @AuthenticationPrincipal Jwt jwt) {

        return buscarPorIdentidad(id, jwt)
                .map(cita -> {
                    if (!JwtIdentity.isAdmin(jwt)) {
                        if (!mascotaRepository.existsByIdMascotaAndIdUsuario(
                                datosCita.getIdMascota(), JwtIdentity.userId(jwt))) {
                            return ResponseEntity.notFound().<Cita>build();
                        }
                        if (!"Programada".equals(cita.getEstado())) {
                            return ResponseEntity.status(409).<Cita>build();
                        }
                        if (!"Cancelada".equals(datosCita.getEstado())) {
                            return ResponseEntity.status(403).<Cita>build();
                        }
                        cita.setEstado("Cancelada");
                        return ResponseEntity.ok(citaRepository.save(cita));
                    }
                    String nuevoEstado = datosCita.getEstado();
                    if (nuevoEstado == null || !List.of("Programada", "Completada", "Cancelada").contains(nuevoEstado)) {
                        return ResponseEntity.status(409).<Cita>build();
                    }
                    if (("Completada".equals(cita.getEstado()) && "Programada".equals(nuevoEstado))
                            || ("Cancelada".equals(cita.getEstado()) && "Completada".equals(nuevoEstado))) {
                        return ResponseEntity.status(409).<Cita>build();
                    }
                    cita.setIdMascota(datosCita.getIdMascota());
                    cita.setIdVeterinario(datosCita.getIdVeterinario());
                    cita.setIdServicio(datosCita.getIdServicio());
                    cita.setFecha(datosCita.getFecha());
                    cita.setHora(datosCita.getHora());
                    cita.setEstado(nuevoEstado);

                    return ResponseEntity.ok(citaRepository.save(cita));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarCita(@PathVariable Integer id, @AuthenticationPrincipal Jwt jwt) {
        if (!JwtIdentity.isAdmin(jwt)) {
            return ResponseEntity.status(403).build();
        }
        return buscarPorIdentidad(id, jwt)
                .map(cita -> {
                    citaRepository.delete(cita);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private java.util.Optional<Cita> buscarPorIdentidad(Integer id, Jwt jwt) {
        return JwtIdentity.isAdmin(jwt)
                ? citaRepository.findById(id)
                : citaRepository.findByIdCitaAndUsuarioId(id, JwtIdentity.userId(jwt));
    }
}
