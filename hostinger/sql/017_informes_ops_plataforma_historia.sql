-- 017: Plataforma de origen + número de historia clínica en informes OPS

-- Columna para registrar la plataforma de la que viene el informe (360 o Panacea)
ALTER TABLE informes_ops
  ADD COLUMN IF NOT EXISTS plataforma VARCHAR(20) DEFAULT NULL AFTER nombre;

-- Número de historia único por atención — permite deduplicar al re-subir archivos
ALTER TABLE informe_atenciones_detalle
  ADD COLUMN IF NOT EXISTS numero_historia VARCHAR(50) DEFAULT NULL AFTER servicio;

-- Índice único: si el mismo numero_historia ya existe, INSERT IGNORE lo omite
ALTER TABLE informe_atenciones_detalle
  ADD UNIQUE KEY IF NOT EXISTS uq_historia (numero_historia);
