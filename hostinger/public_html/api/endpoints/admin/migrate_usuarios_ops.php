<?php
declare(strict_types=1);

/**
 * POST /admin/migrate/usuarios-ops
 * Agrega columnas OPS a la tabla usuarios (idempotente — usa IF NOT EXISTS).
 * Solo ejecutable por administrador.
 */
Auth::requireAdmin();

$pdo = Db::pdo();

$columnas = [
    "eps                   VARCHAR(120)  NULL DEFAULT NULL",
    "archivo_eps_id        VARCHAR(64)   NULL DEFAULT NULL",
    "archivo_eps_nombre    VARCHAR(255)  NULL DEFAULT NULL",
    "archivo_documento_id  VARCHAR(64)   NULL DEFAULT NULL",
    "archivo_documento_nombre VARCHAR(255) NULL DEFAULT NULL",
    "archivo_cuenta_id     VARCHAR(64)   NULL DEFAULT NULL",
    "archivo_cuenta_nombre VARCHAR(255)  NULL DEFAULT NULL",
];

$resultados = [];
foreach ($columnas as $def) {
    $nombreColumna = preg_split('/\s+/', trim($def))[0];
    try {
        $pdo->exec("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS $def");
        $resultados[$nombreColumna] = 'ok';
    } catch (Throwable $e) {
        // Si el motor no soporta IF NOT EXISTS, verificamos manualmente
        try {
            $check = $pdo->query(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME   = 'usuarios'
                   AND COLUMN_NAME  = '$nombreColumna'"
            );
            if ((int)$check->fetchColumn() === 0) {
                $pdo->exec("ALTER TABLE usuarios ADD COLUMN $def");
                $resultados[$nombreColumna] = 'creada';
            } else {
                $resultados[$nombreColumna] = 'ya existía';
            }
        } catch (Throwable $e2) {
            $resultados[$nombreColumna] = 'error: ' . $e2->getMessage();
        }
    }
}

Response::json(['migracion' => 'completada', 'columnas' => $resultados]);
