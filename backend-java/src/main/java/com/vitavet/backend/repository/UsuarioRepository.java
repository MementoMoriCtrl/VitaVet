package com.vitavet.backend.repository;

import com.vitavet.backend.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {
    java.util.Optional<Usuario> findByCorreo(String correo);
    boolean existsByCorreo(String correo);
    boolean existsByCorreoAndIdUsuarioNot(String correo, Integer idUsuario);
    boolean existsByDni(String dni);
    boolean existsByDniAndIdUsuarioNot(String dni, Integer idUsuario);
    boolean existsByNombreUsuario(String nombreUsuario);
    boolean existsByNombreUsuarioAndIdUsuarioNot(String nombreUsuario, Integer idUsuario);
}
