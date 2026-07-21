<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

Auth::requireAdmin();

$body    = Request::body();
$tarifas = is_array($body['tarifas'] ?? null) ? $body['tarifas'] : null;

if (!$tarifas) {
    Response::error('Se esperaba un array "tarifas"', 400);
}

$pdo = Db::pdo();

$upsert = $pdo->prepare(
    "INSERT INTO tarifas_ops (servicio, tipo_servicio, valor_unitario, activo)
     VALUES (:sv, :ts, :vu, :ac)
     ON DUPLICATE KEY UPDATE
         tipo_servicio  = VALUES(tipo_servicio),
         valor_unitario = VALUES(valor_unitario),
         activo         = VALUES(activo)"
);

$pdo->beginTransaction();
try {
    foreach ($tarifas as $t) {
        $sv = mb_strtoupper(trim((string)($t['servicio'] ?? '')));
        if (!$sv) continue;
        $upsert->execute([
            ':sv' => $sv,
            ':ts' => in_array($t['tipoServicio'] ?? '', ['sm','pad'], true) ? $t['tipoServicio'] : 'sm',
            ':vu' => max(0, (float)($t['valorUnitario'] ?? 0)),
            ':ac' => (int)(bool)($t['activo'] ?? true),
        ]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    Response::error('Error al guardar las tarifas: ' . $e->getMessage(), 500);
}

Response::json(['ok' => true]);
