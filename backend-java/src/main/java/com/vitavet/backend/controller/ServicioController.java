package com.vitavet.backend.controller;

import com.vitavet.backend.model.Servicio;
import com.vitavet.backend.repository.ServicioRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/servicios")
@CrossOrigin
public class ServicioController {

    private final ServicioRepository servicioRepository;

    public ServicioController(ServicioRepository servicioRepository) {
        this.servicioRepository = servicioRepository;
    }

    @GetMapping
    public List<Servicio> listar() {
        return servicioRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Servicio> obtener(@PathVariable Integer id) {
        return servicioRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Servicio crear(@RequestBody Servicio servicio) {
        return servicioRepository.save(servicio);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Servicio> actualizar(
            @PathVariable Integer id,
            @RequestBody Servicio datos) {

        return servicioRepository.findById(id)
                .map(servicio -> {
                    servicio.setNombre(datos.getNombre());
                    servicio.setDescripcion(datos.getDescripcion());
                    servicio.setPrecio(datos.getPrecio());
                    servicio.setDuracionMinutos(datos.getDuracionMinutos());

                    return ResponseEntity.ok(servicioRepository.save(servicio));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Integer id) {
        if (!servicioRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        servicioRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
