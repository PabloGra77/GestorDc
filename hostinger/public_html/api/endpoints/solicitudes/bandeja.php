<?php
declare(strict_types=1);

$jwt = Auth::requireUser();
$usuarioId = (int)$jwt['sub'];

$pdo = Db::pdo();
$uStmt = $pdo->prepare(
    "SELECT u.area_id, u.nivel_aprobacion, r.nombre AS rol
     FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id WHERE u.id = :id LIMIT 1"
);
$uStmt->execute([':id' => $usuarioId]);
$user = $uStmt->fetch();
if (!$user) Response::error('Usuario no encontrado', 404);

$nivel = $user['nivel_aprobacion'] ?? '';
$esAdmin = strtolower(trim($user['rol'] ?? '')) === 'administrador';

if (!$nivel && !$esAdmin) {
    Response::json([]); // sin nivel y no admin, sin bandeja
}

$where = "s.estado = 'en_validacion'";
$params = [];
if ($esAdmin) {
    // admin ve todo
} elseif ($nivel === 'contabilidad') {
    $where .= " AND s.paso_actual = 'contabilidad'";
} else {
    $where .= " AND s.paso_actual = :nivel AND s.area_id = :aid";
    $params[':nivel'] = $nivel;
    $params[':aid']   = (int)($user['area_id'] ?? 0);
}

$sql = "SELECT s.*, t.nombre AS tipo_nombre, t.slug AS tipo_slug, a.nombre AS area_nombre
        FROM solicitudes s
        INNER JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
        INNER JOIN areas a ON a.id = s.area_id
        WHERE {$where}
        ORDER BY s.creado_en ASC
        LIMIT 200";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

Response::json(array_map(function ($r) {
    return [
        'id'                  => (int)$r['id'],
        'numeroRadicado'      => $r['numero_radicado'],
        'tipoNombre'          => $r['tipo_nombre'],
        'areaNombre'          => $r['area_nombre'],
        'solicitanteNombre'   => $r['solicitante_nombre'],
        'solicitanteCorreo'   => $r['solicitante_correo'],
        'estado'              => $r['estado'],
        'pasoActual'          => $r['paso_actual'],
        'pasoOrden'           => (int)$r['paso_orden'],
        'creadoEn'            => $r['creado_en'],
        'alertasCount'        => count(json_decode($r['alertas'] ?? '[]', true) ?: []),
    ];
}, $rows));
