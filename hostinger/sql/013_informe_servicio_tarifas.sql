-- 013: Columnas servicio/sesiones en detalle de informe + tabla de tarifas OPS

-- Agregar columnas al detalle del informe
ALTER TABLE informe_atenciones_detalle
    ADD COLUMN servicio        VARCHAR(200)   DEFAULT NULL AFTER cc_paciente,
    ADD COLUMN numero_sesiones INT NOT NULL   DEFAULT 1    AFTER servicio;

-- Tabla de tarifas OPS: precio por servicio configurable por el admin
CREATE TABLE IF NOT EXISTS tarifas_ops (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    servicio        VARCHAR(200)   NOT NULL,
    tipo_servicio   ENUM('sm','pad') NOT NULL DEFAULT 'sm',
    valor_unitario  DECIMAL(14,2)  NOT NULL DEFAULT 0,
    activo          TINYINT(1)     NOT NULL DEFAULT 1,
    actualizado_en  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_servicio (servicio)
);

-- Servicios SM (Salud Mental) — un paciente = una atención
INSERT INTO tarifas_ops (servicio, tipo_servicio) VALUES
('ENFERMERIA SM',                                    'sm'),
('EVOLUCION POR PROFESIONAL- FISIOTERAPIA SM',       'sm'),
('PSICOEDUCACION SM',                                'sm'),
('PSICOLOGIA CONTROL SM',                            'sm'),
('PSICOLOGIA PRIMERA VEZ SM',                        'sm'),
('PSIQUIATRIA CONTROL SM',                           'sm'),
('PSIQUIATRIA PRIMERA VEZ SM',                       'sm'),
('PSIQUIATRIA. SM',                                  'sm'),
('TERAPIA OCUPACIONAL SM',                           'sm'),
('TRABAJO SOCIAL. SM',                               'sm'),
('VALORACION POR PROFESIONAL-FISIOTERAPIA SM',       'sm'),
('VALORACION PSICOLOGIA DE INGRESO VAPSI SM',        'sm')
ON DUPLICATE KEY UPDATE tipo_servicio = VALUES(tipo_servicio);

-- Servicios PAD (Programa Atención Domiciliaria) — una fila = N sesiones
INSERT INTO tarifas_ops (servicio, tipo_servicio) VALUES
('FISIOTERAPIA PAD',       'pad'),
('RESPIRATORIA PAD',       'pad'),
('FONOAUDIOLOGIA PAD',     'pad'),
('TERAPIA OCUPACIONAL PAD','pad')
ON DUPLICATE KEY UPDATE tipo_servicio = VALUES(tipo_servicio);
