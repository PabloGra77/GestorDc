-- Migration 015: soporte para dos plantillas de informe OPS
-- tipo_plantilla en informes_ops, nombres/apellidos en informe_atenciones_detalle

ALTER TABLE informes_ops
  ADD COLUMN IF NOT EXISTS tipo_plantilla ENUM('ppl','servicio') NOT NULL DEFAULT 'ppl'
  AFTER total_filas;

ALTER TABLE informe_atenciones_detalle
  ADD COLUMN IF NOT EXISTS nombres_paciente   VARCHAR(200) DEFAULT NULL AFTER cc_profesional,
  ADD COLUMN IF NOT EXISTS apellidos_paciente VARCHAR(200) DEFAULT NULL AFTER nombres_paciente;
