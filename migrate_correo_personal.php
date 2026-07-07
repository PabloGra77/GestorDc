<?php
require_once __DIR__ . '/api/bootstrap.php';
$pdo = Db::pdo();
try {
    $pdo->exec("ALTER TABLE usuarios ADD COLUMN correo_personal VARCHAR(120) NULL DEFAULT NULL");
    echo "OK: columna correo_personal agregada\n";
} catch (Throwable $e) {
    if (str_contains($e->getMessage(), 'Duplicate column')) {
        echo "INFO: columna ya existe\n";
    } else {
        echo "ERROR: " . $e->getMessage() . "\n";
        exit(1);
    }
}
