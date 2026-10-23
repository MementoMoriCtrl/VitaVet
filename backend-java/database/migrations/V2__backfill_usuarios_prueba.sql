-- Define el procedimiento; crear esta rutina NO ejecuta el backfill.
-- CREATE PROCEDURE es DDL y hace COMMIT implicito. No lo ejecute con una
-- transaccion de usuario abierta. Si la rutina ya existe, detengase e investigue;
-- este archivo no la reemplaza ni la elimina.
--
-- Flujo controlado en Workbench:
-- 1. Cree la rutina en una conexion separada, sin transaccion abierta.
--    CREATE PROCEDURE es DDL con COMMIT implicito y no realiza el backfill.
--    Si la rutina ya existe, detengase; este archivo no la reemplaza.
-- 2. Pause las escrituras de la aplicacion y abra una conexion nueva y dedicada.
--    En ESA MISMA conexion ejecute la seccion A y B de
--    V2__verificar_usuario.sql para capturar y validar los baselines antes de
--    llamar al procedimiento. No cierre ni cambie esa conexion.
-- 3. No reutilice una sesion con cambios pendientes: START TRANSACTION confirma
--    implicitamente una transaccion previa en MySQL. No existe aqui una
--    comprobacion fiable dentro de la rutina para rechazar ese caso. Si no puede
--    garantizar una sesion limpia, no ejecute el CALL.
-- 4. En esa conexion dedicada, ejecute:
--    CALL `vitavet`.`backfill_usuarios_prueba_v2`();
--    Si finaliza normalmente, debe informar filas_actualizadas = 7 y deja abierta
--    la transaccion. No cierre ni cambie la conexion.
-- 5. Antes de confirmar, ejecute la seccion C en esa misma conexion. Solo use
--    consultas y evite DDL u otra sentencia que confirme implicitamente.
--    Si una verificacion falla o es inconclusa, ejecute ROLLBACK manualmente.
-- 6. Si la seccion C pasa, ejecute COMMIT manualmente. Luego ejecute la seccion
--    D (post-COMMIT) antes de considerar V3. Si D falla, detengase y no ejecute
--    V3; el backfill ya confirmado no puede revertirse con ROLLBACK.
-- 7. Si CALL genera un error, el manejador revierte la transaccion y propaga
--    el error. Si se pierde la conexion antes del COMMIT, InnoDB revierte
--    la transaccion abierta al cerrar la sesion.
--
-- IDs/roles confirmados: 1,2,3,5,8,9 CLIENTE; 7 ADMIN.
-- Los valores TEST-VV-* son identificadores ficticios de proyecto, no DNI reales.
-- El UPDATE solo cambia dni y nombre_usuario. No toca IDs, datos personales,
-- contrasenas, telefono, rol, estado ni relaciones con mascotas.
-- No se requiere ni se ejecuta V3 desde este procedimiento.

DELIMITER $$

