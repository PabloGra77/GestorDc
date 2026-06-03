ALTER TABLE `tipos_solicitud`
  ADD COLUMN IF NOT EXISTS `flujo_areas` LONGTEXT NULL DEFAULT NULL AFTER `flujo_aprobacion`;
