ALTER TABLE `solicitudes`
  ADD UNIQUE KEY IF NOT EXISTS `uniq_numero_radicado` (`numero_radicado`);
