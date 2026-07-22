-- Migration 016: tabla de tarifas fijas para viáticos
CREATE TABLE IF NOT EXISTS tarifas_viaticos (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  precio_aereo      DECIMAL(14,2) NOT NULL DEFAULT 0,
  precio_terrestre  DECIMAL(14,2) NOT NULL DEFAULT 0,
  precio_desayuno   DECIMAL(14,2) NOT NULL DEFAULT 0,
  precio_almuerzo   DECIMAL(14,2) NOT NULL DEFAULT 0,
  precio_cena       DECIMAL(14,2) NOT NULL DEFAULT 0,
  precio_hospedaje  DECIMAL(14,2) NOT NULL DEFAULT 0,
  actualizado_en    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fila única (singleton)
INSERT IGNORE INTO tarifas_viaticos (id, precio_aereo, precio_terrestre, precio_desayuno, precio_almuerzo, precio_cena, precio_hospedaje)
VALUES (1, 0, 0, 0, 0, 0, 0);
