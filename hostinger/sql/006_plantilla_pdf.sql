ALTER TABLE `tipos_solicitud`
  ADD COLUMN IF NOT EXISTS `plantilla_pdf` LONGTEXT NULL DEFAULT NULL AFTER `flujo_areas`;
