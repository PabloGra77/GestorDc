-- 012: Tablas para el informe de atenciones OPS
-- Cada informe cargado por el admin contiene las atenciones reales por profesional (cc).
-- Se usa para comparar con lo que el profesional declaró en su cuenta de cobro OPS.

CREATE TABLE IF NOT EXISTS informes_ops (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(200) NOT NULL,
    periodo_inicio DATE,
    periodo_fin    DATE,
    total_filas    INT NOT NULL DEFAULT 0,
    subido_por_id  INT,
    subido_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subido_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS informe_atenciones_detalle (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    informe_id      INT NOT NULL,
    cc_profesional  VARCHAR(30) NOT NULL,
    fecha_atencion  DATE,
    regional        VARCHAR(200),
    establecimiento VARCHAR(200),
    cc_paciente     VARCHAR(30),
    FOREIGN KEY (informe_id) REFERENCES informes_ops(id) ON DELETE CASCADE,
    INDEX idx_informe_cc (informe_id, cc_profesional)
);
