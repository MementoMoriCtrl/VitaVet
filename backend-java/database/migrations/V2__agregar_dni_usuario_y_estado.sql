-- Ejecutar manualmente una sola vez en MySQL 8.0.46, despues del respaldo.
-- DDL produce COMMIT implicito y no puede revertirse con ROLLBACK.
-- Antes de ejecutar, revise el preflight en V2__verificar_usuario.sql:
-- servidor/puerto/esquema correctos; cero columnas destino y cero constraint
-- chk_usuario_estado existentes. Si alguna ya existe, DETENERSE e investigar.
-- No ejecutar otra vez si esta migracion ya fue aplicada.
-- DNI/username quedan NULL para el backfill; no se inventan aqui.
-- El default ACTIVO se aplica a cuentas existentes, sin cambiar otros campos.

ALTER TABLE `vitavet`.`usuario`
    ADD COLUMN `dni` VARCHAR(20) NULL,
    ADD COLUMN `nombre_usuario` VARCHAR(50) NULL,
    ADD COLUMN `estado` VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    ADD CONSTRAINT `chk_usuario_estado`
        CHECK (`estado` IN ('PENDIENTE', 'ACTIVO', 'ANULADO'));
