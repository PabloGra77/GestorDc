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

$rol = strtolower(trim($user['rol'] ?? ''));
$nivelDb = strtolower(trim($user['nivel_aprobacion'] ?? ''));
$esAdmin = $rol === 'administrador';
$esGerente = $rol === 'gerente';
// Nivel principal: rol si corresponde a un nivel de validación conocido; sino, nivel_aprobacion.
$nivelesConocidos = ['analista', 'coordinador', 'director', 'contabilidad', 'tesoreria', 'gerencia'];
$nivel = in_array($rol, $nivelesConocidos, true)
    ? $rol
    : $nivelDb;
// Si el nivel_aprobacion en BD es 'contabilidad' pero el rol es otro (ej. director),
// el usuario tiene permiso adicional sobre el paso final de contabilidad.
$tambiénEsContabilidad = ($nivel !== 'contabilidad' && $nivelDb === 'contabilidad');

$params = [];
if ($esAdmin || $esGerente) {
    $where = "(s.estado = 'en_validacion' OR s.estado IN ('por_legalizar','en_legalizacion'))";
} elseif ($nivel === 'contabilidad') {
    $where = "((s.estado = 'en_validacion' AND s.paso_actual = 'contabilidad') OR s.estado IN ('por_legalizar','en_legalizacion'))";
} elseif ($tambiénEsContabilidad && $nivel !== '') {
    // Usuario con rol de área (analista/coordinador/director) Y nivel_aprobacion = contabilidad:
    // ve solicitudes intermedias de su área + el paso final de contabilidad + legalizaciones.
    $where = "(
      (s.estado = 'en_validacion'
       AND s.paso_actual NOT IN ('autorizador_visto_bueno', 'contabilidad')
       AND s.area_id = :aid)
      OR
      (s.estado = 'en_validacion' AND s.paso_actual = 'autorizador_visto_bueno'
       AND JSON_UNQUOTE(JSON_EXTRACT(s.datos_formulario, '$.autorizadorId')) = :uid_str)
      OR
      (s.estado = 'en_validacion' AND s.paso_actual = 'contabilidad')
      OR
      s.estado IN ('por_legalizar','en_legalizacion')
      OR
      (s.estado IN ('aprobado','rechazado','devuelto','legalizado')
       AND s.area_id = :aid2
       AND s.creado_en >= DATE_SUB(NOW(), INTERVAL 90 DAY))
    )";
    $params[':aid']     = (int)($user['area_id'] ?? 0);
    $params[':aid2']    = (int)($user['area_id'] ?? 0);
    $params[':uid_str'] = (string)$usuarioId;
} elseif ($nivel !== '') {
    // Usuario con nivel de área: ve pasos intermedios de su área, visto bueno propio e historial.
    $where = "(
      (s.estado = 'en_validacion'
       AND s.paso_actual NOT IN ('autorizador_visto_bueno', 'contabilidad')
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

Response::json([
    'nivelAprobacion' => $nivel ?: null,
    'items' => array_map(function ($r) {
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
    }, $rows),
]);
