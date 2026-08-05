-- Migración 018: Portal de Pagos — traslado de fondos a portal bancario
-- Ejecutar una vez en la base de datos de producción

-- ---------------------------------------------------------------------
-- Empresas ordenantes (cuentas de origen habilitadas para generar lotes)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pagos_empresas` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`              VARCHAR(160) NOT NULL,
  `identificacion`      VARCHAR(16)  NOT NULL,
  `tipo_identificacion` CHAR(2)      NOT NULL DEFAULT '03',
  `cuenta_origen`       VARCHAR(24)  NOT NULL,
  `tipo_cuenta`         CHAR(2)      NOT NULL DEFAULT 'CA',
  `activa`              TINYINT(1)   NOT NULL DEFAULT 1,
  `creado_en`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pagos_empresas_cuenta` (`cuenta_origen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Catálogo de entidades financieras
--   oficial = 1  -> tabla publicada por Davivienda
--   oficial = 0  -> registrada manualmente por un administrador
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pagos_bancos` (
  `codigo`      SMALLINT UNSIGNED NOT NULL,
  `nombre`      VARCHAR(120) NOT NULL,
  `oficial`     TINYINT(1)   NOT NULL DEFAULT 1,
  `activo`      TINYINT(1)   NOT NULL DEFAULT 1,
  `creado_por`  INT UNSIGNED NULL,
  `creado_en`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`codigo`),
  KEY `ix_pagos_bancos_activo` (`activo`),
  CONSTRAINT `fk_pagos_bancos_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Lotes de pago
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pagos_lotes` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `referencia`          CHAR(12)     NOT NULL,
  `empresa_id`          INT UNSIGNED NOT NULL,
  `usuario_id`          INT UNSIGNED NOT NULL,
  `descripcion`         VARCHAR(180) NULL,
  `fecha_proceso`       DATE         NOT NULL,
  `estado`              ENUM('borrador','validado','generado','anulado') NOT NULL DEFAULT 'borrador',
  `cantidad_pagos`      INT UNSIGNED NOT NULL DEFAULT 0,
  `valor_total`         DECIMAL(18,2) NOT NULL DEFAULT 0,
  `archivo_nombre`      VARCHAR(120) NULL,
  `archivo_sha256`      CHAR(64)     NULL,
  `archivo_nombre_csv`  VARCHAR(120) NULL,
  `archivo_sha256_csv`  CHAR(64)     NULL,
  `archivo_zip_nombre`  VARCHAR(120) NULL,
  `archivo_zip_sha256`  CHAR(64)     NULL,
  `archivo_zip_clave`   VARBINARY(255) NULL,
  `generado_por`        INT UNSIGNED NULL,
  `generado_en`         DATETIME     NULL,
  `veces_reabierto`     INT UNSIGNED NOT NULL DEFAULT 0,
  `reabierto_por`       INT UNSIGNED NULL,
  `reabierto_en`        DATETIME     NULL,
  `creado_en`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pagos_lotes_referencia` (`referencia`),
  KEY `ix_pagos_lotes_estado` (`estado`),
  KEY `ix_pagos_lotes_usuario` (`usuario_id`),
  CONSTRAINT `fk_pagos_lotes_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `pagos_empresas` (`id`),
  CONSTRAINT `fk_pagos_lotes_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_pagos_lotes_generado_por` FOREIGN KEY (`generado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pagos_lotes_reabierto_por` FOREIGN KEY (`reabierto_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Detalle de pagos de cada lote
--   Identificaciones y cuentas son VARCHAR a propósito: como enteros se
--   pierden los ceros a la izquierda y la precisión sobre 15 dígitos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pagos_lote_detalle` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `lote_id`             INT UNSIGNED NOT NULL,
  `orden`               INT UNSIGNED NOT NULL,
  `fila_origen`         INT UNSIGNED NULL,
  `identificacion`      VARCHAR(16)  NOT NULL DEFAULT '',
  `tipo_identificacion` CHAR(2)      NOT NULL DEFAULT '',
  `producto_destino`    VARCHAR(32)  NOT NULL DEFAULT '',
  `tipo_producto`       CHAR(2)      NOT NULL DEFAULT '',
  `codigo_banco`        VARCHAR(6)   NOT NULL DEFAULT '',
  `valor`               DECIMAL(18,2) NOT NULL DEFAULT 0,
  `beneficiario`        VARCHAR(160) NOT NULL DEFAULT '',
  `banco_manual`        TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `ix_pagos_lote_detalle_lote` (`lote_id`, `orden`),
  CONSTRAINT `fk_pagos_lote_detalle_lote` FOREIGN KEY (`lote_id`) REFERENCES `pagos_lotes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Datos iniciales — Tabla de Bancos, Banco Davivienda S.A.
-- =====================================================================
INSERT IGNORE INTO `pagos_bancos` (`codigo`, `nombre`, `oficial`) VALUES
  (1,'Banco de Bogotá',1),(2,'Banco Popular',1),(6,'Itaú (antes CorpBanca)',1),
  (7,'Bancolombia',1),(9,'Citibank',1),(12,'Banco GNB Sudameris',1),
  (13,'BBVA Colombia',1),(14,'Helm Bank',1),(19,'Scotiabank Colpatria S.A.',1),
  (21,'Financiera Juriscoop S.A. Compañía de Financiamiento',1),
  (23,'Banco de Occidente',1),(31,'Bancóldex S.A.',1),
  (32,'Banco Caja Social BCSC S.A.',1),(40,'Banco Agrario',1),
  (42,'BNP Paribas',1),(47,'Mundo Mujer',1),(51,'Davivienda - Daviplata',1),
  (52,'Banco AV Villas',1),(53,'Banco W S.A.',1),(59,'Bancamía S.A.',1),
  (60,'Banco Pichincha',1),(61,'Bancoomeva',1),(62,'Banco Falabella S.A.',1),
  (63,'Banco Finandina',1),(65,'Banco Santander de Negocios Colombia S.A.',1),
  (66,'Banco Cooperativo Coopcentral',1),(67,'Mi Banco',1),
  (69,'Banco Serfinanza',1),(70,'Lulo Bank',1),
  (71,'Banco J.P. Morgan Colombia S.A.',1),
  (283,'Cooperativa Financiera de Antioquia CFA',1),
  (286,'JFK Cooperativa Financiera',1),(289,'Cootrafa Cooperativa Financiera',1),
  (291,'Cofinep Cooperativa Financiera',1),(292,'Confiar Cooperativa Financiera',1),
  (303,'Banco Unión (antes Giros y Finanzas)',1),(370,'Coltefinaciera S.A.',1),
  (507,'Nequi',1),(558,'Ban100',1),(560,'Pibank',1),(637,'IRIS (Dann Regional)',1),
  (801,'MOVii',1),(802,'DING Tecnipagos S.A.',1),(803,'Powwi',1),
  (804,'Bancar Tecnología Ualá',1),(805,'BTG Pactual',1),(808,'BOLD CF',1),
  (809,'Nubank',1),(811,'RappiPay',1),(812,'Coink S.A.',1),
  (813,'Santander Consumer',1),(814,'Global66',1);

-- Empresa de ejemplo — AJUSTE la cuenta de origen real antes de generar lotes.
INSERT IGNORE INTO `pagos_empresas` (`id`, `nombre`, `identificacion`, `tipo_identificacion`, `cuenta_origen`, `tipo_cuenta`)
VALUES (1, 'IPS GOLEMAN SERVICIO INTEGRAL S.A.S.', '900231829', '03', '000000000000', 'CA');
