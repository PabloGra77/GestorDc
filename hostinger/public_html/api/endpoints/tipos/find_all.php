<?php
declare(strict_types=1);

Auth::requireUser();

$areaId = isset($_GET['area_id']) ? (int)$_GET['area_id'] : null;
$pdo = Db::pdo();
if ($areaId) {
    $stmt = $pdo->prepare(
        "SELECT t.*, a.nombre AS area_nombre, a.slug AS area_slug
         FROM tipos_solicitud t
         INNER JOIN areas a ON a.id = t.area_id
         WHERE t.area_id = :a
         ORDER BY t.orden ASC, t.nombre ASC"
    );
    $stmt->execute([':a' => $areaId]);
} else {
    $stmt = $pdo->query(
        "SELECT t.*, a.nombre AS area_nombre, a.slug AS area_slug
         FROM tipos_solicitud t
         INNER JOIN areas a ON a.id = t.area_id
         ORDER BY a.orden ASC, t.orden ASC, t.nombre ASC"
    );
}
$rows = $stmt->fetchAll();

Response::json(array_map(function ($row) {
    return [
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
    ];
}, $rows));
