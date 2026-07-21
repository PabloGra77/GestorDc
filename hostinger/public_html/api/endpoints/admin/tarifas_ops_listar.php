<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

Auth::requireAdmin();

$pdo  = Db::pdo();
$rows = $pdo->query(
    "SELECT id, servicio, tipo_servicio, valor_unitario, activo
     FROM tarifas_ops ORDER BY tipo_servicio, servicio"
)->fetchAll();

Response::json(array_map(fn($r) => [
    'id'            => (int)$r['id'],
    'servicio'      => $r['servicio'],
    'tipoServicio'  => $r['tipo_servicio'],
    'valorUnitario' => (float)$r['valor_unitario'],
    'activo'        => (bool)$r['activo'],
], $rows));
