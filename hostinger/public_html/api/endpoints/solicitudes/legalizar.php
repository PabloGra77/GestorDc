<?php
declare(strict_types=1);

// El SOLICITANTE de un anticipo sube las evidencias (facturas/soportes) del gasto.
// La IA (OCR/forense en el cliente) ya analizo los archivos; aqui se guardan y
// se generan alertas. Pasa la solicitud a 'en_legalizacion'.
require_once __DIR__ . '/_flujo.php';

$jwt = Auth::requireUser();
$id = (int)($params['id'] ?? 0);
$body = Request::body();
$docs = is_array($body['documentos'] ?? null) ? $body['documentos'] : [];
$comentario = trim((string)($body['comentario'] ?? ''));
$montoLegalizado = (float)($body['montoLegalizado'] ?? 0);

$pdo = Db::pdo();
$st = $pdo->prepare(
    "SELECT s.*, t.nombre AS tipo_nombre, t.slug AS tipo_slug
     FROM solicitudes s INNER JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
     WHERE s.id = :id LIMIT 1"
);
$st->execute([':id' => $id]);
$sol = $st->fetch();
if (!$sol) Response::error('Solicitud no encontrada', 404);
if ((int)($sol['solicitante_usuario_id'] ?? 0) !== (int)$jwt['sub']) {
    Response::error('Solo el solicitante puede legalizar su anticipo', 403);
}
if (($sol['tipo_slug'] ?? '') !== 'anticipo') {
    Response::error('Esta solicitud no requiere legalizacion', 400);
}
if (!in_array($sol['estado'], ['por_legalizar', 'en_legalizacion'], true)) {
    Response::error('El anticipo no esta en una etapa que permita legalizar', 400);
}
if (count($docs) === 0) Response::error('Adjunta al menos un soporte (factura/recibo)', 400);
if ($montoLegalizado <= 0) Response::error('Indica el monto total de la factura/compra legalizada', 400);

$datosFormulario = json_decode($sol['datos_formulario'] ?? '{}', true) ?: [];
$valorSolicitado = (float)($datosFormulario['valorPesos'] ?? 0);
$saldoPendiente = round($valorSolicitado - $montoLegalizado, 2);

// Limpiar documentos de evidencia + recolectar alertas de la IA
$evid = [];
$alertasNuevas = [];
if ($saldoPendiente < 0) {
    $alertasNuevas[] = [
        'tipo' => 'legalizacion_excede_anticipo',
        'descripcion' => 'El monto legalizado ($' . number_format($montoLegalizado, 0, ',', '.') . ') supera el valor del anticipo ($' . number_format($valorSolicitado, 0, ',', '.') . '). Revisar manualmente.',
        'severidad' => 'media',
    ];
}
foreach ($docs as $k => $info) {
    if (!is_array($info)) continue;
    $entry = [];
    if (isset($info['nombre'])) $entry['nombre'] = mb_substr((string)$info['nombre'], 0, 200);
    if (isset($info['ocrTexto'])) $entry['ocrTexto'] = mb_substr((string)$info['ocrTexto'], 0, 5000);
    if (isset($info['ocrConfianza'])) $entry['ocrConfianza'] = (float)$info['ocrConfianza'];
    if (isset($info['archivoId'])) $entry['archivoId'] = mb_substr((string)$info['archivoId'], 0, 100);
    if (!empty($info['ocrAlertas']) && is_array($info['ocrAlertas'])) {
        $entry['ocrAlertas'] = array_slice(array_map(fn($a) => mb_substr((string)$a, 0, 500), $info['ocrAlertas']), 0, 10);
        foreach ($entry['ocrAlertas'] as $a) {
            $alertasNuevas[] = ['tipo' => 'legalizacion_alerta', 'campo' => (string)$k, 'descripcion' => (string)$a, 'severidad' => 'media'];
        }
    }
    if (isset($entry['ocrConfianza']) && $entry['ocrConfianza'] < 40) {
        $alertasNuevas[] = ['tipo' => 'documento_ilegible', 'campo' => (string)$k, 'descripcion' => "Soporte ilegible: {$k}", 'severidad' => 'alta'];
    }
    $evid[(string)$k] = $entry;
}

$evid['_resumen'] = [
    'valorSolicitado'  => $valorSolicitado,
    'montoLegalizado'  => $montoLegalizado,
    'saldoPendiente'   => $saldoPendiente,
];

$documentos = json_decode($sol['documentos'] ?? '{}', true) ?: [];
$documentos['__legalizacion'] = $evid;
$alertas = json_decode($sol['alertas'] ?? '[]', true) ?: [];
$alertas = array_merge($alertas, $alertasNuevas);

$pdo->beginTransaction();
try {
    $up = $pdo->prepare(
        "UPDATE solicitudes SET estado = 'en_legalizacion', documentos = :doc, alertas = :ale
         WHERE id = :id AND estado IN ('por_legalizar','en_legalizacion')"
    );
    $up->execute([
        ':doc' => json_encode($documentos, JSON_UNESCAPED_UNICODE),
        ':ale' => json_encode($alertas, JSON_UNESCAPED_UNICODE),
        ':id'  => $id,
    ]);
    $userArr = ['id' => (int)$jwt['sub'], 'nombre_completo' => $sol['solicitante_nombre'] ?? '', 'nivel_aprobacion' => 'profesional'];
    FlujoHelpers::registrarMovimiento($pdo, $id, 'legalizacion_enviada', null, 'en_legalizacion', $userArr,
        $comentario !== '' ? $comentario : 'Soportes de legalizacion enviados (' . count($evid) . ')', 'publico');
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[legalizar] ' . $e->getMessage());
    Response::error('No se pudo registrar la legalizacion', 500);
}

// Avisar al area final (Contabilidad) que hay legalizacion por revisar
FlujoHelpers::notificarValidadores($pdo, [
    'numero_radicado'    => $sol['numero_radicado'],
    'tipo_nombre'        => $sol['tipo_nombre'] ?? 'Anticipo',
    'solicitante_nombre' => $sol['solicitante_nombre'] ?? '',
], 'contabilidad', (int)$sol['area_id']);

Response::json(['ok' => true, 'estado' => 'en_legalizacion', 'alertas' => $alertasNuevas]);
