package com.vitavet.backend.controller;

import java.util.List;
import com.vitavet.backend.model.OpcionCatalogo;
import com.vitavet.backend.service.CatalogoService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/catalogos")
public class CatalogoController {
    private final CatalogoService catalogos;
    public CatalogoController(CatalogoService catalogos) { this.catalogos = catalogos; }

    @GetMapping("/tipos-animal")
    public List<OpcionCatalogo> tipos() { return catalogos.listar("tipo_animal"); }
    @GetMapping("/sexos")
    public List<OpcionCatalogo> sexos() { return catalogos.listar("sexo"); }
}
