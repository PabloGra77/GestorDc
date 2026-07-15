-- Migración 011: tabla de auditoría / historial de actividad
-- Ejecutar una vez en la base de datos de producción

CREATE TABLE IF NOT EXISTS `auditoria_logs` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id`      INT UNSIGNED DEFAULT NULL,
  `correo`          VARCHAR(120) DEFAULT NULL,
  `nombre_completo` VARCHAR(150) DEFAULT NULL,
  `accion`          VARCHAR(60) NOT NULL,
  `detalle`         TEXT DEFAULT NULL,
  `ip`              VARCHAR(45) DEFAULT NULL,
  `user_agent`      VARCHAR(300) DEFAULT NULL,
  `exitoso`         TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_al_usuario`    (`usuario_id`),
  KEY `idx_al_accion`     (`accion`),
  KEY `idx_al_created_at` (`created_at`),
  KEY `idx_al_ip`         (`ip`),
  CONSTRAINT `FK_al_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
