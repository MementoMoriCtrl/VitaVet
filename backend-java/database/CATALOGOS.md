# Catálogos de tipo de mascota y sexo

## Alcance actual

Solo el módulo administrativo de mascotas utiliza catálogos dinámicos:
- `GET /api/catalogos/tipos-animal`: categoría `tipo_animal`.
- `GET /api/catalogos/sexos`: categoría `sexo`.

Ambos requieren rol ADMIN y devuelven `id`, `categoria` y `etiqueta`.
Los formularios de alta y edición cargan las opciones desde el backend,
preseleccionan el valor existente y bloquean Guardar si falla la carga.
Las columnas originales siguen siendo texto: se muestra y envía la etiqueta.
El backend valida su pertenencia al catálogo al crear y editar mascotas.

Especialidad veterinaria vuelve a ser texto libre obligatorio, con máximo 100
caracteres en el formulario y precarga del texto existente al editar.
No consulta catálogos en frontend ni backend. El GET de especialidades fue
retirado. Su coincidencia en SecurityConfig permanece sin cambios y no expone
ningún controlador; una petición ADMIN recibe 404.

## Base de datos existente

Según la confirmación del usuario, `vitavet.catalogo_opcion` ya existe y contiene
24 opciones. Esta revisión no consulta ni cambia MySQL. Las filas de especialidad
permanecen en la tabla, aunque el módulo veterinario ya no las utiliza.

**No volver a ejecutar V4 ni las migraciones anteriores. No crear V5.**
V4 se conserva intacta como historial. No se modifica el esquema, no se elimina
la tabla y no se alteran registros. El proyecto conserva `ddl-auto=none`.
No hay cambios en usuarios, autenticación, autorización, citas, pagos o servicios.

## Verificación automatizada sin MySQL

Desde `backend-java`, ejecutar solo las pruebas con repositorios simulados:

```powershell
.\mvnw.cmd '-Dtest=AuthorizationIntegrationTest,AuthServiceTest,RegistroServiceTest,CatalogoServiceTest' test
```

No ejecutar `BackendApplicationTests` ni la suite completa para esta revisión:
contiene consultas reales a MySQL. Desde la raíz, ejecutar las pruebas Node de
`frontend/tests`, comprobar la sintaxis JavaScript y `git diff --check`.

## Verificación manual pendiente (a cargo del usuario)

1. Reiniciar Spring Boot y abrir con Live Server `admin.html?seccion=mascotas`
   con una sesión ADMIN activa. Crear y editar mascotas, comprobar los dos GET,
   la preselección y los datos después de recargar.
2. En `admin.html?seccion=veterinarios`, crear una especialidad de texto libre,
   editarla y comprobar su precarga. Network no debe mostrar consultas al
   catálogo de especialidades. Comprobar los datos después de recargar.
3. Ante un fallo de carga de catálogos, mascotas bloquea Guardar y muestra el
   error. Cerrar y abrir permite reintentar; veterinarios no depende de ellos.

Las pruebas con repositorios y fetch simulados no verifican persistencia real.
