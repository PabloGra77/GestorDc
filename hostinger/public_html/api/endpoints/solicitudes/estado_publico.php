<?php
declare(strict_types=1);

Throttle::hit('sol-estado:' . Throttle::clientIp(), 15, 60);

$numero = strtoupper(trim((string)Request::query('numero')));
$cc = preg_replace('/\D/', '', (string)Request::query('cc')) ?? '';

if ($numero === '' || strlen($cc) < 5) {
    Response::error('Debes ingresar numero de radicado y cedula', 400);
}

$pdo = Db::pdo();
$stmt = $pdo->prepare(
    "SELECT s.*, t.nombre AS tipo_nombre, t.flujo_aprobacion,
            a.nombre AS area_nombre
     FROM solicitudes s
     INNER JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
     INNER JOIN areas a ON a.id = s.area_id
     WHERE s.numero_radicado = :n LIMIT 1"
);
$stmt->execute([':n' => $numero]);
$sol = $stmt->fetch();

if (!$sol || preg_replace('/\D/', '', (string)($sol['solicitante_documento'] ?? '')) !== $cc) {
    // Respuesta generica para no revelar si el radicado existe
    Response::json([
        'autorizado' => false,
        'mensaje' => 'No se encontro una solicitud con esos datos o la cedula no coincide.',
    ]);
}

$mov = $pdo->prepare(
    "SELECT * FROM solicitud_movimientos
     WHERE solicitud_id = :s AND visibilidad = 'publico'
     ORDER BY creado_en ASC"
);
$mov->execute([':s' => $sol['id']]);
$movimientos = $mov->fetchAll();

$flujo = json_decode($sol['flujo_aprobacion'] ?? '[]', true) ?: [];
usort($flujo, fn($a, $b) => ($a['orden'] ?? 0) <=> ($b['orden'] ?? 0));

$pasosCompletados = [];
foreach ($movimientos as $m) {
    if (in_array($m['accion'], ['validada', 'aprobada'], true) && $m['paso']) {
        $pasosCompletados[$m['paso']] = true;
    }
}

$trazado = array_map(function ($p) use ($sol, $pasosCompletados) {
    $estado = 'pendiente';
    if (!empty($pasosCompletados[$p['rol'] ?? ''])) $estado = 'completado';
    elseif (($sol['paso_actual'] ?? '') === ($p['rol'] ?? '') && $sol['estado'] === 'en_validacion') $estado = 'en_curso';
    return [
        'rol' => $p['rol'] ?? '',
        'label' => $p['label'] ?? '',
        'orden' => (int)($p['orden'] ?? 0),
        'estado' => $estado,
    ];
}, $flujo);

Response::json([
    'autorizado' => true,
    'numeroRadicado' => $sol['numero_radicado'],
    'tipoNombre' => $sol['tipo_nombre'],
    'areaNombre' => $sol['area_nombre'],
    'estado' => $sol['estado'],
    'pasoActual' => $sol['paso_actual'],
    'creadoEn' => $sol['creado_en'],
    'aprobadoEn' => $sol['aprobado_en'],
    'trazado' => $trazado,
    'movimientosPublicos' => array_map(fn($m) => [
        'accion' => $m['accion'],
        'paso' => $m['paso'],
        'estadoResultado' => $m['estado_resultado'],
        'comentario' => $m['comentario'],
        'creadoEn' => $m['creado_en'],
    ], $movimientos),
]);
