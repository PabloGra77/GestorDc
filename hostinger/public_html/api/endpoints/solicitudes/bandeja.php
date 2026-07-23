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
$rol = strtolower(trim($user['rol'] ?? ''));
$esAdmin = $rol === 'administrador';
$esGerente = $rol === 'gerente';

$params = [];
if ($esAdmin || $esGerente) {
    $where = "(s.estado = 'en_validacion' OR s.estado IN ('por_legalizar','en_legalizacion'))";
} elseif ($nivel === 'contabilidad') {
    $where = "((s.estado = 'en_validacion' AND s.paso_actual = 'contabilidad') OR s.estado IN ('por_legalizar','en_legalizacion'))";
} elseif ($nivel) {
    // Tiene nivel de aprobación: ve solicitudes de su área en su paso + las donde es autorizador
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
