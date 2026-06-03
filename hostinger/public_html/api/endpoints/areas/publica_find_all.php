<?php
declare(strict_types=1);

// Listado publico de areas ACTIVAS (sin auth) para el formulario publico
Throttle::hit('areas-pub:' . Throttle::clientIp(), 60, 60);

$rows = Db::pdo()->query(
    "SELECT id, nombre, descripcion, slug, orden
     FROM areas WHERE activo = 1
     ORDER BY orden ASC, nombre ASC"
)->fetchAll();

Response::json(array_map(fn($r) => [
    'id'          => (int)$r['id'],
    'nombre'      => $r['nombre'],
    'descripcion' => $r['descripcion'],
    'slug'        => $r['slug'],
    'orden'       => (int)$r['orden'],
], $rows));
