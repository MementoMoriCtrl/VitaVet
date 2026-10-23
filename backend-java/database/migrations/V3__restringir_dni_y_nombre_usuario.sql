-- Ejecutar manualmente y por separado, solo despues de revisar todas las
-- verificaciones POST en V2__verificar_usuario.sql y guardar el baseline.
-- V3 contiene DDL: ALTER TABLE hace COMMIT implicito y no es reversible con
-- ROLLBACK. Nunca encadenar ni ejecutar automaticamente despues del backfill.
-- Precondiciones: siete filas esperadas; IDs/roles sin diferencias; todos los
-- estados actuales ACTIVO; cero NULL/vacios/duplicados para DNI y username.
-- Verifique tambien que las longitudes y la collation permiten los UNIQUE.
-- Confirme en V2__verificar_usuario.sql que los indices uq_* aun no existen.
-- El cambio de default no cambia estados actuales: inserts futuros deben usar
-- PENDIENTE; el backend debe asignarlo explicitamente al registro publico.

ALTER TABLE `vitavet`.`usuario`
    MODIFY COLUMN `dni` VARCHAR(20) NOT NULL,
    MODIFY COLUMN `nombre_usuario` VARCHAR(50) NOT NULL,
    MODIFY COLUMN `estado` VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    ADD CONSTRAINT `uq_usuario_dni` UNIQUE (`dni`),
    ADD CONSTRAINT `uq_usuario_nombre_usuario` UNIQUE (`nombre_usuario`);
