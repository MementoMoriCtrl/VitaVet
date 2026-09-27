package com.vitavet.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "mascota")
public class Mascota {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_mascota")
    private Integer idMascota;

    @Column(name = "id_usuario", nullable = false)
    private Integer idUsuario;

    @Column(name = "nombre", nullable = false, length = 50)
    private String nombre;

    @Column(name = "tipo", nullable = false, length = 30)
    private String tipo;

    @Column(name = "raza", nullable = false, length = 50)
    private String raza;

    @Column(name = "sexo", nullable = false, length = 20)
    private String sexo;

    @Column(name = "edad", nullable = false)
    private Integer edad;

    public Mascota() {
    }

    public Integer getIdMascota() {
        return idMascota;
    }

    public void setIdMascota(Integer idMascota) {
        this.idMascota = idMascota;
    }

    public Integer getIdUsuario() {
        return idUsuario;
    }

    public void setIdUsuario(Integer idUsuario) {
        this.idUsuario = idUsuario;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getRaza() {
        return raza;
    }

    public void setRaza(String raza) {
        this.raza = raza;
    }

    public String getSexo() {
        return sexo;
    }

    public void setSexo(String sexo) {
        this.sexo = sexo;
    }

    public Integer getEdad() {
        return edad;
    }

    public void setEdad(Integer edad) {
        this.edad = edad;
    }
}
