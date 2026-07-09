<?php
declare(strict_types=1);

Auth::requireAdmin();

$id = (int)($params['id'] ?? 0);
$body = Request::body();
$pdo = Db::pdo();

/* Agregar columna configuracion_tipo si aún no existe (idempotente) */
try {
    $pdo->exec("ALTER TABLE tipos_solicitud ADD COLUMN configuracion_tipo TEXT NULL");
} catch (\PDOException $e) { /* ya existe — ignorar */ }

$cur = $pdo->prepare("SELECT * FROM tipos_solicitud WHERE id = :id LIMIT 1");
$cur->execute([':id' => $id]);
$row = $cur->fetch();
if (!$row) Response::error('Tipo no encontrado', 404);

if (isset($body['nombre'])) $row['nombre'] = trim((string)$body['nombre']);
if (array_key_exists('descripcion', $body)) {
    $d = trim((string)$body['descripcion']);
    $row['descripcion'] = $d === '' ? null : $d;
}
if (isset($body['areaId'])) {
    $aid = (int)$body['areaId'];
    $a = $pdo->prepare("SELECT id FROM areas WHERE id = :id LIMIT 1");
    $a->execute([':id' => $aid]);
    if (!$a->fetch()) Response::error('Area no encontrada', 404);
    $row['area_id'] = $aid;
}
if (isset($body['slug'])) {
    $slug = strtolower(trim((string)$body['slug']));
    if ($slug !== '' && $slug !== $row['slug']) {
        $dup = $pdo->prepare("SELECT id FROM tipos_solicitud WHERE area_id = :a AND slug = :s AND id <> :id LIMIT 1");
        $dup->execute([':a' => $row['area_id'], ':s' => $slug, ':id' => $id]);
        if ($dup->fetch()) Response::error('Ya existe un tipo con ese identificador', 409);
        $row['slug'] = $slug;
    }
}
if (array_key_exists('activo', $body)) $row['activo'] = (int)(bool)$body['activo'];
if (array_key_exists('orden', $body)) $row['orden'] = (int)$body['orden'];
if (array_key_exists('camposPlantilla', $body) && is_array($body['camposPlantilla'])) {
    $row['campos_plantilla'] = json_encode($body['camposPlantilla'], JSON_UNESCAPED_UNICODE);
}
if (array_key_exists('flujoAprobacion', $body) && is_array($body['flujoAprobacion'])) {
    $row['flujo_aprobacion'] = json_encode($body['flujoAprobacion'], JSON_UNESCAPED_UNICODE);
}
if (array_key_exists('flujoAreas', $body)) {
    $row['flujo_areas'] = is_array($body['flujoAreas'])
        ? json_encode($body['flujoAreas'], JSON_UNESCAPED_UNICODE)
        : null;
}
if (array_key_exists('plantillaPdf', $body)) {
    $row['plantilla_pdf'] = is_array($body['plantillaPdf'])
        ? json_encode($body['plantillaPdf'], JSON_UNESCAPED_UNICODE)
        : null;
}
/* configuracionTipo — config de topes/areasVisibles, campo separado para no pisar camposPlantilla */
$configTipoRaw = null;
if (array_key_exists('configuracionTipo', $body)) {
    $v = $body['configuracionTipo'];
    $configTipoRaw = ($v === null) ? null : json_encode($v, JSON_UNESCAPED_UNICODE);
} else {
    $configTipoRaw = $row['configuracion_tipo'] ?? null;
}

$upd = $pdo->prepare(
    "UPDATE tipos_solicitud SET
       area_id = :a, nombre = :n, descripcion = :d, slug = :s,
       activo = :ac, orden = :o, campos_plantilla = :c, flujo_aprobacion = :f,
       flujo_areas = :fa, plantilla_pdf = :pp, configuracion_tipo = :ct
     WHERE id = :id"
);
$upd->execute([
    ':a'  => (int)$row['area_id'],
    ':n'  => $row['nombre'],
    ':d'  => $row['descripcion'],
    ':s'  => $row['slug'],
    ':ac' => (int)$row['activo'],
    ':o'  => (int)$row['orden'],
    ':c'  => is_string($row['campos_plantilla']) ? $row['campos_plantilla'] : json_encode($row['campos_plantilla'], JSON_UNESCAPED_UNICODE),
    ':f'  => is_string($row['flujo_aprobacion']) ? $row['flujo_aprobacion'] : json_encode($row['flujo_aprobacion'], JSON_UNESCAPED_UNICODE),
    ':fa' => isset($row['flujo_areas']) ? (is_string($row['flujo_areas']) ? $row['flujo_areas'] : json_encode($row['flujo_areas'], JSON_UNESCAPED_UNICODE)) : null,
    ':pp' => isset($row['plantilla_pdf']) ? (is_string($row['plantilla_pdf']) ? $row['plantilla_pdf'] : json_encode($row['plantilla_pdf'], JSON_UNESCAPED_UNICODE)) : null,
    ':ct' => $configTipoRaw,
    ':id' => $id,
]);

$sel = $pdo->prepare(
    "SELECT t.*, a.nombre AS area_nombre, a.slug AS area_slug
     FROM tipos_solicitud t INNER JOIN areas a ON a.id = t.area_id
     WHERE t.id = :id"
);
$sel->execute([':id' => $id]);
$r = $sel->fetch();

Response::json([
    'id'              => (int)$r['id'],
    'areaId'          => (int)$r['area_id'],
    'areaNombre'      => $r['area_nombre'],
    'areaSlug'        => $r['area_slug'],
    'nombre'          => $r['nombre'],
    'descripcion'     => $r['descripcion'],
    'slug'            => $r['slug'],
    'activo'          => (bool)$r['activo'],
    'orden'           => (int)$r['orden'],
    'camposPlantilla'   => json_decode($r['campos_plantilla'] ?? '[]', true) ?: [],
    'flujoAprobacion'   => json_decode($r['flujo_aprobacion'] ?? '[]', true) ?: [],
    'flujoAreas'        => $r['flujo_areas'] ? (json_decode($r['flujo_areas'], true) ?: null) : null,
    'plantillaPdf'      => $r['plantilla_pdf'] ? (json_decode($r['plantilla_pdf'], true) ?: null) : null,
    'configuracionTipo' => isset($r['configuracion_tipo']) && $r['configuracion_tipo']
                            ? (json_decode($r['configuracion_tipo'], true) ?: null) : null,
    'creadoEn'          => $r['creado_en'],
]);
