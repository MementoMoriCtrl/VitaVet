-- Aplicación MANUAL en MySQL 8.0, una sola vez, después del respaldo y preflight.
-- No usa Flyway: este proyecto versiona scripts manuales y ddl-auto=none.
-- Detener Spring Boot/escrituras durante la copia de valores históricos.
-- Si catalogo_opcion ya existe, DETENERSE y revisar su estructura; no reemplazarla.
-- CREATE TABLE hace COMMIT implícito. No se modifican mascota ni veterinario.
USE `vitavet`;
SET NAMES utf8mb4;

CREATE TABLE `catalogo_opcion` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `categoria` VARCHAR(30) NOT NULL,
    `etiqueta` VARCHAR(100) NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `uq_catalogo_categoria_etiqueta` UNIQUE (`categoria`, `etiqueta`),
    CONSTRAINT `chk_catalogo_categoria` CHECK (`categoria` IN ('tipo_animal', 'sexo', 'especialidad')),
    CONSTRAINT `chk_catalogo_etiqueta` CHECK (
        CHAR_LENGTH(TRIM(`etiqueta`)) > 0 AND
        ((`categoria` = 'tipo_animal' AND CHAR_LENGTH(`etiqueta`) <= 30) OR
         (`categoria` = 'sexo' AND CHAR_LENGTH(`etiqueta`) <= 20) OR
         (`categoria` = 'especialidad' AND CHAR_LENGTH(`etiqueta`) <= 100))
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `catalogo_opcion` (`categoria`, `etiqueta`) VALUES
('tipo_animal', 'Perro'), ('tipo_animal', 'Gato'), ('tipo_animal', 'Ave'),
('tipo_animal', 'Hámster'), ('tipo_animal', 'Conejo'), ('tipo_animal', 'Tortuga'),
('tipo_animal', 'Pez'), ('tipo_animal', 'Cobaya'), ('tipo_animal', 'Hurón'), ('tipo_animal', 'Otro'),
('sexo', 'Macho'), ('sexo', 'Hembra'), ('sexo', 'No determinado'),
('especialidad', 'Medicina general'), ('especialidad', 'Cirugía'),
('especialidad', 'Dermatología'), ('especialidad', 'Odontología'),
('especialidad', 'Cardiología'), ('especialidad', 'Traumatología'),
('especialidad', 'Oftalmología'), ('especialidad', 'Medicina de animales exóticos');

-- Conservar valores anteriores sin normalizar, renombrar o actualizar registros.
-- La misma collation de las tablas actuales evita duplicados por caso/tildes.
INSERT INTO `catalogo_opcion` (`categoria`, `etiqueta`)
SELECT DISTINCT 'tipo_animal', m.`tipo` FROM `mascota` m
WHERE TRIM(m.`tipo`) <> '' AND NOT EXISTS (
    SELECT 1 FROM `catalogo_opcion` c WHERE c.`categoria` = 'tipo_animal' AND c.`etiqueta` = m.`tipo`
);
INSERT INTO `catalogo_opcion` (`categoria`, `etiqueta`)
SELECT DISTINCT 'sexo', m.`sexo` FROM `mascota` m
WHERE TRIM(m.`sexo`) <> '' AND NOT EXISTS (
    SELECT 1 FROM `catalogo_opcion` c WHERE c.`categoria` = 'sexo' AND c.`etiqueta` = m.`sexo`
);
INSERT INTO `catalogo_opcion` (`categoria`, `etiqueta`)
SELECT DISTINCT 'especialidad', v.`especialidad` FROM `veterinario` v
WHERE TRIM(v.`especialidad`) <> '' AND NOT EXISTS (
    SELECT 1 FROM `catalogo_opcion` c WHERE c.`categoria` = 'especialidad' AND c.`etiqueta` = v.`especialidad`
);
