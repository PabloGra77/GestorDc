<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

Auth::requireAdmin();

$pdo = Db::pdo();

// Intenta con columna plataforma; si no existe (migración pendiente), hace fallback
try {
    $stmt = $pdo->query(
        "SELECT i.id, i.nombre, i.periodo_inicio, i.periodo_fin,
                i.total_filas, i.subido_en, i.plataforma,
                u.nombre_completo AS subido_por
         FROM informes_ops i
         LEFT JOIN usuarios u ON u.id = i.subido_por_id
         ORDER BY i.subido_en DESC
         LIMIT 100"
    );
} catch (PDOException $e) {
    $stmt = $pdo->query(
        "SELECT i.id, i.nombre, i.periodo_inicio, i.periodo_fin,
                i.total_filas, i.subido_en, NULL AS plataforma,
                u.nombre_completo AS subido_por
         FROM informes_ops i
         LEFT JOIN usuarios u ON u.id = i.subido_por_id
         ORDER BY i.subido_en DESC
         LIMIT 100"
    );
}

$rows = $stmt->fetchAll();

Response::json(array_map(fn($r) => [
    'id'            => (int)$r['id'],
    'nombre'        => $r['nombre'],
    'periodoInicio' => $r['periodo_inicio'],
    'periodoFin'    => $r['periodo_fin'],
    'totalFilas'    => (int)$r['total_filas'],
    'subidoEn'      => $r['subido_en'],
    'subidoPor'     => $r['subido_por'],
    'plataforma'    => $r['plataforma'],
], $rows));
