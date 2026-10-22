-- BORRADOR - Fase 1. No ejecutar hasta completar y aprobar el backfill manual.
-- Apunta explícitamente al esquema vitavet; verificar el esquema antes de aplicarlo.
-- Los campos de identidad quedan temporalmente NULL para conservar las cuentas
-- existentes sin inventar DNI ni nombres de usuario.
-- ACTIVO es el estado transitorio para no bloquear cuentas que ya funcionaban.

ALTER TABLE `vitavet`.`usuario`
    ADD COLUMN `dni` VARCHAR(20) NULL,
    ADD COLUMN `nombre_usuario` VARCHAR(50) NULL,
    ADD COLUMN `estado` VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    ADD CONSTRAINT `chk_usuario_estado`
        CHECK (`estado` IN ('PENDIENTE', 'ACTIVO', 'ANULADO'));

-- PASO MANUAL POSTERIOR: asignar DNI y nombre_usuario a cada cuenta a partir de
-- información verificada con su titular o de una fuente administrativa confiable.
-- No completar con valores derivados automáticamente de nombre, correo o teléfono.
--
-- Antes de finalizar, verificar que no falten valores:
-- SELECT COUNT(*) AS faltantes
-- FROM `vitavet`.`usuario`
-- WHERE `dni` IS NULL OR TRIM(`dni`) = ''
--    OR `nombre_usuario` IS NULL OR TRIM(`nombre_usuario`) = '';
--
-- Verificar duplicados con la misma collation que usarán las restricciones:
-- SELECT `dni`, COUNT(*) AS cantidad
-- FROM `vitavet`.`usuario`
-- WHERE `dni` IS NOT NULL
-- GROUP BY `dni`
-- HAVING COUNT(*) > 1;
--
-- SELECT `nombre_usuario`, COUNT(*) AS cantidad
-- FROM `vitavet`.`usuario`
-- WHERE `nombre_usuario` IS NOT NULL
-- GROUP BY `nombre_usuario`
-- HAVING COUNT(*) > 1;
--
-- PASO DE FINALIZACIÓN: ejecutar solo después de resolver todos los faltantes y
-- duplicados, y cuando la aplicación ya cree cuentas públicas explícitamente
-- como CLIENTE/PENDIENTE. Las cuentas existentes conservarán el estado ACTIVO.
--
-- ALTER TABLE `vitavet`.`usuario`
--     MODIFY COLUMN `dni` VARCHAR(20) NOT NULL,
--     MODIFY COLUMN `nombre_usuario` VARCHAR(50) NOT NULL,
--     MODIFY COLUMN `estado` VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
--     ADD CONSTRAINT `uq_usuario_dni` UNIQUE (`dni`),
--     ADD CONSTRAINT `uq_usuario_nombre_usuario` UNIQUE (`nombre_usuario`);
