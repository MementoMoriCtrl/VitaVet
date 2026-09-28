-- Agrega el rol de usuario sin modificar otras tablas ni eliminar datos.
ALTER TABLE usuario
    ADD COLUMN rol VARCHAR(20) NOT NULL DEFAULT 'CLIENTE';

-- Asigna CLIENTE a todas las cuentas existentes.
UPDATE usuario
SET rol = 'CLIENTE';

-- Limita los valores aceptados por la columna.
ALTER TABLE usuario
    ADD CONSTRAINT chk_usuario_rol
    CHECK (rol IN ('CLIENTE', 'ADMIN'));
