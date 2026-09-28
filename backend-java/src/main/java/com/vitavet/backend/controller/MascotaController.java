package com.vitavet.backend.controller;

import com.vitavet.backend.model.Mascota;
import com.vitavet.backend.repository.MascotaRepository;
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
    public List<Mascota> listarMascotas() {
        return mascotaRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Mascota> buscarMascota(@PathVariable Integer id) {
        return mascotaRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Mascota registrarMascota(@RequestBody Mascota mascota) {
        return mascotaRepository.save(mascota);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Mascota> actualizarMascota(
            @PathVariable Integer id,
            @RequestBody Mascota datosMascota) {

        return mascotaRepository.findById(id)
                .map(mascota -> {
                    mascota.setIdUsuario(datosMascota.getIdUsuario());
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
    public ResponseEntity<Void> eliminarMascota(@PathVariable Integer id) {
        if (!mascotaRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        mascotaRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}