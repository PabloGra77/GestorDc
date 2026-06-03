<?php
declare(strict_types=1);

Auth::requireAdmin();

$body = Request::body();
$areaId = (int)($body['areaId'] ?? 0);
$nombre = trim((string)($body['nombre'] ?? ''));
if ($areaId <= 0 || $nombre === '') Response::error('areaId y nombre son obligatorios', 400);

$pdo = Db::pdo();
$check = $pdo->prepare("SELECT id FROM areas WHERE id = :id LIMIT 1");
$check->execute([':id' => $areaId]);
if (!$check->fetch()) Response::error('Area no encontrada', 404);

$slug = strtolower(trim((string)($body['slug'] ?? '')));
if ($slug === '') {
    $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $nombre));
    $slug = trim($slug, '-');
}

$dup = $pdo->prepare("SELECT id FROM tipos_solicitud WHERE area_id = :a AND slug = :s LIMIT 1");
$dup->execute([':a' => $areaId, ':s' => $slug]);
if ($dup->fetch()) Response::error('Ya existe un tipo con ese identificador en el area', 409);

$campos = is_array($body['camposPlantilla'] ?? null) ? $body['camposPlantilla'] : [];
$flujo = is_array($body['flujoAprobacion'] ?? null) ? $body['flujoAprobacion'] : [
    ['rol' => 'analista', 'label' => 'Analista del area', 'orden' => 1],
    ['rol' => 'coordinador', 'label' => 'Coordinador / Director', 'orden' => 2],
    ['rol' => 'contabilidad', 'label' => 'Contabilidad', 'orden' => 3],
];
$flujoAreas = is_array($body['flujoAreas'] ?? null) ? $body['flujoAreas'] : null;
$plantillaPdf = is_array($body['plantillaPdf'] ?? null) ? $body['plantillaPdf'] : null;

$ins = $pdo->prepare(
    "INSERT INTO tipos_solicitud
     (area_id, nombre, descripcion, slug, activo, orden, campos_plantilla, flujo_aprobacion, flujo_areas, plantilla_pdf)
     VALUES (:a, :n, :d, :s, :ac, :o, :c, :f, :fa, :pp)"
);
$ins->execute([
    ':a'  => $areaId,
    ':n'  => $nombre,
    ':d'  => trim((string)($body['descripcion'] ?? '')) ?: null,
    ':s'  => $slug,
    ':ac' => isset($body['activo']) ? (int)(bool)$body['activo'] : 1,
    ':o'  => isset($body['orden']) ? (int)$body['orden'] : 0,
    ':c'  => json_encode($campos, JSON_UNESCAPED_UNICODE),
    ':f'  => json_encode($flujo, JSON_UNESCAPED_UNICODE),
    ':fa' => $flujoAreas ? json_encode($flujoAreas, JSON_UNESCAPED_UNICODE) : null,
    ':pp' => $plantillaPdf ? json_encode($plantillaPdf, JSON_UNESCAPED_UNICODE) : null,
]);
$id = (int)$pdo->lastInsertId();

$sel = $pdo->prepare(
    "SELECT t.*, a.nombre AS area_nombre, a.slug AS area_slug
     FROM tipos_solicitud t INNER JOIN areas a ON a.id = t.area_id
     WHERE t.id = :id"
);
$sel->execute([':id' => $id]);
$row = $sel->fetch();

Response::json([
    'id'              => (int)$row['id'],
    'areaId'          => (int)$row['area_id'],
    'areaNombre'      => $row['area_nombre'],
    'areaSlug'        => $row['area_slug'],
    'nombre'          => $row['nombre'],
    'descripcion'     => $row['descripcion'],
    'slug'            => $row['slug'],
    'activo'          => (bool)$row['activo'],
    'orden'           => (int)$row['orden'],
    'camposPlantilla' => json_decode($row['campos_plantilla'] ?? '[]', true) ?: [],
    'flujoAprobacion' => json_decode($row['flujo_aprobacion'] ?? '[]', true) ?: [],
    'flujoAreas'      => $row['flujo_areas'] ? (json_decode($row['flujo_areas'], true) ?: null) : null,
    'plantillaPdf'    => $row['plantilla_pdf'] ? (json_decode($row['plantilla_pdf'], true) ?: null) : null,
    'creadoEn'        => $row['creado_en'],
], 201);
