<?php
declare(strict_types=1);

/**
 * POST /tipos/ensure
 * Busca un tipo por slug; si no existe lo crea en la primera área disponible.
 * Usado por CuentaCobroOpsPanel para auto-inicializar el tipo sin necesidad del panel admin.
 * Requiere usuario autenticado (no solo admin).
 */
Auth::requireUser();

$body = Request::body();
$slug = strtolower(trim((string)($body['slug'] ?? '')));
if ($slug === '') Response::error('slug es obligatorio', 400);

$pdo = Db::pdo();

// Buscar tipo existente
$sel = $pdo->prepare(
    "SELECT t.id, t.area_id FROM tipos_solicitud t WHERE t.slug = :slug LIMIT 1"
);
$sel->execute([':slug' => $slug]);
$existing = $sel->fetch();

if ($existing) {
    Response::json(['id' => (int)$existing['id'], 'areaId' => (int)$existing['area_id']]);
}

// No existe → crear. Requiere al menos un área en la BD.
$areaRow = $pdo->query("SELECT id FROM areas ORDER BY id ASC LIMIT 1")->fetch();
if (!$areaRow) Response::error('No hay áreas configuradas. Crea al menos un área antes de usar este módulo.', 422);

$areaId = (int)$areaRow['id'];

$nombre = match($slug) {
    'cuenta-cobro-ops' => 'Cuenta de Cobro OPS',
    default            => ucwords(str_replace('-', ' ', $slug)),
};

$flujo = [
    ['rol' => 'autorizador_visto_bueno', 'label' => 'Visto bueno del supervisor', 'orden' => 1],
    ['rol' => 'analista',               'label' => 'Analista de nómina',           'orden' => 2],
    ['rol' => 'contabilidad',           'label' => 'Contabilidad / Pagaduría',      'orden' => 3],
];

$ins = $pdo->prepare(
    "INSERT INTO tipos_solicitud
     (area_id, nombre, descripcion, slug, activo, orden, campos_plantilla, flujo_aprobacion)
     VALUES (:a, :n, :d, :s, 1, 0, :c, :f)"
);
$ins->execute([
    ':a' => $areaId,
    ':n' => $nombre,
    ':d' => 'Cuenta de cobro para profesionales vinculados por Orden de Prestación de Servicios (OPS).',
    ':s' => $slug,
    ':c' => '[]',
    ':f' => json_encode($flujo, JSON_UNESCAPED_UNICODE),
]);

$newId = (int)$pdo->lastInsertId();
Response::json(['id' => $newId, 'areaId' => $areaId], 201);
