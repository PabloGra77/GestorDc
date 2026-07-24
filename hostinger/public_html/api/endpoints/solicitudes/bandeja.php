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

$nivel = strtolower(trim($user['nivel_aprobacion'] ?? ''));
$rol = strtolower(trim($user['rol'] ?? ''));
$esAdmin = $rol === 'administrador';
$esGerente = $rol === 'gerente';

$params = [];
if ($esAdmin || $esGerente) {
    $where = "(s.estado = 'en_validacion' OR s.estado IN ('por_legalizar','en_legalizacion'))";
} elseif ($nivel === 'contabilidad') {
    $where = "((s.estado = 'en_validacion' AND s.paso_actual = 'contabilidad') OR s.estado IN ('por_legalizar','en_legalizacion'))";
} elseif (in_array($nivel, ['analista', 'coordinador', 'director'])) {
    // Los tres niveles del área ven:
    // 1. Pasos jerárquicos de su área.
    // 2. Solicitudes donde sean el autorizador del visto bueno (aún pendiente).
    // 3. Historial del área (completadas últimos 90 días).
    // NOTA: el autorizador NO ve el paso siguiente (analista/coordinador/director)
    //       a menos que pertenezca al área — esto evita que valide múltiples pasos.
    $where = "(
      (s.estado = 'en_validacion'
       AND s.paso_actual IN ('analista','coordinador','director')
       AND s.area_id = :aid)
      OR
      (s.estado = 'en_validacion' AND s.paso_actual = 'autorizador_visto_bueno'
       AND JSON_UNQUOTE(JSON_EXTRACT(s.datos_formulario, '$.autorizadorId')) = :uid_str)
      OR
      (s.estado IN ('aprobado','rechazado','devuelto','legalizado')
       AND s.area_id = :aid2
       AND s.creado_en >= DATE_SUB(NOW(), INTERVAL 90 DAY))
    )";
    $params[':aid']     = (int)($user['area_id'] ?? 0);
    $params[':aid2']    = (int)($user['area_id'] ?? 0);
    $params[':uid_str'] = (string)$usuarioId;
} elseif ($nivel) {
    // Otro nivel (ej. contabilidad ya se maneja arriba, pero por seguridad)
    $where = "(
      (s.estado = 'en_validacion' AND s.paso_actual = :nivel AND s.area_id = :aid)
      OR
      (s.estado = 'en_validacion' AND s.paso_actual = 'autorizador_visto_bueno'
       AND JSON_UNQUOTE(JSON_EXTRACT(s.datos_formulario, '$.autorizadorId')) = :uid_str)
    )";
    $params[':nivel']   = $nivel;
    $params[':aid']     = (int)($user['area_id'] ?? 0);
    $params[':uid_str'] = (string)$usuarioId;
} else {
    // Sin nivel formal: solo ve solicitudes donde fue designado autorizador
    $where = "(
      s.estado = 'en_validacion' AND s.paso_actual = 'autorizador_visto_bueno'
      AND JSON_UNQUOTE(JSON_EXTRACT(s.datos_formulario, '$.autorizadorId')) = :uid_str
    )";
    $params[':uid_str'] = (string)$usuarioId;
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
