package com.vitavet.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "catalogo_opcion")
public class OpcionCatalogo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    @Column(nullable = false, length = 30)
    private String categoria;
    @Column(nullable = false, length = 100)
    private String etiqueta;

    public OpcionCatalogo() {}

    public OpcionCatalogo(Integer id, String categoria, String etiqueta) {
        this.id = id;
        this.categoria = categoria;
        this.etiqueta = etiqueta;
    }

    public Integer getId() { return id; }
    public String getCategoria() { return categoria; }
    public String getEtiqueta() { return etiqueta; }
}
