-- Migracion 002: Areas, tipos de solicitud, plantillas, solicitudes y flujo
-- Ejecutar DESPUES de schema.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- AREAS (Recursos Humanos, OPS, Contabilidad, etc)
-- ============================================================
CREATE TABLE IF NOT EXISTS `areas` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(80) NOT NULL,
  `descripcion` VARCHAR(255) DEFAULT NULL,
  `slug` VARCHAR(60) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `orden` INT NOT NULL DEFAULT 0,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_areas_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TIPOS DE SOLICITUD (Cuenta de cobro, Vacaciones, etc) por area
-- ============================================================
CREATE TABLE IF NOT EXISTS `tipos_solicitud` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `area_id` INT UNSIGNED NOT NULL,
  `nombre` VARCHAR(120) NOT NULL,
  `descripcion` VARCHAR(500) DEFAULT NULL,
  `slug` VARCHAR(80) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `orden` INT NOT NULL DEFAULT 0,
  -- Plantilla: array JSON de campos requeridos
  -- Estructura: [{key, label, type, required, group, ocr_target}]
  -- type: text, email, number, date, file, select, textarea, cc, nit
  -- group: agrupa visualmente (ej. "Datos personales", "Documentos")
  -- ocr_target: si type=file, indica que documento espera (cedula, rut, eps, adres)
  `campos_plantilla` JSON NOT NULL,
  -- Workflow: lista de pasos de aprobacion
  -- Estructura: [{rol_slug, label, orden}]
  -- ej: [{"rol":"analista","label":"Analista del area","orden":1},
  --      {"rol":"coordinador","label":"Coordinador / Director","orden":2},
  --      {"rol":"contabilidad","label":"Contabilidad","orden":3}]
  `flujo_aprobacion` JSON NOT NULL,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_tipos_solicitud_area_slug` (`area_id`, `slug`),
  KEY `FK_tipos_area` (`area_id`),
  CONSTRAINT `FK_tipos_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SOLICITUDES (instancias creadas por usuarios siguiendo una plantilla)
