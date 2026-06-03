-- Tabla clave/valor para configuracion editable desde el panel de administrador.
-- Primer uso: credenciales SMTP (claves: smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from).
-- Si una clave no existe, el sistema usa el valor del .env como fallback.

CREATE TABLE IF NOT EXISTS configuracion (
  clave          VARCHAR(64)  NOT NULL PRIMARY KEY,
  valor          TEXT         NULL,
  actualizado_en TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
