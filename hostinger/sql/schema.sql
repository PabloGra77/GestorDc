-- GestorDoc CO - Esquema MySQL para Hostinger
-- Convertido desde PostgreSQL/TypeORM
-- Charset y motor compatibles con MySQL 5.7+ / MariaDB 10.3+

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `radicados`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `roles`;

CREATE TABLE `roles` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(80) NOT NULL,
  `descripcion` VARCHAR(200) DEFAULT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `permisos` JSON NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_roles_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `usuarios` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `primer_nombre` VARCHAR(60) DEFAULT NULL,
  `segundo_nombre` VARCHAR(60) DEFAULT NULL,
  `primer_apellido` VARCHAR(60) DEFAULT NULL,
  `segundo_apellido` VARCHAR(60) DEFAULT NULL,
  `tipo_documento` VARCHAR(10) DEFAULT NULL,
  `numero_documento` VARCHAR(30) DEFAULT NULL,
  `nombre_completo` VARCHAR(150) NOT NULL,
  `correo` VARCHAR(120) NOT NULL,
  `area` VARCHAR(120) DEFAULT NULL,
  `permisos` JSON NOT NULL,
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 1,
  `password_reset_token_hash` VARCHAR(255) DEFAULT NULL,
  `password_reset_expires_at` DATETIME DEFAULT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `rol_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_usuarios_correo` (`correo`),
  KEY `FK_usuarios_rol` (`rol_id`),
  CONSTRAINT `FK_usuarios_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `radicados` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `numero` VARCHAR(50) NOT NULL,
  `referencia` VARCHAR(80) NOT NULL,
  `asunto` VARCHAR(200) DEFAULT NULL,
  `estado` VARCHAR(30) NOT NULL DEFAULT 'Radicado',
  `tipo` VARCHAR(30) NOT NULL DEFAULT 'General',
  `solicitante_correo` VARCHAR(150) DEFAULT NULL,
  `solicitante_cc` VARCHAR(30) DEFAULT NULL,
  `documentos_solicitados` JSON DEFAULT NULL,
  `documentos_adjuntos` JSON DEFAULT NULL,
  `datos_plantilla` JSON DEFAULT NULL,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_radicados_numero` (`numero`),
  UNIQUE KEY `UQ_radicados_referencia` (`referencia`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed: roles iniciales (sin usuarios)
INSERT INTO `roles` (`id`, `nombre`, `descripcion`, `activo`, `permisos`) VALUES
  (1, 'Administrador', 'Acceso total al sistema', 1, JSON_OBJECT()),
  (2, 'Usuario', 'Usuario estandar', 1, JSON_OBJECT('inicio', JSON_ARRAY('realizarSolicitudes','verificarRadicados')));

-- El admin se crea via SSH con: php sql/seed-admin.php "correo@dom.com" "Password"
