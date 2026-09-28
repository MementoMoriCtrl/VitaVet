package com.vitavet.backend.controller;

import com.vitavet.backend.model.Cita;
import com.vitavet.backend.repository.CitaRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/citas")
@CrossOrigin
public class CitaController {

    private final CitaRepository citaRepository;

    public CitaController(CitaRepository citaRepository) {
        this.citaRepository = citaRepository;
    }

    @GetMapping
    public List<Cita> listarCitas() {
        return citaRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Cita> obtenerCita(@PathVariable Integer id) {
        return citaRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Cita crearCita(@RequestBody Cita cita) {
        return citaRepository.save(cita);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Cita> actualizarCita(
            @PathVariable Integer id,
            @RequestBody Cita datosCita) {

        return citaRepository.findById(id)
                .map(cita -> {
                    cita.setIdMascota(datosCita.getIdMascota());
                    cita.setIdVeterinario(datosCita.getIdVeterinario());
                    cita.setIdServicio(datosCita.getIdServicio());
                    cita.setFecha(datosCita.getFecha());
                    cita.setHora(datosCita.getHora());
                    cita.setEstado(datosCita.getEstado());

                    return ResponseEntity.ok(citaRepository.save(cita));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarCita(@PathVariable Integer id) {
        if (!citaRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        citaRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
