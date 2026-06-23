<?php
declare(strict_types=1);

$jwt = Auth::requireUser();
$usuarioId = (int)($jwt['sub'] ?? 0);

$pdo = Db::pdo();

// Verificar rol del usuario
$uStmt = $pdo->prepare(
    "SELECT u.id, u.nombre_completo, u.area_id, u.nivel_aprobacion, r.nombre AS rol
     FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = :id LIMIT 1"
);
$uStmt->execute([':id' => $usuarioId]);
$user = $uStmt->fetch();
if (!$user) Response::error('Usuario no encontrado', 404);

$esAdmin = strtolower(trim($user['rol'] ?? '')) === 'administrador';
$miArea = $user['area_id'] ?? null;

// Admin ve todo, otros ven solo lo suyo o de su area
$where = '';
$params = [];
if (!$esAdmin) {
    // Ve sus propias solicitudes + las de su area si tiene nivel
    if ($miArea && !empty($user['nivel_aprobacion'])) {
        $where = "WHERE s.solicitante_usuario_id = :uid OR s.area_id = :aid";
        $params = [':uid' => $usuarioId, ':aid' => (int)$miArea];
    } else {
        $where = "WHERE s.solicitante_usuario_id = :uid";
        $params = [':uid' => $usuarioId];
    }
}

$sql = "SELECT s.*, t.nombre AS tipo_nombre, t.slug AS tipo_slug, a.nombre AS area_nombre,
               (SELECT m.comentario FROM solicitud_movimientos m
                WHERE m.solicitud_id = s.id ORDER BY m.creado_en DESC LIMIT 1) AS ultimo_comentario
        FROM solicitudes s
        INNER JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
        INNER JOIN areas a ON a.id = s.area_id
        {$where}
        ORDER BY s.creado_en DESC
        LIMIT 200";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

Response::json(array_map(function ($r) {
    return [
        'id'                  => (int)$r['id'],
        'numeroRadicado'      => $r['numero_radicado'],
        'tipoSolicitudId'     => (int)$r['tipo_solicitud_id'],
        'tipoNombre'          => $r['tipo_nombre'],
        'tipoSlug'            => $r['tipo_slug'],
        'areaId'              => (int)$r['area_id'],
        'areaNombre'          => $r['area_nombre'],
        'solicitanteNombre'   => $r['solicitante_nombre'],
        'solicitanteCorreo'   => $r['solicitante_correo'],
        'estado'              => $r['estado'],
        'pasoActual'          => $r['paso_actual'],
        'pasoOrden'           => (int)$r['paso_orden'],
        'creadoEn'            => $r['creado_en'],
        'actualizadoEn'       => $r['actualizado_en'],
        'aprobadoEn'          => $r['aprobado_en'],
        'alertasCount'        => count(json_decode($r['alertas'] ?? '[]', true) ?: []),
        'ultimoComentario'    => $r['ultimo_comentario'],
    ];
}, $rows));
