<?php
require_once __DIR__ . '/api/bootstrap.php';
$pdo = Db::pdo();

$columnas = [
    'fecha_nacimiento' => "ALTER TABLE usuarios ADD COLUMN fecha_nacimiento DATE NULL DEFAULT NULL",
    'fecha_expedicion' => "ALTER TABLE usuarios ADD COLUMN fecha_expedicion DATE NULL DEFAULT NULL",
    'lugar_expedicion' => "ALTER TABLE usuarios ADD COLUMN lugar_expedicion VARCHAR(150) NULL DEFAULT NULL",
];

foreach ($columnas as $col => $sql) {
    try {
        $pdo->exec($sql);
        echo "OK: columna $col agregada\n";
    } catch (Throwable $e) {
        if (str_contains($e->getMessage(), 'Duplicate column')) {
            echo "INFO: columna $col ya existe\n";
        } else {
            echo "ERROR en $col: " . $e->getMessage() . "\n";
            exit(1);
        }
    }
}
echo "Migración completa.\n";
