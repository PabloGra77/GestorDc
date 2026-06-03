<?php
declare(strict_types=1);

require_once __DIR__ . '/_helpers.php';

// Rate limiting agresivo: evitar fuerza bruta de CC contra radicados existentes.
Throttle::hit('ops-ver:' . Throttle::clientIp(), 10, 60);
Throttle::hit('ops-ver-hour:' . Throttle::clientIp(), 60, 3600);

$numero = Request::query('numero') ?? '';
$cc = Request::query('cc') ?? '';
$numeroN = strtoupper(trim($numero));
$ccN = RadicadoHelpers::normalizarCc(trim($cc));

if ($numeroN === '' || $ccN === '') {
    Response::error('Debes enviar numero de radicado y numero de CC', 400);
}

$stmt = Db::pdo()->prepare(
    "SELECT * FROM radicados
     WHERE numero = :n AND tipo = 'CuentaCobroOPS'
     LIMIT 1"
);
$stmt->execute([':n' => $numeroN]);
$row = $stmt->fetch();

if (!$row) {
    Response::json([
        'existe' => false,
        'autorizado' => false,
        'message' => 'No existe una solicitud OPS con ese radicado.',
    ]);
}
if (($row['solicitante_cc'] ?? '') !== $ccN) {
    Response::json([
        'existe' => true,
        'autorizado' => false,
        'message' => 'El numero de CC no coincide con la solicitud.',
    ]);
}

Response::json([
    'existe'                => true,
    'autorizado'            => true,
    'numero'                => $row['numero'],
    'referencia'            => $row['referencia'],
    'estado'                => $row['estado'],
    'documentosSolicitados' => $row['documentos_solicitados'] ? json_decode($row['documentos_solicitados'], true) : [],
    'documentosAdjuntos'    => $row['documentos_adjuntos']    ? json_decode($row['documentos_adjuntos'], true)    : [],
]);
