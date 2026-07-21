<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

Auth::requireUser();

$pdo  = Db::pdo();
$rows = $pdo->query(
    "SELECT servicio, valor_unitario FROM tarifas_ops WHERE activo = 1 ORDER BY servicio"
)->fetchAll();

Response::json(array_map(fn($r) => [
    'servicio'      => $r['servicio'],
    'valorUnitario' => (float)$r['valor_unitario'],
], $rows));
