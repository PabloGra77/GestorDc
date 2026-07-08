<?php
// Script de migración one-shot. Se elimina tras ejecutarse.
// Acceder: GET /api/migrate_run.php?key=ops2026
declare(strict_types=1);

$secret = 'ops2026';
if (($_GET['key'] ?? '') !== $secret) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$env = parse_ini_file(__DIR__ . '/.env');
try {
    $dsn = "mysql:host={$env['DB_HOST']};port={$env['DB_PORT']};dbname={$env['DB_NAME']};charset=utf8mb4";
    $pdo = new PDO($dsn, $env['DB_USER'], $env['DB_PASSWORD'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connect failed: ' . $e->getMessage()]);
    exit;
}

$columnas = [
    "eps"                     => "VARCHAR(120)  NULL DEFAULT NULL",
    "archivo_eps_id"          => "VARCHAR(64)   NULL DEFAULT NULL",
    "archivo_eps_nombre"      => "VARCHAR(255)  NULL DEFAULT NULL",
    "archivo_documento_id"    => "VARCHAR(64)   NULL DEFAULT NULL",
    "archivo_documento_nombre"=> "VARCHAR(255)  NULL DEFAULT NULL",
    "archivo_cuenta_id"       => "VARCHAR(64)   NULL DEFAULT NULL",
    "archivo_cuenta_nombre"   => "VARCHAR(255)  NULL DEFAULT NULL",
];

$resultados = [];
foreach ($columnas as $col => $def) {
    try {
        $check = $pdo->query(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = 'usuarios'
               AND COLUMN_NAME  = '$col'"
        );
        if ((int)$check->fetchColumn() > 0) {
            $resultados[$col] = 'ya existía';
            continue;
        }
        $pdo->exec("ALTER TABLE usuarios ADD COLUMN $col $def");
        $resultados[$col] = 'creada ✓';
    } catch (Throwable $e) {
        $resultados[$col] = 'ERROR: ' . $e->getMessage();
    }
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok' => true, 'columnas' => $resultados], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
