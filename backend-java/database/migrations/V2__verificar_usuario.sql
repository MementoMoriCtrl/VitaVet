-- CONSULTAS DE LECTURA Y PROCEDIMIENTOS COMENTADOS. No aplicar cambios desde aqui.
-- Mantenga UNA MISMA conexion Workbench desde BASELINE hasta finalizar las
-- verificaciones: las tablas temporales no sobreviven al cierre de conexion.
-- V2 y V3 contienen ALTER TABLE, que hace COMMIT implicito en MySQL y no puede
-- revertirse con ROLLBACK. Nunca ejecute V3 automaticamente despues del backfill.

-- RESPALDO (instrucciones comentadas; este archivo no crea ni verifica un dump):
-- Confirme que las tablas son InnoDB antes de usar --single-transaction.
-- Use una carpeta local y un nombre nuevo; no reemplace archivos existentes:
-- $dir = Join-Path $env:USERPROFILE 'VitaVetBackups'
-- New-Item -ItemType Directory -Path $dir -Force | Out-Null
-- $backup = Join-Path $dir ("vitavet_{0}.sql" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
-- if (Test-Path $backup) { throw "El respaldo ya existe; no se sobrescribira." }
-- mysqldump --host=127.0.0.1 --port=3306 --user=TU_USUARIO --password --single-transaction --quick --routines --triggers --events vitavet --result-file="$backup"
-- if ($LASTEXITCODE -ne 0) { throw "Falló mysqldump." }
-- Get-Item $backup | Select-Object FullName, Length, LastWriteTime
-- Get-FileHash $backup -Algorithm SHA256
-- --password solicita la clave; no la escriba en el comando ni en el historial.
-- Pruebe la restauracion en un esquema NUEVO y aislado, por ejemplo
-- vitavet_restore_test, con Workbench: Server > Data Import > Import from
-- Self-Contained File. Seleccione el dump y el esquema aislado como destino.
-- Compare alli tablas, conteos, IDs, roles y relaciones. Nunca importe como
-- prueba sobre vitavet: el dump puede contener DROP/CREATE y sobrescribir datos.
-- Una restauracion activa requiere un procedimiento aparte, con la aplicacion
-- detenida y despues de validar el dump aislado.

-- =====================================================================
-- SECCION A: BASELINE ANTES DEL BACKFILL (V2 INICIAL YA APLICADA)
-- No volver a ejecutar V2 inicial. Capturar estos baselines antes del backfill.
-- Revise manualmente todos los resultados antes de llamar al procedimiento:
-- * servidor, puerto y version deben ser el destino autorizado (MySQL 8.0.46);
-- * esquema objetivo vitavet; las tres columnas destino y chk_usuario_estado existen;
-- * usuario y mascota InnoDB, y triggers revisados;
-- * total_usuarios_baseline = 7 e ids_no_incluidos_en_lista_aprobada = 0;
-- * la lista esperada debe devolver exactamente siete filas, todas OK:
--   IDs 1,2,3,5,8,9 CLIENTE y 7 ADMIN;
-- * usuarios_baseline debe ser 7; conserve la lista id_mascota/id_usuario
--   que sigue como baseline de relaciones.
-- Estas consultas solo muestran resultados: no detienen el backfill automaticamente.
-- La persona que revisa decide manualmente si se cumplen las precondiciones.
-- =====================================================================

SELECT DATABASE() AS esquema_seleccionado,
       @@hostname AS servidor,
       @@port AS puerto,
       VERSION() AS version_mysql;

-- Debe mostrar el servidor/puerto confirmados y MySQL 8.0.46.
-- Debe ser vitavet el esquema objetivo, aunque la conexion seleccione otro.

-- Debe devolver 3: V2 inicial ya agrego las columnas.
SELECT COUNT(*) AS columnas_destino_encontradas
FROM `information_schema`.`COLUMNS`
WHERE `TABLE_SCHEMA` = 'vitavet'
  AND `TABLE_NAME` = 'usuario'
  AND `COLUMN_NAME` IN ('dni', 'nombre_usuario', 'estado');

-- Debe devolver 1: V2 inicial ya agrego esta restriccion.
SELECT COUNT(*) AS constraint_estado_encontrada
FROM `information_schema`.`TABLE_CONSTRAINTS`
WHERE `CONSTRAINT_SCHEMA` = 'vitavet'
  AND `TABLE_NAME` = 'usuario'
  AND `CONSTRAINT_NAME` = 'chk_usuario_estado';

-- usuario y mascota deben ser InnoDB para transacciones y SELECT FOR UPDATE.
SELECT `TABLE_NAME`, `ENGINE`
FROM `information_schema`.`TABLES`
WHERE `TABLE_SCHEMA` = 'vitavet'
  AND `TABLE_NAME` IN ('usuario', 'mascota')
ORDER BY `TABLE_NAME`;

-- Inspeccione triggers. No continue con el backfill hasta conocer sus efectos.
SELECT `TRIGGER_NAME`, `ACTION_TIMING`, `EVENT_MANIPULATION`, `ACTION_STATEMENT`
FROM `information_schema`.`TRIGGERS`
WHERE `TRIGGER_SCHEMA` = 'vitavet'
  AND `EVENT_OBJECT_TABLE` = 'usuario';

SHOW CREATE TABLE `vitavet`.`usuario`;

-- Baseline: deben ser exactamente siete usuarios y los IDs/roles listados.
-- No seleccionar ni exportar la columna password.
SELECT COUNT(*) AS total_usuarios_baseline
FROM `vitavet`.`usuario`;

SELECT `id_usuario`, `rol`
FROM `vitavet`.`usuario`
ORDER BY `id_usuario`;

-- Debe devolver 0 usuarios fuera de la lista aprobada.
SELECT COUNT(*) AS ids_no_incluidos_en_lista_aprobada
FROM `vitavet`.`usuario`
WHERE `id_usuario` NOT IN (1, 2, 3, 5, 7, 8, 9);

-- Debe devolver siete filas, cada una con validacion = OK.
SELECT esperado.`id_usuario`,
       esperado.`rol` AS rol_esperado,
       actual.`rol` AS rol_actual,
       CASE WHEN actual.`id_usuario` IS NOT NULL
                  AND actual.`rol` = esperado.`rol`
            THEN 'OK' ELSE 'DETENER' END AS validacion
FROM (
    SELECT 1 AS `id_usuario`, 'CLIENTE' AS `rol`
    UNION ALL SELECT 2, 'CLIENTE'
    UNION ALL SELECT 3, 'CLIENTE'
    UNION ALL SELECT 5, 'CLIENTE'
    UNION ALL SELECT 7, 'ADMIN'
    UNION ALL SELECT 8, 'CLIENTE'
    UNION ALL SELECT 9, 'CLIENTE'
) AS esperado
LEFT JOIN `vitavet`.`usuario` actual
    ON actual.`id_usuario` = esperado.`id_usuario`
ORDER BY esperado.`id_usuario`;

-- Captura IDs/roles y relaciones mascota-usuario para comparar despues.
-- CREATE TEMPORARY TABLE no hace COMMIT implicito en MySQL 8.0. Use una conexion
-- nueva si estos nombres ya existen; no borre ni reemplace un baseline existente.
CREATE TEMPORARY TABLE `vitavet_baseline_usuario` ENGINE=InnoDB AS
SELECT `id_usuario`, `rol`
FROM `vitavet`.`usuario`;

CREATE TEMPORARY TABLE `vitavet_baseline_mascota` ENGINE=InnoDB AS
SELECT `id_mascota`, `id_usuario`
FROM `vitavet`.`mascota`;

-- Copias del mismo snapshot para comparar altas y bajas dentro de una consulta.
-- MySQL no permite reabrir una tabla TEMPORARY con multiples referencias en la
-- misma sentencia, por eso cada lado de la comparacion usa una tabla distinta.
CREATE TEMPORARY TABLE `vitavet_baseline_usuario_altas` ENGINE=InnoDB AS
SELECT `id_usuario`, `rol`
FROM `vitavet_baseline_usuario`;

CREATE TEMPORARY TABLE `vitavet_baseline_usuario_validacion` ENGINE=InnoDB AS
SELECT `id_usuario`, `rol`
FROM `vitavet_baseline_usuario`;

CREATE TEMPORARY TABLE `vitavet_baseline_usuario_validacion_altas` ENGINE=InnoDB AS
SELECT `id_usuario`, `rol`
FROM `vitavet_baseline_usuario`;

CREATE TEMPORARY TABLE `vitavet_baseline_mascota_altas` ENGINE=InnoDB AS
SELECT `id_mascota`, `id_usuario`
FROM `vitavet_baseline_mascota`;

SELECT COUNT(*) AS usuarios_baseline,
       COUNT(DISTINCT `id_usuario`) AS ids_distintos_baseline
FROM `vitavet_baseline_usuario`;
SELECT COUNT(*) AS mascotas_baseline FROM `vitavet_baseline_mascota`;
SELECT `id_mascota`, `id_usuario`
FROM `vitavet_baseline_mascota`
ORDER BY `id_mascota`;

-- Debe devolver cero filas: el baseline debe contener exactamente los siete
-- IDs y roles aprobados, sin usuarios faltantes, adicionales ni rol incorrecto.
SELECT b.`id_usuario`,
       b.`rol` AS rol_baseline,
       esperado.`rol` AS rol_esperado,
       'BASELINE_ADICIONAL_O_ROL_INCORRECTO' AS diferencia
FROM (
    SELECT `id_usuario`,
           `rol`,
           COUNT(*) OVER (PARTITION BY `id_usuario`) AS filas_por_id
    FROM `vitavet_baseline_usuario_validacion`
) b
LEFT JOIN (
    SELECT 1 AS `id_usuario`, 'CLIENTE' AS `rol`
    UNION ALL SELECT 2, 'CLIENTE'
    UNION ALL SELECT 3, 'CLIENTE'
    UNION ALL SELECT 5, 'CLIENTE'
    UNION ALL SELECT 7, 'ADMIN'
    UNION ALL SELECT 8, 'CLIENTE'
    UNION ALL SELECT 9, 'CLIENTE'
) AS esperado ON esperado.`id_usuario` = b.`id_usuario`
WHERE esperado.`id_usuario` IS NULL
   OR b.`filas_por_id` <> 1
   OR NOT (b.`rol` <=> esperado.`rol`)
UNION ALL
SELECT esperado.`id_usuario`,
       b.`rol` AS rol_baseline,
       esperado.`rol` AS rol_esperado,
       'BASELINE_ESPERADO_AUSENTE_O_ROL_INCORRECTO' AS diferencia
FROM (
    SELECT 1 AS `id_usuario`, 'CLIENTE' AS `rol`
    UNION ALL SELECT 2, 'CLIENTE'
    UNION ALL SELECT 3, 'CLIENTE'
    UNION ALL SELECT 5, 'CLIENTE'
    UNION ALL SELECT 7, 'ADMIN'
    UNION ALL SELECT 8, 'CLIENTE'
    UNION ALL SELECT 9, 'CLIENTE'
) AS esperado
LEFT JOIN `vitavet_baseline_usuario_validacion_altas` b
    ON b.`id_usuario` = esperado.`id_usuario`
WHERE b.`id_usuario` IS NULL
   OR NOT (b.`rol` <=> esperado.`rol`);

-- =====================================================================
-- SECCION B: DESPUES DE V2 INICIAL, ANTES DEL BACKFILL
-- Requiere la MISMA conexion que creo las tablas temporales de baseline.
-- =====================================================================

-- Debe devolver 3: las tres columnas destino existen.
SELECT COUNT(*) AS columnas_destino_encontradas
FROM `information_schema`.`COLUMNS`
WHERE `TABLE_SCHEMA` = 'vitavet'
  AND `TABLE_NAME` = 'usuario'
  AND `COLUMN_NAME` IN ('dni', 'nombre_usuario', 'estado');

-- Debe devolver 1: la restriccion CHECK existe.
SELECT COUNT(*) AS constraint_estado_encontrada
FROM `information_schema`.`TABLE_CONSTRAINTS`
WHERE `CONSTRAINT_SCHEMA` = 'vitavet'
  AND `TABLE_NAME` = 'usuario'
  AND `CONSTRAINT_NAME` = 'chk_usuario_estado'
  AND `CONSTRAINT_TYPE` = 'CHECK';

-- Debe devolver 7 usuarios, roles sin cambios y todos en ACTIVO.
SELECT COUNT(*) AS total_usuarios_actual,
       (SELECT COUNT(*) FROM `vitavet_baseline_usuario`) AS total_usuarios_baseline
FROM `vitavet`.`usuario`;

-- Debe devolver cero filas: usuarios eliminados o con cambio de rol.
SELECT b.`id_usuario`,
       b.`rol` AS rol_baseline,
       u.`rol` AS rol_actual
FROM `vitavet_baseline_usuario` b
LEFT JOIN `vitavet`.`usuario` u ON u.`id_usuario` = b.`id_usuario`
WHERE u.`id_usuario` IS NULL OR NOT (u.`rol` <=> b.`rol`);

-- Debe devolver cero filas: usuarios agregados desde el baseline.
SELECT u.`id_usuario`, u.`rol` AS rol_actual
FROM `vitavet`.`usuario` u
LEFT JOIN `vitavet_baseline_usuario` b ON b.`id_usuario` = u.`id_usuario`
WHERE b.`id_usuario` IS NULL;

SELECT `id_usuario`, `dni`, `nombre_usuario`, `rol`, `estado`
FROM `vitavet`.`usuario`
ORDER BY `id_usuario`;

-- Debe devolver 7: ambos identificadores siguen NULL antes del backfill.
SELECT COUNT(*) AS filas_con_identificadores_ambos_null
FROM `vitavet`.`usuario`
WHERE `dni` IS NULL
  AND `nombre_usuario` IS NULL;

-- Debe devolver cero filas: mascotas eliminadas o reasignadas.
SELECT b.`id_mascota`,
       b.`id_usuario` AS usuario_baseline,
       m.`id_usuario` AS usuario_actual
FROM `vitavet_baseline_mascota` b
LEFT JOIN `vitavet`.`mascota` m ON m.`id_mascota` = b.`id_mascota`
WHERE m.`id_mascota` IS NULL
   OR NOT (m.`id_usuario` <=> b.`id_usuario`);

-- Debe devolver cero filas: mascotas agregadas desde el baseline.
SELECT m.`id_mascota`, m.`id_usuario` AS usuario_actual
FROM `vitavet`.`mascota` m
LEFT JOIN `vitavet_baseline_mascota` b ON b.`id_mascota` = m.`id_mascota`
WHERE b.`id_mascota` IS NULL;

-- =====================================================================
-- SECCION C: DESPUES DEL BACKFILL, ANTES DE COMMIT
-- Ejecutar en la misma conexion/transaccion del backfill.
-- Cualquier diferencia implica ROLLBACK; V3 no se ejecuta automaticamente.
-- =====================================================================

SELECT COUNT(*) AS total_usuarios_actual,
       (SELECT COUNT(*) FROM `vitavet_baseline_usuario`) AS total_usuarios_baseline
FROM `vitavet`.`usuario`;

-- Debe devolver cero filas: usuarios eliminados o con cambio de rol.
SELECT b.`id_usuario`,
       b.`rol` AS rol_baseline,
       u.`rol` AS rol_actual
FROM `vitavet_baseline_usuario` b
LEFT JOIN `vitavet`.`usuario` u ON u.`id_usuario` = b.`id_usuario`
WHERE u.`id_usuario` IS NULL OR NOT (u.`rol` <=> b.`rol`);

-- Debe devolver cero filas: usuarios agregados desde el baseline.
SELECT u.`id_usuario`, u.`rol` AS rol_actual
FROM `vitavet`.`usuario` u
LEFT JOIN `vitavet_baseline_usuario` b ON b.`id_usuario` = u.`id_usuario`
WHERE b.`id_usuario` IS NULL;

-- Debe devolver los siete IDs aprobados, con el rol esperado y estado ACTIVO.
SELECT `id_usuario`, `dni`, `nombre_usuario`, `rol`, `estado`
FROM `vitavet`.`usuario`
ORDER BY `id_usuario`;

-- Debe devolver cero: verifica IDs, rol, estado e identificadores ficticios
-- esperados por fila; tambien detecta cualquier cuenta esperada ausente.
SELECT COUNT(*) AS identidades_esperadas_faltantes_o_incompatibles
FROM (
    SELECT 1 AS `id_usuario`, 'CLIENTE' AS `rol`,
           'TEST-VV-0000000001' AS `dni`, 'test_vitavet_0000000001' AS `nombre_usuario`
    UNION ALL SELECT 2, 'CLIENTE', 'TEST-VV-0000000002', 'test_vitavet_0000000002'
    UNION ALL SELECT 3, 'CLIENTE', 'TEST-VV-0000000003', 'test_vitavet_0000000003'
    UNION ALL SELECT 5, 'CLIENTE', 'TEST-VV-0000000005', 'test_vitavet_0000000005'
    UNION ALL SELECT 7, 'ADMIN',   'TEST-VV-0000000007', 'test_vitavet_0000000007'
    UNION ALL SELECT 8, 'CLIENTE', 'TEST-VV-0000000008', 'test_vitavet_0000000008'
    UNION ALL SELECT 9, 'CLIENTE', 'TEST-VV-0000000009', 'test_vitavet_0000000009'
) AS esperado
LEFT JOIN `vitavet`.`usuario` u ON u.`id_usuario` = esperado.`id_usuario`
WHERE u.`id_usuario` IS NULL
   OR NOT (u.`rol` <=> esperado.`rol`)
   OR NOT (u.`estado` <=> 'ACTIVO')
   OR NOT (u.`dni` <=> esperado.`dni`)
   OR NOT (u.`nombre_usuario` <=> esperado.`nombre_usuario`);

-- Debe devolver 0.
SELECT COUNT(*) AS filas_con_dni_o_usuario_vacio
FROM `vitavet`.`usuario`
WHERE `dni` IS NULL OR TRIM(`dni`) = ''
   OR `nombre_usuario` IS NULL OR TRIM(`nombre_usuario`) = '';

-- Las consultas de duplicados deben devolver cero filas.
SELECT `dni`, COUNT(*) AS cantidad
FROM `vitavet`.`usuario`
WHERE `dni` IS NOT NULL
GROUP BY `dni`
HAVING COUNT(*) > 1;

SELECT `nombre_usuario`, COUNT(*) AS cantidad
FROM `vitavet`.`usuario`
WHERE `nombre_usuario` IS NOT NULL
GROUP BY `nombre_usuario`
HAVING COUNT(*) > 1;

SELECT `estado`, COUNT(*) AS cantidad
FROM `vitavet`.`usuario`
GROUP BY `estado`
ORDER BY `estado`;

SELECT `rol`, COUNT(*) AS cantidad
FROM `vitavet`.`usuario`
GROUP BY `rol`
ORDER BY `rol`;

-- Debe devolver cero filas: mascotas eliminadas o reasignadas.
SELECT b.`id_mascota`,
       b.`id_usuario` AS usuario_baseline,
       m.`id_usuario` AS usuario_actual
FROM `vitavet_baseline_mascota` b
LEFT JOIN `vitavet`.`mascota` m ON m.`id_mascota` = b.`id_mascota`
WHERE m.`id_mascota` IS NULL
   OR NOT (m.`id_usuario` <=> b.`id_usuario`);

-- Debe devolver cero filas: mascotas agregadas desde el baseline.
SELECT m.`id_mascota`, m.`id_usuario` AS usuario_actual
FROM `vitavet`.`mascota` m
LEFT JOIN `vitavet_baseline_mascota` b ON b.`id_mascota` = m.`id_mascota`
WHERE b.`id_mascota` IS NULL;

SELECT COUNT(*) AS total_mascotas_actual,
       (SELECT COUNT(*) FROM `vitavet_baseline_mascota`) AS total_mascotas_baseline
FROM `vitavet`.`mascota`;

SELECT COUNT(*) AS mascotas_huerfanas
FROM `vitavet`.`mascota` m
LEFT JOIN `vitavet`.`usuario` u ON u.`id_usuario` = m.`id_usuario`
WHERE u.`id_usuario` IS NULL;

-- =====================================================================
-- SECCION D: ANTES DE V3, DESPUES DE COMMIT DEL BACKFILL
-- Ejecutar manualmente en la misma conexion con baseline; debe validar cero
-- vacios/duplicados y confirmar que los indices uq_* aun no existen.
-- Las consultas muestran resultados, pero NO abortan V3 automaticamente.
-- Revise preparacion_para_v3 = 1 y todos los contadores de error = 0.
-- La decision de ejecutar V3 es manual; cualquier resultado inesperado implica
-- detenerse y no ejecutar V3 hasta resolverlo.
-- =====================================================================

SELECT `INDEX_NAME`, COUNT(*) AS partes_indice
FROM `information_schema`.`STATISTICS`
WHERE `TABLE_SCHEMA` = 'vitavet'
  AND `TABLE_NAME` = 'usuario'
  AND `INDEX_NAME` IN ('uq_usuario_dni', 'uq_usuario_nombre_usuario')
GROUP BY `INDEX_NAME`;

SELECT COUNT(*) AS dni_fuera_de_longitud
FROM `vitavet`.`usuario`
WHERE `dni` IS NOT NULL AND CHAR_LENGTH(`dni`) > 20;

SELECT COUNT(*) AS nombre_usuario_fuera_de_longitud
FROM `vitavet`.`usuario`
WHERE `nombre_usuario` IS NOT NULL AND CHAR_LENGTH(`nombre_usuario`) > 50;

-- Resumen previo a NOT NULL/UNIQUE. Debe mostrar preparacion_para_v3 = 1.
-- No aplica restricciones ni aborta V3 automaticamente.
SELECT
    metricas.*,
    CASE
        WHEN metricas.total_usuarios = 7
         AND metricas.dni_null_o_vacio = 0
         AND metricas.nombre_usuario_null_o_vacio = 0
         AND metricas.grupos_dni_duplicados = 0
         AND metricas.grupos_nombre_usuario_duplicados = 0
         AND metricas.valores_fuera_de_longitud = 0
         AND metricas.cuentas_esperadas_incompatibles = 0
         AND metricas.baseline_usuario_invalido = 0
         AND metricas.diferencias_baseline_usuario = 0
         AND metricas.diferencias_baseline_mascota = 0
         AND metricas.mascotas_huerfanas = 0
         AND metricas.indices_unicos_ya_existentes = 0
        THEN 1 ELSE 0
    END AS preparacion_para_v3
FROM (
    SELECT
        (SELECT COUNT(*) FROM `vitavet`.`usuario`) AS total_usuarios,
        (SELECT COUNT(*) FROM `vitavet`.`usuario`
         WHERE `dni` IS NULL OR TRIM(`dni`) = '') AS dni_null_o_vacio,
        (SELECT COUNT(*) FROM `vitavet`.`usuario`
         WHERE `nombre_usuario` IS NULL OR TRIM(`nombre_usuario`) = '') AS nombre_usuario_null_o_vacio,
        (
            SELECT COUNT(*)
            FROM (
                SELECT `dni`
                FROM `vitavet`.`usuario`
                GROUP BY `dni`
                HAVING COUNT(*) > 1
            ) AS repetidos_dni
        ) AS grupos_dni_duplicados,
        (
            SELECT COUNT(*)
            FROM (
                SELECT `nombre_usuario`
                FROM `vitavet`.`usuario`
                GROUP BY `nombre_usuario`
                HAVING COUNT(*) > 1
            ) AS repetidos_username
        ) AS grupos_nombre_usuario_duplicados,
        (
            SELECT COUNT(*)
            FROM `vitavet`.`usuario`
            WHERE CHAR_LENGTH(`dni`) > 20
               OR CHAR_LENGTH(`nombre_usuario`) > 50
        ) AS valores_fuera_de_longitud,
        (
            SELECT COUNT(*)
            FROM (
                SELECT 1 AS `id_usuario`, 'CLIENTE' AS `rol`,
                       'TEST-VV-0000000001' AS `dni`, 'test_vitavet_0000000001' AS `nombre_usuario`
                UNION ALL SELECT 2, 'CLIENTE', 'TEST-VV-0000000002', 'test_vitavet_0000000002'
                UNION ALL SELECT 3, 'CLIENTE', 'TEST-VV-0000000003', 'test_vitavet_0000000003'
                UNION ALL SELECT 5, 'CLIENTE', 'TEST-VV-0000000005', 'test_vitavet_0000000005'
                UNION ALL SELECT 7, 'ADMIN',   'TEST-VV-0000000007', 'test_vitavet_0000000007'
                UNION ALL SELECT 8, 'CLIENTE', 'TEST-VV-0000000008', 'test_vitavet_0000000008'
                UNION ALL SELECT 9, 'CLIENTE', 'TEST-VV-0000000009', 'test_vitavet_0000000009'
            ) AS esperado
            LEFT JOIN `vitavet`.`usuario` u ON u.`id_usuario` = esperado.`id_usuario`
            WHERE u.`id_usuario` IS NULL
               OR NOT (u.`rol` <=> esperado.`rol`)
               OR NOT (u.`estado` <=> 'ACTIVO')
               OR NOT (u.`dni` <=> esperado.`dni`)
               OR NOT (u.`nombre_usuario` <=> esperado.`nombre_usuario`)
        ) AS cuentas_esperadas_incompatibles,
        (
            (SELECT COUNT(*)
             FROM (
                SELECT b.`id_usuario`
                FROM (
                    SELECT `id_usuario`,
                           `rol`,
                           COUNT(*) OVER (PARTITION BY `id_usuario`) AS filas_por_id
                    FROM `vitavet_baseline_usuario_validacion`
                ) b
                LEFT JOIN (
                    SELECT 1 AS `id_usuario`, 'CLIENTE' AS `rol`
                    UNION ALL SELECT 2, 'CLIENTE'
                    UNION ALL SELECT 3, 'CLIENTE'
                    UNION ALL SELECT 5, 'CLIENTE'
                    UNION ALL SELECT 7, 'ADMIN'
                    UNION ALL SELECT 8, 'CLIENTE'
                    UNION ALL SELECT 9, 'CLIENTE'
                ) AS esperado ON esperado.`id_usuario` = b.`id_usuario`
                WHERE esperado.`id_usuario` IS NULL
                   OR b.`filas_por_id` <> 1
                   OR NOT (b.`rol` <=> esperado.`rol`)
                UNION ALL
                SELECT esperado.`id_usuario`
                FROM (
                    SELECT 1 AS `id_usuario`, 'CLIENTE' AS `rol`
                    UNION ALL SELECT 2, 'CLIENTE'
                    UNION ALL SELECT 3, 'CLIENTE'
                    UNION ALL SELECT 5, 'CLIENTE'
                    UNION ALL SELECT 7, 'ADMIN'
                    UNION ALL SELECT 8, 'CLIENTE'
                    UNION ALL SELECT 9, 'CLIENTE'
                ) AS esperado
                LEFT JOIN `vitavet_baseline_usuario_validacion_altas` b
                    ON b.`id_usuario` = esperado.`id_usuario`
                WHERE b.`id_usuario` IS NULL
                   OR NOT (b.`rol` <=> esperado.`rol`)
             ) AS diferencias_baseline_esperado)
        ) AS baseline_usuario_invalido,
        (
            (SELECT COUNT(*)
             FROM `vitavet_baseline_usuario` b
             LEFT JOIN `vitavet`.`usuario` u ON u.`id_usuario` = b.`id_usuario`
             WHERE u.`id_usuario` IS NULL OR NOT (u.`rol` <=> b.`rol`))
            +
            (SELECT COUNT(*)
             FROM `vitavet`.`usuario` u
             LEFT JOIN `vitavet_baseline_usuario_altas` b ON b.`id_usuario` = u.`id_usuario`
             WHERE b.`id_usuario` IS NULL)
        ) AS diferencias_baseline_usuario,
        (
            (SELECT COUNT(*)
             FROM `vitavet_baseline_mascota` b
             LEFT JOIN `vitavet`.`mascota` m
                 ON m.`id_mascota` = b.`id_mascota`
             WHERE m.`id_mascota` IS NULL
                OR NOT (m.`id_usuario` <=> b.`id_usuario`))
            +
            (SELECT COUNT(*)
             FROM `vitavet`.`mascota` m
             LEFT JOIN `vitavet_baseline_mascota_altas` b
                 ON b.`id_mascota` = m.`id_mascota`
             WHERE b.`id_mascota` IS NULL)
        ) AS diferencias_baseline_mascota,
        (
            SELECT COUNT(*)
            FROM `vitavet`.`mascota` m
            LEFT JOIN `vitavet`.`usuario` u
                ON u.`id_usuario` = m.`id_usuario`
            WHERE u.`id_usuario` IS NULL
        ) AS mascotas_huerfanas,
        (
            SELECT COUNT(*)
            FROM `information_schema`.`STATISTICS`
            WHERE `TABLE_SCHEMA` = 'vitavet'
              AND `TABLE_NAME` = 'usuario'
              AND `INDEX_NAME` IN ('uq_usuario_dni', 'uq_usuario_nombre_usuario')
        ) AS indices_unicos_ya_existentes
) AS metricas;

SHOW CREATE TABLE `vitavet`.`usuario`;
