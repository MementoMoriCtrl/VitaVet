package com.vitavet.backend.controller;

import com.vitavet.backend.model.Veterinario;
import com.vitavet.backend.repository.VeterinarioRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/veterinarios")
@CrossOrigin
public class VeterinarioController {

    private final VeterinarioRepository veterinarioRepository;

    public VeterinarioController(VeterinarioRepository veterinarioRepository) {
        this.veterinarioRepository = veterinarioRepository;
    }

    @GetMapping
    public List<Veterinario> listarVeterinarios() {
        return veterinarioRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Veterinario> obtenerVeterinario(@PathVariable Integer id) {
        return veterinarioRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Veterinario crearVeterinario(@RequestBody Veterinario veterinario) {
        return veterinarioRepository.save(veterinario);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Veterinario> actualizarVeterinario(
            @PathVariable Integer id,
            @RequestBody Veterinario datos) {

        return veterinarioRepository.findById(id)
                .map(veterinario -> {
                    veterinario.setNombre(datos.getNombre());
                    veterinario.setApellido(datos.getApellido());
                    veterinario.setEspecialidad(datos.getEspecialidad());
                    veterinario.setCorreo(datos.getCorreo());
                    veterinario.setTelefono(datos.getTelefono());

                    return ResponseEntity.ok(veterinarioRepository.save(veterinario));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarVeterinario(@PathVariable Integer id) {

        if (!veterinarioRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        veterinarioRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