CREATE PROCEDURE `vitavet`.`backfill_usuarios_prueba_v2`()
SQL SECURITY INVOKER
MODIFIES SQL DATA
BEGIN
    DECLARE v_motor VARCHAR(64) DEFAULT NULL;
    DECLARE v_columnas_destino INT DEFAULT 0;
    DECLARE v_restricciones_estado INT DEFAULT 0;
    DECLARE v_check_estado_valido INT DEFAULT 0;
    DECLARE v_total_usuarios INT DEFAULT 0;
    DECLARE v_ids_roles_validos INT DEFAULT 0;
    DECLARE v_filas_listas INT DEFAULT 0;
    DECLARE v_transaccion_iniciada BOOLEAN DEFAULT FALSE;
    DECLARE v_filas_actualizadas INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        IF v_transaccion_iniciada THEN
            ROLLBACK;
        END IF;
        RESIGNAL;
    END;

    SELECT `ENGINE`
    INTO v_motor
    FROM `information_schema`.`TABLES`
    WHERE `TABLE_SCHEMA` = 'vitavet'
      AND `TABLE_NAME` = 'usuario';

    IF v_motor IS NULL OR UPPER(v_motor) <> 'INNODB' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La tabla vitavet.usuario debe existir y usar InnoDB para garantizar el rollback.';
    END IF;

    SELECT COUNT(*)
    INTO v_columnas_destino
    FROM `information_schema`.`COLUMNS`
    WHERE `TABLE_SCHEMA` = 'vitavet'
      AND `TABLE_NAME` = 'usuario'
      AND `COLUMN_NAME` IN ('dni', 'nombre_usuario', 'estado');

    -- CHECK_CONSTRAINTS no expone TABLE_NAME; se vincula por esquema y nombre
    -- con TABLE_CONSTRAINTS, y alli se exige vitavet.usuario y tipo CHECK.
    -- La igualdad hexadecimal comprueba exactamente todos los bytes de la
    -- clausula confirmada para chk_usuario_estado en esta instalacion.
    SELECT
        COUNT(*),
        COALESCE(SUM(CASE
            WHEN HEX(cc.`CHECK_CLAUSE`) =
                '286065737461646F6020696E20285F757466386D62345C2750454E4449454E54455C272C5F757466386D62345C2741435449564F5C272C5F757466386D62345C27414E554C41444F5C272929'
            THEN 1 ELSE 0
        END), 0)
    INTO v_restricciones_estado, v_check_estado_valido
    FROM `information_schema`.`CHECK_CONSTRAINTS` AS cc
    INNER JOIN `information_schema`.`TABLE_CONSTRAINTS` AS tc
        ON tc.`CONSTRAINT_SCHEMA` = cc.`CONSTRAINT_SCHEMA`
       AND tc.`CONSTRAINT_NAME` = cc.`CONSTRAINT_NAME`
       AND tc.`TABLE_SCHEMA` = cc.`CONSTRAINT_SCHEMA`
    WHERE cc.`CONSTRAINT_SCHEMA` = 'vitavet'
      AND cc.`CONSTRAINT_NAME` = 'chk_usuario_estado'
      AND tc.`TABLE_SCHEMA` = 'vitavet'
      AND tc.`TABLE_NAME` = 'usuario'
      AND tc.`CONSTRAINT_TYPE` = 'CHECK';

    IF v_columnas_destino <> 3
       OR v_restricciones_estado <> 1
       OR v_check_estado_valido <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Precondiciones fallidas: faltan columnas destino o chk_usuario_estado no coincide con la expresion esperada.';
    END IF;

    START TRANSACTION;
    SET v_transaccion_iniciada = TRUE;

    -- Bloquea las filas actuales para leer los roles y estados bajo lock.
    -- Mantener pausadas las escrituras concurrentes de la aplicacion durante CALL
    -- y hasta COMMIT o ROLLBACK.
    SELECT `id_usuario`
    FROM `vitavet`.`usuario`
    ORDER BY `id_usuario`
    FOR UPDATE;

    SELECT
        COUNT(*),
        COALESCE(SUM(CASE
            WHEN (`id_usuario` = 1 AND `rol` = 'CLIENTE')
              OR (`id_usuario` = 2 AND `rol` = 'CLIENTE')
              OR (`id_usuario` = 3 AND `rol` = 'CLIENTE')
              OR (`id_usuario` = 5 AND `rol` = 'CLIENTE')
              OR (`id_usuario` = 7 AND `rol` = 'ADMIN')
              OR (`id_usuario` = 8 AND `rol` = 'CLIENTE')
              OR (`id_usuario` = 9 AND `rol` = 'CLIENTE')
            THEN 1 ELSE 0
        END), 0),
        COALESCE(SUM(CASE
            WHEN `id_usuario` IN (1, 2, 3, 5, 7, 8, 9)
             AND `dni` IS NULL
             AND `nombre_usuario` IS NULL
             AND `estado` = 'ACTIVO'
            THEN 1 ELSE 0
        END), 0)
    INTO v_total_usuarios, v_ids_roles_validos, v_filas_listas
    FROM `vitavet`.`usuario`;

    IF v_total_usuarios <> 7
       OR v_ids_roles_validos <> 7
       OR v_filas_listas <> 7 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Precondiciones fallidas: deben existir exactamente los siete IDs/roles aprobados, ACTIVO y ambos identificadores NULL.';
    END IF;

    UPDATE `vitavet`.`usuario` AS objetivo
    SET
        `dni` = CONCAT(
            'TEST-VV-',
            LPAD(CAST(objetivo.`id_usuario` AS CHAR), 10, '0')
        ),
        `nombre_usuario` = CONCAT(
            'test_vitavet_',
            LPAD(CAST(objetivo.`id_usuario` AS CHAR), 10, '0')
        )
    WHERE objetivo.`estado` = 'ACTIVO'
      AND objetivo.`dni` IS NULL
      AND objetivo.`nombre_usuario` IS NULL
      AND objetivo.`id_usuario` IN (1, 2, 3, 5, 7, 8, 9)
      AND (
          (objetivo.`id_usuario` = 1 AND objetivo.`rol` = 'CLIENTE')
          OR (objetivo.`id_usuario` = 2 AND objetivo.`rol` = 'CLIENTE')
          OR (objetivo.`id_usuario` = 3 AND objetivo.`rol` = 'CLIENTE')
          OR (objetivo.`id_usuario` = 5 AND objetivo.`rol` = 'CLIENTE')
          OR (objetivo.`id_usuario` = 7 AND objetivo.`rol` = 'ADMIN')
          OR (objetivo.`id_usuario` = 8 AND objetivo.`rol` = 'CLIENTE')
          OR (objetivo.`id_usuario` = 9 AND objetivo.`rol` = 'CLIENTE')
      );

    SET v_filas_actualizadas = ROW_COUNT();

    IF v_filas_actualizadas <> 7 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Backfill incompleto: ROW_COUNT no es 7; se revierte la transaccion.';
    END IF;

    -- La transaccion permanece abierta para permitir verificaciones posteriores
    -- en la misma conexion. El operador decide COMMIT o ROLLBACK.
    SELECT v_filas_actualizadas AS filas_actualizadas;
END$$

DELIMITER ;

-- Ejecutar solo en una accion separada despues de revisar la definicion:
-- CALL `vitavet`.`backfill_usuarios_prueba_v2`();
