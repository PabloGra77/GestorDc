-- Migracion 003: columna firmas para solicitudes
-- firmas JSON: { profesional: dataURL, analista: dataURL, coordinador: dataURL, contabilidad: dataURL }
ALTER TABLE `solicitudes`
  ADD COLUMN IF NOT EXISTS `firmas` JSON DEFAULT NULL AFTER `documentos`;
