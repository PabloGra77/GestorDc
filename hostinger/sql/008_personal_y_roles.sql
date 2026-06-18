-- Migracion 008: Roles definitivos + whitelist de personal autorizado
-- Idempotente. Ejecutar en produccion despues de 007.

SET NAMES utf8mb4;

-- ============================================================
-- ROLES: asegurar los 6 roles del modelo (por nombre, unico)
-- permisos vacio = sin restricciones extra en modulos no-admin
-- (el control real de validacion es por nivel_aprobacion + area).
-- ============================================================
INSERT INTO `roles` (`nombre`, `descripcion`, `activo`, `permisos`) VALUES
  ('Profesional',   'Crea solicitudes y consulta el estado de las suyas', 1, JSON_OBJECT()),
  ('Analista',      'Valida solicitudes de su area (primer filtro)',      1, JSON_OBJECT()),
  ('Coordinador',   'Valida la revision del analista en su area',         1, JSON_OBJECT()),
  ('Director',      'Valida y aprueba en su area',                        1, JSON_OBJECT()),
  ('Gerente',       'Supervisa todas las areas (lectura)',                1, JSON_OBJECT()),
  ('Administrador',  'Acceso total al sistema',                            1, JSON_OBJECT())
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`), `activo` = 1;

-- ============================================================
-- PERSONAL AUTORIZADO (whitelist): solo estas cedulas pueden
-- crear cuenta, con el rol y area ya asignados por el admin.
-- ============================================================
CREATE TABLE IF NOT EXISTS `personal_autorizado` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `numero_documento` VARCHAR(30) NOT NULL,
  `rol` VARCHAR(40) NOT NULL,            -- slug: profesional, analista, coordinador, director, gerente, administrador
  `area` VARCHAR(120) DEFAULT NULL,      -- nombre del area (debe existir en `areas`)
  `nivel_aprobacion` VARCHAR(40) DEFAULT NULL, -- derivado del rol
  `usado` TINYINT(1) NOT NULL DEFAULT 0, -- 1 cuando ya se registro una cuenta con esta cedula
  `usado_en` DATETIME DEFAULT NULL,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_personal_documento` (`numero_documento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
