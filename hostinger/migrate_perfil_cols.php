<?php
// Migration: add perfil columns to usuarios table
// Run once on server: php /tmp/migrate_perfil_cols.php
require_once __DIR__ . '/public_html/api/bootstrap.php';
$pdo = Db::pdo();

$cols = [
    'telefono'       => "ALTER TABLE usuarios ADD COLUMN telefono VARCHAR(20) DEFAULT NULL",
    'direccion'      => "ALTER TABLE usuarios ADD COLUMN direccion VARCHAR(255) DEFAULT NULL",
    'banco'          => "ALTER TABLE usuarios ADD COLUMN banco VARCHAR(100) DEFAULT NULL",
    'tipo_cuenta'    => "ALTER TABLE usuarios ADD COLUMN tipo_cuenta VARCHAR(20) DEFAULT NULL",
    'numero_cuenta'  => "ALTER TABLE usuarios ADD COLUMN numero_cuenta VARCHAR(30) DEFAULT NULL",
    'titular_cuenta' => "ALTER TABLE usuarios ADD COLUMN titular_cuenta VARCHAR(120) DEFAULT NULL",
];

foreach ($cols as $name => $sql) {
    try {
        $pdo->exec($sql);
        echo "OK: columna $name agregada\n";
    } catch (PDOException $e) {
        if (str_contains($e->getMessage(), 'Duplicate column')) {
            echo "YA EXISTE: $name (ok)\n";
        } else {
            echo "ERROR en $name: " . $e->getMessage() . "\n";
        }
    }
}
echo "Migración completada.\n";
