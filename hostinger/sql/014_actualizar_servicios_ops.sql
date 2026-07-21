-- 014: Reemplaza la lista de servicios OPS con la lista definitiva
-- Servicios con sufijo " SM" → Salud Mental (por paciente, tipo 'sm')
-- Servicios sin sufijo → Domiciliarios / generales (por sesión, tipo 'pad')

DELETE FROM tarifas_ops;

INSERT INTO tarifas_ops (servicio, tipo_servicio, valor_unitario, activo) VALUES
-- Servicios SM (Salud Mental) — 1 atención = 1 paciente
('AUXILIAR ENFERMERIA SM',               'sm',  0, 1),
('MEDICINA GENERAL SM',                  'sm',  0, 1),
('PSICOLOGIA SM',                        'sm',  0, 1),
('FISIOTERAPIA SM',                      'sm',  0, 1),
('PSIQUIATRIA SM',                       'sm',  0, 1),
('TRABAJO SOCIAL SM',                    'sm',  0, 1),
('ENFERMERA JEFE SM',                    'sm',  0, 1),
('TERAPIA OCUPACIONAL SM',               'sm',  0, 1),

-- Servicios generales / domiciliarios — cobran por sesión
('AUXILIAR ENFERMERIA',                  'pad', 0, 1),
('MEDICINA GENERAL',                     'pad', 0, 1),
('PSICOPEDAGOGIA',                       'pad', 0, 1),
('FISIOTERAPIA',                         'pad', 0, 1),
('PSICOLOGIA',                           'pad', 0, 1),
('NEUROPSICOLOGIA',                      'pad', 0, 1),
('FONOAUDIOLOGIA',                       'pad', 0, 1),
('TERAPIA OCUPACIONAL',                  'pad', 0, 1),
('TRABAJO SOCIAL',                       'pad', 0, 1),
('TERAPIA RESPIRATORIA',                 'pad', 0, 1),
('ENFERMERA JEFE',                       'pad', 0, 1),
('EDUCACION ESPECIAL',                   'pad', 0, 1),
('GERIATRIA CLINICA',                    'pad', 0, 1),
('CUIDADOR',                             'pad', 0, 1),
('FISIOTERAPIA INTEGRAL',                'pad', 0, 1),
('NUTRICION Y DIETETICA',                'pad', 0, 1),
('MEDICO GENERAL-CUIDADO PALIATIVO',     'pad', 0, 1),
('PEDIATRIA',                            'pad', 0, 1),
('LOGOGENIA',                            'pad', 0, 1),
('MUSICOTERAPIA',                        'pad', 0, 1);
