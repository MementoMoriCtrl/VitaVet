package com.vitavet.backend.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.vitavet.backend.model.Cita;
import com.vitavet.backend.model.Mascota;
import com.vitavet.backend.model.Pago;
import com.vitavet.backend.model.Rol;
import com.vitavet.backend.model.Servicio;
import com.vitavet.backend.model.Usuario;
import com.vitavet.backend.model.Veterinario;
import com.vitavet.backend.repository.CitaRepository;
import com.vitavet.backend.repository.MascotaRepository;
import com.vitavet.backend.repository.PagoRepository;
import com.vitavet.backend.repository.ServicioRepository;
import com.vitavet.backend.repository.UsuarioRepository;
import com.vitavet.backend.repository.VeterinarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class AuthorizationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtEncoder jwtEncoder;

    @MockitoBean
    private UsuarioRepository usuarioRepository;

    @MockitoBean
    private MascotaRepository mascotaRepository;

    @MockitoBean
    private CitaRepository citaRepository;

    @MockitoBean
    private PagoRepository pagoRepository;

    @MockitoBean
    private VeterinarioRepository veterinarioRepository;

    @MockitoBean
    private ServicioRepository servicioRepository;

    @Test
    void endpointsPrivadosRechazanSolicitudesSinJwtYConJwtInvalido() throws Exception {
        mockMvc.perform(get("/api/mascotas"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/mascotas").header("Authorization", "Bearer token-invalido"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void clienteNoPuedeAdministrarUsuariosServiciosNiVeterinarios() throws Exception {
        String token = token(8, Rol.CLIENTE);

        mockMvc.perform(get("/api/usuarios").header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/usuarios/8").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rol\":\"ADMIN\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/servicios").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/veterinarios/1").header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());

        verify(usuarioRepository, never()).findAll();
        verify(servicioRepository, never()).save(any());
        verify(veterinarioRepository, never()).deleteById(any());
    }

    @Test
    void clientePuedeConsultarDatosCompartidosYPerfilPropio() throws Exception {
        String token = token(8, Rol.CLIENTE);
        when(veterinarioRepository.findAll()).thenReturn(List.of(new Veterinario()));
        when(servicioRepository.findAll()).thenReturn(List.of(new Servicio()));
        when(usuarioRepository.findById(8)).thenReturn(Optional.of(usuario(8, Rol.CLIENTE)));

        mockMvc.perform(get("/api/veterinarios").header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/servicios").header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/usuarios/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.idUsuario").value(8))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void clienteSoloListaMascotasPropiasYNoPuedeConsultarUnaAjena() throws Exception {
        String token = token(8, Rol.CLIENTE);
        Mascota mascotaPropia = new Mascota();
        mascotaPropia.setIdMascota(21);
        mascotaPropia.setIdUsuario(8);
        mascotaPropia.setNombre("Luna");
        when(mascotaRepository.findByIdUsuario(8)).thenReturn(List.of(mascotaPropia));
        when(mascotaRepository.findByIdMascotaAndIdUsuario(99, 8)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/mascotas").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].idUsuario").value(8));
        mockMvc.perform(get("/api/mascotas/99").header("Authorization", bearer(token)))
                .andExpect(status().isNotFound());

        verify(mascotaRepository, never()).findAll();
        verify(mascotaRepository).findByIdMascotaAndIdUsuario(99, 8);
    }

    @Test
    void clienteNoPuedeAsignarMascotaAOtroUsuarioNiCambiarPropietarioAlEditar() throws Exception {
        String token = token(8, Rol.CLIENTE);
        when(mascotaRepository.save(any(Mascota.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mascotaRepository.findByIdMascotaAndIdUsuario(21, 8))
                .thenAnswer(invocation -> Optional.of(mascota(21, 8)));

        mockMvc.perform(post("/api/mascotas").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idUsuario\":999,\"nombre\":\"Luna\",\"tipo\":\"Perro\",\"raza\":\"Mestiza\",\"sexo\":\"Hembra\",\"edad\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.idUsuario").value(8));

        mockMvc.perform(put("/api/mascotas/21").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idUsuario\":999,\"nombre\":\"Luna actualizada\",\"tipo\":\"Perro\",\"raza\":\"Mestiza\",\"sexo\":\"Hembra\",\"edad\":4}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.idUsuario").value(8));
    }

    @Test
    void clienteFiltraCitasYPagosYNoPuedeCrearConRelacionesAjena() throws Exception {
        String token = token(8, Rol.CLIENTE);
        Cita cita = new Cita();
        cita.setIdCita(31);
        cita.setIdMascota(21);
        Pago pago = new Pago();
        pago.setIdPago(41);
        pago.setIdCita(31);
        when(citaRepository.findAllByUsuarioId(8)).thenReturn(List.of(cita));
        when(pagoRepository.findAllByUsuarioId(8)).thenReturn(List.of(pago));
        when(citaRepository.findByIdCitaAndUsuarioId(99, 8)).thenReturn(Optional.empty());
        when(pagoRepository.findByIdPagoAndUsuarioId(99, 8)).thenReturn(Optional.empty());
        when(mascotaRepository.existsByIdMascotaAndIdUsuario(99, 8)).thenReturn(false);
        when(citaRepository.existsByIdCitaAndUsuarioId(99, 8)).thenReturn(false);

        mockMvc.perform(get("/api/citas").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].idCita").value(31));
        mockMvc.perform(get("/api/pagos").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].idPago").value(41));
        mockMvc.perform(get("/api/citas/99").header("Authorization", bearer(token)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/pagos/99").header("Authorization", bearer(token)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/citas").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idMascota\":99,\"idVeterinario\":1,\"idServicio\":1,\"fecha\":\"2026-10-01\",\"hora\":\"10:00:00\",\"estado\":\"Pendiente\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/pagos").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idCita\":99,\"modalidad\":\"online\",\"metodo\":\"tarjeta\",\"monto\":80,\"estado\":\"pendiente\"}"))
                .andExpect(status().isNotFound());

        verify(citaRepository, never()).findAll();
        verify(pagoRepository, never()).findAll();
        verify(citaRepository, never()).save(any(Cita.class));
        verify(pagoRepository, never()).save(any(Pago.class));
    }

    @Test
    void adminPuedeConsultarYGestionarLosCrudAdministrativos() throws Exception {
        String token = token(6, Rol.ADMIN);
        when(usuarioRepository.findAll()).thenReturn(List.of(usuario(6, Rol.ADMIN)));
        when(mascotaRepository.findAll()).thenReturn(List.of(mascota(21, 8)));
        when(citaRepository.findAll()).thenReturn(List.of(new Cita()));
        when(pagoRepository.findAll()).thenReturn(List.of(new Pago()));
        when(veterinarioRepository.findAll()).thenReturn(List.of(new Veterinario()));
        when(servicioRepository.findAll()).thenReturn(List.of(new Servicio()));
        when(servicioRepository.save(any(Servicio.class))).thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(get("/api/usuarios").header("Authorization", bearer(token))).andExpect(status().isOk());
        mockMvc.perform(get("/api/mascotas").header("Authorization", bearer(token))).andExpect(status().isOk());
        mockMvc.perform(get("/api/citas").header("Authorization", bearer(token))).andExpect(status().isOk());
        mockMvc.perform(get("/api/pagos").header("Authorization", bearer(token))).andExpect(status().isOk());
        mockMvc.perform(post("/api/servicios").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Consulta\",\"descripcion\":\"General\",\"precio\":80,\"duracionMinutos\":30}"))
                .andExpect(status().isOk());
    }

    @Test
    void adminPuedeActualizarYEliminarRegistrosDeTodosLosCrud() throws Exception {
        String token = token(6, Rol.ADMIN);
        when(usuarioRepository.findById(6)).thenReturn(Optional.of(usuario(6, Rol.ADMIN)));
        when(usuarioRepository.existsById(6)).thenReturn(true);
        when(mascotaRepository.findById(21)).thenReturn(Optional.of(mascota(21, 8)));
        when(citaRepository.findById(31)).thenReturn(Optional.of(new Cita()));
        when(pagoRepository.findById(41)).thenReturn(Optional.of(new Pago()));
        when(veterinarioRepository.findById(61)).thenReturn(Optional.of(new Veterinario()));
        when(veterinarioRepository.existsById(61)).thenReturn(true);
        when(servicioRepository.findById(51)).thenReturn(Optional.of(new Servicio()));
        when(servicioRepository.existsById(51)).thenReturn(true);

        mockMvc.perform(put("/api/usuarios/6").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Nicolas\",\"apellido\":\"Suarez\",\"correo\":\"nicolas@vitavet.test\",\"telefono\":\"999999999\",\"rol\":\"ADMIN\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/mascotas/21").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idUsuario\":8,\"nombre\":\"Luna\",\"tipo\":\"Perro\",\"raza\":\"Mestiza\",\"sexo\":\"Hembra\",\"edad\":4}"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/citas/31").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idMascota\":21,\"idVeterinario\":1,\"idServicio\":1,\"fecha\":\"2026-10-01\",\"hora\":\"10:00:00\",\"estado\":\"Confirmada\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/pagos/41").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idCita\":31,\"modalidad\":\"online\",\"metodo\":\"tarjeta\",\"monto\":80,\"estado\":\"pagado\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/veterinarios/61").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Ana\",\"apellido\":\"Vega\",\"especialidad\":\"General\",\"correo\":\"ana@vitavet.test\",\"telefono\":\"999999999\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/servicios/51").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Consulta\",\"descripcion\":\"General\",\"precio\":80,\"duracionMinutos\":30}"))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/usuarios/6").header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/mascotas/21").header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/citas/31").header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/pagos/41").header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/veterinarios/61").header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/servicios/51").header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
    }

    private String token(Integer userId, Rol rol) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(userId.toString())
                .issuedAt(now)
                .expiresAt(now.plusSeconds(600))
                .claim("correo", "usuario" + userId + "@vitavet.test")
                .claim("rol", rol.name())
                .build();
        return jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private Usuario usuario(Integer id, Rol rol) {
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(id);
        usuario.setNombre("Usuario");
        usuario.setApellido("Prueba");
        usuario.setCorreo("usuario" + id + "@vitavet.test");
        usuario.setPassword("hash-no-expuesto");
        usuario.setTelefono("999999999");
        usuario.setRol(rol);
        return usuario;
    }

    private Mascota mascota(Integer idMascota, Integer idUsuario) {
        Mascota mascota = new Mascota();
        mascota.setIdMascota(idMascota);
        mascota.setIdUsuario(idUsuario);
        mascota.setNombre("Luna");
        mascota.setTipo("Perro");
        mascota.setRaza("Mestiza");
        mascota.setSexo("Hembra");
        mascota.setEdad(3);
        return mascota;
    }
}
