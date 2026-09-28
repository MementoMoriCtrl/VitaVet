package com.vitavet.backend.controller;

import com.vitavet.backend.model.Mascota;
import com.vitavet.backend.repository.MascotaRepository;
import com.vitavet.backend.security.JwtIdentity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mascotas")
@CrossOrigin(origins = "*")
public class MascotaController {

    private final MascotaRepository mascotaRepository;

    public MascotaController(MascotaRepository mascotaRepository) {
        this.mascotaRepository = mascotaRepository;
    }

    @GetMapping
    public List<Mascota> listarMascotas(@AuthenticationPrincipal Jwt jwt) {
        return JwtIdentity.isAdmin(jwt)
                ? mascotaRepository.findAll()
                : mascotaRepository.findByIdUsuario(JwtIdentity.userId(jwt));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Mascota> buscarMascota(@PathVariable Integer id, @AuthenticationPrincipal Jwt jwt) {
        return buscarPorIdentidad(id, jwt)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Mascota registrarMascota(@RequestBody Mascota mascota, @AuthenticationPrincipal Jwt jwt) {
        if (!JwtIdentity.isAdmin(jwt)) {
            mascota.setIdUsuario(JwtIdentity.userId(jwt));
        }
        return mascotaRepository.save(mascota);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Mascota> actualizarMascota(
            @PathVariable Integer id,
            @RequestBody Mascota datosMascota,
            @AuthenticationPrincipal Jwt jwt) {

        return buscarPorIdentidad(id, jwt)
                .map(mascota -> {
                    if (JwtIdentity.isAdmin(jwt)) {
                        mascota.setIdUsuario(datosMascota.getIdUsuario());
                    }
                    mascota.setNombre(datosMascota.getNombre());
                    mascota.setTipo(datosMascota.getTipo());
                    mascota.setRaza(datosMascota.getRaza());
                    mascota.setSexo(datosMascota.getSexo());
                    mascota.setEdad(datosMascota.getEdad());

                    return ResponseEntity.ok(mascotaRepository.save(mascota));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarMascota(@PathVariable Integer id, @AuthenticationPrincipal Jwt jwt) {
        return buscarPorIdentidad(id, jwt)
                .map(mascota -> {
                    mascotaRepository.delete(mascota);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private java.util.Optional<Mascota> buscarPorIdentidad(Integer id, Jwt jwt) {
        return JwtIdentity.isAdmin(jwt)
                ? mascotaRepository.findById(id)
                : mascotaRepository.findByIdMascotaAndIdUsuario(id, JwtIdentity.userId(jwt));
    }
}
