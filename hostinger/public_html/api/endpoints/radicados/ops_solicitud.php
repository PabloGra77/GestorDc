<?php
declare(strict_types=1);

require_once __DIR__ . '/_helpers.php';

// Rate limiting agresivo: solicitudes anonimas pueden disparar correos SMTP.
Throttle::hit('ops-sol:' . Throttle::clientIp(), 3, 60);
Throttle::hit('ops-sol-hour:' . Throttle::clientIp(), 15, 3600);

$body = Request::body();
$correoSolicitado = strtolower(trim((string)($body['correoSolicitado'] ?? '')));
$numeroCcSolicitado = RadicadoHelpers::normalizarCc((string)($body['numeroCcSolicitado'] ?? ''));
$nombreSolicitado = trim((string)($body['nombreSolicitado'] ?? ''));
$documentosSolicitados = array_values(array_filter(array_map(
    fn($d) => trim((string)$d),
    is_array($body['documentosSolicitados'] ?? null) ? $body['documentosSolicitados'] : []
)));

if (!RadicadoHelpers::correoValido($correoSolicitado)) {
    Response::error('Correo solicitado invalido', 400);
}
if (strlen($numeroCcSolicitado) < 5) {
    Response::error('Numero de CC invalido', 400);
}
if (empty($documentosSolicitados)) {
    Response::error('Debes incluir al menos un documento solicitado', 400);
}

$pdo = Db::pdo();
$numero = RadicadoHelpers::generarNumero($pdo, 'Operaciones');
$referencia = RadicadoHelpers::generarReferenciaOps($pdo, $numeroCcSolicitado);
$asunto = 'Cuenta de cobro OPS - ' . ($nombreSolicitado !== '' ? $nombreSolicitado : $numeroCcSolicitado);
$datosPlantilla = is_array($body['datosPlantilla'] ?? null) ? $body['datosPlantilla'] : null;

$ins = $pdo->prepare(
    "INSERT INTO radicados
     (numero, referencia, asunto, estado, tipo, solicitante_correo, solicitante_cc,
      documentos_solicitados, documentos_adjuntos, datos_plantilla)
     VALUES (:n, :r, :a, 'Solicitud OPS enviada', 'CuentaCobroOPS',
             :sc, :scc, :ds, JSON_ARRAY(), :dp)"
);
$ins->execute([
    ':n' => $numero,
    ':r' => $referencia,
    ':a' => $asunto,
    ':sc' => $correoSolicitado,
    ':scc' => $numeroCcSolicitado,
    ':ds' => json_encode($documentosSolicitados, JSON_UNESCAPED_UNICODE),
    ':dp' => $datosPlantilla ? json_encode($datosPlantilla, JSON_UNESCAPED_UNICODE) : null,
]);
$id = (int)$pdo->lastInsertId();

$base = rtrim(Config::get('WEB_BASE_URL', ''), '/');
$linkCarga = $base . '/radicacion-cuenta-cobro-ops?radicado=' . urlencode($numero);

try {
    $obs = trim((string)($body['observaciones'] ?? '')) ?: 'Sin observaciones adicionales';
    $text = "Gestor Documental - Solicitud de radicacion de cuenta de cobro OPS\n\n"
          . "Numero de radicado: {$numero}\nReferencia: {$referencia}\n\n"
          . "Documentos solicitados:\n- " . implode("\n- ", $documentosSolicitados) . "\n\n"
          . "Ingresa al siguiente enlace para cargar los soportes: {$linkCarga}\n"
          . "Debes verificarte con tu numero de CC: {$numeroCcSolicitado}\n\n"
          . "Observaciones: {$obs}";
    Mailer::send([
        'to'      => [$correoSolicitado],
        'subject' => "[OPS - Cuenta de cobro] Radicado {$numero}",
        'text'    => $text,
    ]);
} catch (Throwable $e) {
    error_log("Correo OPS {$numero} fallo: " . $e->getMessage());
}

Response::json([
    'id'                    => $id,
    'numero'                => $numero,
    'referencia'            => $referencia,
    'estado'                => 'Solicitud OPS enviada',
    'linkCarga'             => $linkCarga,
    'correoSolicitado'      => $correoSolicitado,
    'documentosSolicitados' => $documentosSolicitados,
], 201);