-- ============================================================
CREATE TABLE IF NOT EXISTS `solicitudes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `numero_radicado` VARCHAR(50) NOT NULL,
  `tipo_solicitud_id` INT UNSIGNED NOT NULL,
  `area_id` INT UNSIGNED NOT NULL,
  -- usuario que la creo (puede ser interno con cuenta o externo)
  `solicitante_usuario_id` INT UNSIGNED DEFAULT NULL,
  `solicitante_nombre` VARCHAR(150) DEFAULT NULL,
  `solicitante_correo` VARCHAR(150) DEFAULT NULL,
  `solicitante_documento` VARCHAR(30) DEFAULT NULL,
  -- datos del formulario rellenado (JSON)
  `datos_formulario` JSON NOT NULL,
  -- documentos adjuntos: array de {key, nombre, archivo_url, ocr_texto, ocr_score, validado}
  `documentos` JSON DEFAULT NULL,
  -- alertas detectadas: array de {tipo, descripcion, severidad}
  -- tipo: 'ocr_mismatch', 'documento_ilegible', 'firma_sospechosa', 'campo_vacio'
  `alertas` JSON DEFAULT NULL,
  -- estado actual: borrador, en_validacion, aprobado, rechazado, devuelto
  `estado` VARCHAR(30) NOT NULL DEFAULT 'borrador',
  -- paso actual del flujo (string del rol)
  `paso_actual` VARCHAR(40) DEFAULT NULL,
  `paso_orden` INT NOT NULL DEFAULT 0,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `aprobado_en` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_solicitudes_radicado` (`numero_radicado`),
  KEY `FK_solicitudes_tipo` (`tipo_solicitud_id`),
  KEY `FK_solicitudes_area` (`area_id`),
  KEY `FK_solicitudes_solicitante` (`solicitante_usuario_id`),
  KEY `IDX_solicitudes_estado` (`estado`),
  CONSTRAINT `FK_solicitudes_tipo` FOREIGN KEY (`tipo_solicitud_id`) REFERENCES `tipos_solicitud` (`id`),
  CONSTRAINT `FK_solicitudes_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`),
  CONSTRAINT `FK_solicitudes_solicitante` FOREIGN KEY (`solicitante_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MOVIMIENTOS / TRAZABILIDAD (cada cambio de estado)
-- ============================================================
CREATE TABLE IF NOT EXISTS `solicitud_movimientos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `solicitud_id` INT UNSIGNED NOT NULL,
  -- accion: creada, validada, devuelta, aprobada, rechazada, comentario
  `accion` VARCHAR(40) NOT NULL,
  -- paso en el flujo (rol_slug) al momento del evento
  `paso` VARCHAR(40) DEFAULT NULL,
  -- estado resultado
  `estado_resultado` VARCHAR(30) DEFAULT NULL,
  -- usuario que realizo la accion (NULL si es sistema)
  `usuario_id` INT UNSIGNED DEFAULT NULL,
  `usuario_nombre` VARCHAR(150) DEFAULT NULL,
  `usuario_rol` VARCHAR(80) DEFAULT NULL,
  -- comentario libre o motivo de devolucion
  `comentario` TEXT DEFAULT NULL,
  -- visibilidad: 'interno' (solo staff) o 'publico' (visible en /verificar)
  `visibilidad` VARCHAR(20) NOT NULL DEFAULT 'interno',
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_movimientos_solicitud` (`solicitud_id`),
  KEY `FK_movimientos_usuario` (`usuario_id`),
  KEY `IDX_movimientos_visibilidad` (`visibilidad`),
  CONSTRAINT `FK_movimientos_solicitud` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_movimientos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ASIGNACION usuario -> area (un usuario pertenece a un area y tiene un nivel)
-- ============================================================
ALTER TABLE `usuarios`
  ADD COLUMN IF NOT EXISTS `area_id` INT UNSIGNED DEFAULT NULL AFTER `rol_id`,
  ADD COLUMN IF NOT EXISTS `nivel_aprobacion` VARCHAR(40) DEFAULT NULL AFTER `area_id`,
  ADD CONSTRAINT `FK_usuarios_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE SET NULL;

-- nivel_aprobacion: 'analista', 'coordinador', 'director', 'contabilidad', NULL (sin nivel)

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEED: areas y tipos de solicitud iniciales
-- ============================================================
INSERT INTO `areas` (`id`, `nombre`, `descripcion`, `slug`, `activo`, `orden`) VALUES
  (1, 'Operaciones (OPS)', 'Radicaciones operativas y cuentas de cobro de contratistas', 'ops', 1, 10),
  (2, 'Recursos Humanos', 'Solicitudes de personal, vacaciones, permisos', 'rrhh', 1, 20),
  (3, 'Contabilidad', 'Validacion final y pagos', 'contabilidad', 1, 90)
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

-- Plantilla OPS Cuenta de cobro
INSERT INTO `tipos_solicitud` (`id`, `area_id`, `nombre`, `descripcion`, `slug`, `activo`, `orden`, `campos_plantilla`, `flujo_aprobacion`)
VALUES (
  1, 1, 'Cuenta de cobro OPS',
  'Solicitud de radicacion de cuenta de cobro para contratistas',
  'cuenta-cobro-ops', 1, 10,
  JSON_ARRAY(
    JSON_OBJECT('key','nombreCompleto','label','Nombre completo','type','text','required',true,'group','Datos personales'),
    JSON_OBJECT('key','cedula','label','Numero de cedula','type','cc','required',true,'group','Datos personales'),
    JSON_OBJECT('key','lugarExpedicion','label','Lugar de expedicion','type','text','required',true,'group','Datos personales'),
    JSON_OBJECT('key','correo','label','Correo electronico','type','email','required',true,'group','Datos personales'),
    JSON_OBJECT('key','telefono','label','Telefono de contacto','type','text','required',true,'group','Datos personales'),
    JSON_OBJECT('key','mesRadicar','label','Mes a radicar','type','date','required',true,'group','Periodo'),
    JSON_OBJECT('key','valorNumero','label','Valor a radicar (numero)','type','number','required',true,'group','Valores'),
    JSON_OBJECT('key','valorLetras','label','Valor en letras','type','text','required',true,'group','Valores'),
    JSON_OBJECT('key','docCedula','label','Fotocopia cedula','type','file','required',true,'group','Documentos','ocr_target','cedula'),
    JSON_OBJECT('key','docRut','label','RUT','type','file','required',true,'group','Documentos','ocr_target','rut'),
    JSON_OBJECT('key','docEps','label','Certificado EPS','type','file','required',true,'group','Documentos','ocr_target','eps'),
    JSON_OBJECT('key','docAdres','label','Certificado ADRES','type','file','required',false,'group','Documentos','ocr_target','adres'),
    JSON_OBJECT('key','docPlanilla','label','Planilla seguridad social','type','file','required',true,'group','Documentos','ocr_target','planilla'),
    JSON_OBJECT('key','docCuentaCobro','label','Cuenta de cobro firmada','type','file','required',true,'group','Documentos','ocr_target','cuenta_cobro')
  ),
  JSON_ARRAY(
    JSON_OBJECT('rol','analista','label','Analista del area','orden',1),
    JSON_OBJECT('rol','coordinador','label','Coordinador / Director','orden',2),
    JSON_OBJECT('rol','contabilidad','label','Contabilidad','orden',3)
  )
)
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
