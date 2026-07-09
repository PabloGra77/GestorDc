<?php
declare(strict_types=1);

$jwt = Auth::requireUser();
$usuarioId = (int)($jwt['sub'] ?? 0);
$id = (int)($params['id'] ?? 0);

$pdo = Db::pdo();

$stmt = $pdo->prepare(
    "SELECT s.*, t.nombre AS tipo_nombre, t.slug AS tipo_slug,
            t.campos_plantilla, t.flujo_aprobacion, t.plantilla_pdf,
            a.nombre AS area_nombre, a.slug AS area_slug
     FROM solicitudes s
     INNER JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
     INNER JOIN areas a ON a.id = s.area_id
     WHERE s.id = :id LIMIT 1"
);
$stmt->execute([':id' => $id]);
$r = $stmt->fetch();
if (!$r) Response::error('Solicitud no encontrada', 404);

// Verificar permisos: solicitante, mismo area, o admin
$uStmt = $pdo->prepare(
    "SELECT u.area_id, u.nivel_aprobacion, r.nombre AS rol
     FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id WHERE u.id = :id LIMIT 1"
);
$uStmt->execute([':id' => $usuarioId]);
$user = $uStmt->fetch();
$esAdmin = strtolower(trim($user['rol'] ?? '')) === 'administrador';

$esSolicitante = (int)$r['solicitante_usuario_id'] === $usuarioId;
$nivelUser     = (string)($user['nivel_aprobacion'] ?? '');
$mismaArea     = (int)($user['area_id'] ?? 0) === (int)$r['area_id'];
$esContabilidad = $nivelUser === 'contabilidad';
$pasoActual    = (string)($r['paso_actual'] ?? '');
$estadoCerrado = in_array((string)$r['estado'], ['aprobado', 'rechazado'], true);
$nivelHabilitado = $nivelUser !== '' && ($nivelUser === $pasoActual || $estadoCerrado);
$esValidadorEnTurno = $nivelHabilitado && ($esContabilidad || $mismaArea);

// Autorizador de visto bueno: puede ver si paso_actual = 'autorizador_visto_bueno' y su ID coincide
$esAutorizador = false;
if ($pasoActual === 'autorizador_visto_bueno') {
    $datos = json_decode($r['datos_formulario'] ?? '{}', true) ?: [];
    $esAutorizador = (int)($datos['autorizadorId'] ?? 0) === $usuarioId;
}

if (!$esAdmin && !$esSolicitante && !$esValidadorEnTurno && !$esAutorizador) {
    Response::error('No tienes permiso para ver esta solicitud', 403);
}

// Solo admin y solicitante ven firmas completas; validadores en turno ven todo menos firmas de otros pasos
$puedeVerFirmas = $esAdmin || $esSolicitante;

// Movimientos
$movStmt = $pdo->prepare(
    "SELECT * FROM solicitud_movimientos
     WHERE solicitud_id = :s
     ORDER BY creado_en ASC"
);
$movStmt->execute([':s' => $id]);
$movimientos = $movStmt->fetchAll();

Response::json([
    'id'                  => (int)$r['id'],
    'numeroRadicado'      => $r['numero_radicado'],
    'tipoSolicitudId'     => (int)$r['tipo_solicitud_id'],
    'tipoNombre'          => $r['tipo_nombre'],
    'tipoSlug'            => $r['tipo_slug'],
    'camposPlantilla'     => (function($v){ $d = json_decode($v ?? '[]', true); return (is_array($d) && array_is_list($d)) ? $d : []; })($r['campos_plantilla']),
    'flujoAprobacion'     => (function($v){ $d = json_decode($v ?? '[]', true); return (is_array($d) && array_is_list($d)) ? $d : []; })($r['flujo_aprobacion']),
    'plantillaPdf'        => $r['plantilla_pdf'] ? (json_decode($r['plantilla_pdf'], true) ?: null) : null,
    'areaId'              => (int)$r['area_id'],
    'areaNombre'          => $r['area_nombre'],
    'areaSlug'            => $r['area_slug'],
    'solicitanteNombre'   => $r['solicitante_nombre'],
    'solicitanteCorreo'   => $r['solicitante_correo'],
    'solicitanteDocumento' => $r['solicitante_documento'],
    'datosFormulario'     => json_decode($r['datos_formulario'] ?? '{}', true) ?: [],
    'documentos'          => json_decode($r['documentos'] ?? '[]', true) ?: [],
    'firmas'              => $puedeVerFirmas ? (json_decode($r['firmas'] ?? '{}', true) ?: new stdClass()) : new stdClass(),
    'alertas'             => json_decode($r['alertas'] ?? '[]', true) ?: [],
    'estado'              => $r['estado'],
    'pasoActual'          => $r['paso_actual'],
    'pasoOrden'           => (int)$r['paso_orden'],
    'creadoEn'            => $r['creado_en'],
    'actualizadoEn'       => $r['actualizado_en'],
    'aprobadoEn'          => $r['aprobado_en'],
    'movimientos'         => array_map(fn($m) => [
        'id'             => (int)$m['id'],
        'accion'         => $m['accion'],
        'paso'           => $m['paso'],
        'estadoResultado'=> $m['estado_resultado'],
        'usuarioNombre'  => $m['usuario_nombre'],
        'usuarioRol'     => $m['usuario_rol'],
        'comentario'     => $m['comentario'],
        'visibilidad'    => $m['visibilidad'],
        'creadoEn'       => $m['creado_en'],
    ], $movimientos),
]);
