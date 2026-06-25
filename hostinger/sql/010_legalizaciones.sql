-- Migración 010: Legalizaciones — registro de facturas para detección de duplicados
-- Ejecutar DESPUÉS de 009.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- FACTURAS LEGALIZADAS: registro de cada factura aprobada
-- Permite detectar si una factura ya fue usada en otra legalizacion
-- ============================================================
CREATE TABLE IF NOT EXISTS `facturas_legalizadas` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `solicitud_id`    INT UNSIGNED NOT NULL,
  `numero_factura`  VARCHAR(120)  DEFAULT NULL,
  `nit_proveedor`   VARCHAR(60)   DEFAULT NULL,
  `nombre_proveedor` VARCHAR(200) DEFAULT NULL,
  `fecha_factura`   DATE          DEFAULT NULL,
  `valor_factura`   DECIMAL(18,2) DEFAULT NULL,
  `archivo_hash`    VARCHAR(64)   DEFAULT NULL  COMMENT 'SHA-256 del archivo para detectar imagen duplicada',
  `categoria`       VARCHAR(80)   DEFAULT NULL,
  `creado_en`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_fl_solicitud` (`solicitud_id`),
  KEY `IDX_fl_numero_nit` (`numero_factura`, `nit_proveedor`),
  KEY `IDX_fl_hash` (`archivo_hash`),
  CONSTRAINT `FK_fl_solicitud` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CONFIGURACIÓN LEGALIZACIONES: se almacena en tabla `configuracion`
-- Seeds de valores por defecto (si no existen aún)
-- ============================================================
INSERT IGNORE INTO `configuracion` (`clave`, `valor`) VALUES
  ('legalizacion.categorias',
   '["Alimentación","Viajes","Transporte","Papelería / Útiles","Representación","Otros"]'),
  ('legalizacion.monto_maximo', '0'),
  ('legalizacion.mensaje_pago',
   'Tu solicitud de legalización con número de radicado {radicado} fue aprobada. El pago será realizado en el transcurso de los días hábiles. Comunícate con el área de contabilidad si tienes alguna duda.');

SET FOREIGN_KEY_CHECKS = 1;
