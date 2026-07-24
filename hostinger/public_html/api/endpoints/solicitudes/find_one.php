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
$rolNorm    = strtolower(trim($user['rol'] ?? ''));
$esAdmin    = $rolNorm === 'administrador';
$esGerente  = $rolNorm === 'gerente';

$esSolicitante  = (int)$r['solicitante_usuario_id'] === $usuarioId;
$nivelUser      = strtolower(trim($user['nivel_aprobacion'] ?? ''));
$mismaArea      = (int)($user['area_id'] ?? 0) === (int)$r['area_id'];
$esContabilidad = $nivelUser === 'contabilidad';
$pasoActual     = strtolower(trim((string)($r['paso_actual'] ?? '')));
$estadoCerrado  = in_array((string)$r['estado'], ['aprobado', 'rechazado', 'devuelto', 'legalizado'], true);

// Último paso del flujo (área final) — para saber si pasoActual es intermedio
$flujoArr      = (function($v){ $d = json_decode($v ?? '[]', true); return (is_array($d) && array_is_list($d)) ? $d : []; })($r['flujo_aprobacion']);
usort($flujoArr, fn($a, $b) => ($a['orden'] ?? 0) <=> ($b['orden'] ?? 0));
$ultimoPasoRol = count($flujoArr) > 0
    ? strtolower(trim((string)($flujoArr[count($flujoArr) - 1]['rol'] ?? '')))
    : '';

// Pasos intermedios (no visto bueno y no área final) son visibles a cualquier miembro del área con nivel.
// El último paso (área final) solo lo ve quien tiene ese nivel exacto o el área que aplica.
$esPasoIntermedio = $pasoActual !== '' && $pasoActual !== 'autorizador_visto_bueno' && $pasoActual !== $ultimoPasoRol;
$nivelHabilitado = $nivelUser !== '' && (
    $estadoCerrado ||
    $nivelUser === $pasoActual ||
    $esPasoIntermedio
);
$esValidadorEnTurno = $nivelHabilitado && ($esContabilidad || $mismaArea);

// Autorizador designado: puede ver solo cuando es su turno (paso autorizador_visto_bueno)
$datos = json_decode($r['datos_formulario'] ?? '{}', true) ?: [];
$esAutorizadorDesignado = (int)($datos['autorizadorId'] ?? 0) === $usuarioId;
$esAutorizador = $esAutorizadorDesignado && $pasoActual === 'autorizador_visto_bueno';

if (!$esAdmin && !$esGerente && !$esSolicitante && !$esValidadorEnTurno && !$esAutorizador) {
    Response::error('No tienes permiso para ver esta solicitud', 403);
}

// Firmas: visibles a todos quienes pueden ver la solicitud (necesario para PDF y trazabilidad)
$puedeVerFirmas = true;

// Movimientos
$movStmt = $pdo->prepare(
    "SELECT * FROM solicitud_movimientos
     WHERE solicitud_id = :s
     ORDER BY creado_en ASC"
);
$movStmt->execute([':s' => $id]);
$movimientos = $movStmt->fetchAll();

// ── Comparación de atenciones OPS ──────────────────────────────────
$comparacionOps = null;
if (($r['tipo_slug'] ?? '') === 'cuenta-cobro-ops') {
    $datos = json_decode($r['datos_formulario'] ?? '{}', true) ?: [];

    // CC del profesional (solo dígitos)
    $ccRaw = (string)($datos['numeroDocumento'] ?? $datos['numero_documento'] ?? '');
    $cc    = preg_replace('/[^0-9]/', '', $ccRaw);

    // Atenciones declaradas: sumar campo hc de cada fila de atencionesJson
    $atencionesDeclaradas = 0;
    $atJson = $datos['atencionesJson'] ?? null;
    if ($atJson && is_string($atJson)) {
        $filas = json_decode($atJson, true) ?: [];
        foreach ($filas as $fila) {
            $atencionesDeclaradas += (int)($fila['hc'] ?? 0);
        }
    }

    $comparacionOps = [
        'atencionesDeclaradas' => $atencionesDeclaradas,
        'valorDeclarado'       => null,
        'ccProfesional'        => $cc,
        'sinInforme'           => true,
        'informeId'            => null,
        'informeNombre'        => null,
        'periodoInforme'       => null,
        'atencionesEnInforme'  => null,
        'valorCalculado'       => null,
        'desglose'             => [],
    ];

    if ($cc) {
        try {
            $infStmt = $pdo->query(
                "SELECT id, nombre, periodo_inicio, periodo_fin
                 FROM informes_ops ORDER BY subido_en DESC LIMIT 1"
            );
            $inf = $infStmt->fetch();
            if ($inf) {
                $infId = (int)$inf['id'];

                // Desglose por servicio con tarifa
                $dsgStmt = $pdo->prepare(
                    "SELECT d.servicio,
                            SUM(d.numero_sesiones) AS total_sesiones,
                            COALESCE(t.valor_unitario, 0) AS tarifa,
                            COALESCE(t.tipo_servicio, 'sm') AS tipo_servicio
                     FROM informe_atenciones_detalle d
                     LEFT JOIN tarifas_ops t ON t.servicio = d.servicio
                     WHERE d.informe_id = :inf AND d.cc_profesional = :cc
                     GROUP BY d.servicio, t.valor_unitario, t.tipo_servicio
                     ORDER BY d.servicio"
                );
                $dsgStmt->execute([':inf' => $infId, ':cc' => $cc]);
                $desglose = $dsgStmt->fetchAll();

                $atencionesEnInforme = 0;
                $valorCalculado      = 0.0;
                $desgloseArr         = [];

                foreach ($desglose as $ds) {
                    $sesiones = (int)$ds['total_sesiones'];
                    $tarifa   = (float)$ds['tarifa'];
                    $subtotal = $sesiones * $tarifa;
                    $atencionesEnInforme += $sesiones;
                    $valorCalculado      += $subtotal;
                    $desgloseArr[]        = [
                        'servicio'      => $ds['servicio'] ?? 'Sin servicio',
                        'tipoServicio'  => $ds['tipo_servicio'],
                        'sesiones'      => $sesiones,
                        'tarifa'        => $tarifa,
                        'subtotal'      => $subtotal,
                    ];
                }

                $comparacionOps['sinInforme']          = false;
                $comparacionOps['informeId']           = $infId;
                $comparacionOps['informeNombre']       = $inf['nombre'];
                $comparacionOps['periodoInforme']      = trim(($inf['periodo_inicio'] ?? '') . ' / ' . ($inf['periodo_fin'] ?? ''), '/ ');
                $comparacionOps['atencionesEnInforme'] = $atencionesEnInforme;
                $comparacionOps['valorCalculado']      = $valorCalculado;
                $comparacionOps['desglose']            = $desgloseArr;
            }
        } catch (Throwable) {}
    }
}

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
    'comparacionOps'      => $comparacionOps,
]);
