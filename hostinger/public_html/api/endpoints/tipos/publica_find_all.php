<?php
declare(strict_types=1);

Throttle::hit('tipos-pub:' . Throttle::clientIp(), 60, 60);

$areaId = isset($_GET['area_id']) ? (int)$_GET['area_id'] : null;
$pdo = Db::pdo();

if ($areaId) {
    $stmt = $pdo->prepare(
        "SELECT t.id, t.area_id, t.nombre, t.descripcion, t.slug, t.orden,
                t.campos_plantilla, t.flujo_aprobacion, t.flujo_areas, t.plantilla_pdf,
                a.nombre AS area_nombre, a.slug AS area_slug
         FROM tipos_solicitud t
         INNER JOIN areas a ON a.id = t.area_id
         WHERE t.activo = 1 AND a.activo = 1 AND t.area_id = :a
         ORDER BY t.orden ASC, t.nombre ASC"
    );
    $stmt->execute([':a' => $areaId]);
} else {
    $stmt = $pdo->query(
        "SELECT t.id, t.area_id, t.nombre, t.descripcion, t.slug, t.orden,
                t.campos_plantilla, t.flujo_aprobacion, t.flujo_areas, t.plantilla_pdf,
                a.nombre AS area_nombre, a.slug AS area_slug
         FROM tipos_solicitud t
         INNER JOIN areas a ON a.id = t.area_id
         WHERE t.activo = 1 AND a.activo = 1
         ORDER BY a.orden ASC, t.orden ASC, t.nombre ASC"
    );
}
$rows = $stmt->fetchAll();

Response::json(array_map(fn($r) => [
    'id'              => (int)$r['id'],
    'areaId'          => (int)$r['area_id'],
    'areaNombre'      => $r['area_nombre'],
    'areaSlug'        => $r['area_slug'],
    'nombre'          => $r['nombre'],
    'descripcion'     => $r['descripcion'],
    'slug'            => $r['slug'],
    'orden'           => (int)$r['orden'],
    'camposPlantilla' => json_decode($r['campos_plantilla'] ?? '[]', true) ?: [],
    'flujoAreas'      => $r['flujo_areas'] ? (json_decode($r['flujo_areas'], true) ?: null) : null,
    'plantillaPdf'    => $r['plantilla_pdf'] ? (json_decode($r['plantilla_pdf'], true) ?: null) : null,
], $rows));
