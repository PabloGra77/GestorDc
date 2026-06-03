<?php
declare(strict_types=1);

require_once __DIR__ . '/_helpers.php';

// Rate limiting: subida de documentos publica.
Throttle::hit('ops-doc:' . Throttle::clientIp(), 5, 60);
Throttle::hit('ops-doc-hour:' . Throttle::clientIp(), 30, 3600);

$body = Request::body();
$numero = strtoupper(trim((string)($body['numeroRadicado'] ?? '')));
$cc = RadicadoHelpers::normalizarCc((string)($body['numeroCc'] ?? ''));
$docs = is_array($body['documentos'] ?? null) ? $body['documentos'] : [];

if ($numero === '' || $cc === '') {
    Response::error('Datos invalidos', 400);
}

$pdo = Db::pdo();
$stmt = $pdo->prepare("SELECT * FROM radicados WHERE numero = :n AND tipo = 'CuentaCobroOPS' LIMIT 1");
$stmt->execute([':n' => $numero]);
$row = $stmt->fetch();

if (!$row) Response::error('No existe una solicitud OPS con ese radicado', 400);
if (($row['solicitante_cc'] ?? '') !== $cc) {
    Response::error('El numero de CC no coincide con la solicitud', 400);
}
// Bloquear cargas en estados terminales o no esperados
$estadosCargaPermitida = ['Solicitud OPS enviada', 'Docs OPS cargados'];
if (!in_array((string)($row['estado'] ?? ''), $estadosCargaPermitida, true)) {
    Response::error('La solicitud no admite carga de documentos en su estado actual', 409);
}

// Validar y limitar cada documento adjuntado
$ahora = gmdate('c');
$adjuntos = [];
foreach ($docs as $item) {
    if (!is_array($item)) continue;
    $nombre = trim((string)($item['nombre'] ?? ''));
    $archivo = trim((string)($item['archivo'] ?? ''));
    // Sanitizar nombre: solo alfanumerico, espacio, puntos, guiones, tope 120 chars
    if (!preg_match('/^[\w.\- ]{1,120}$/u', $nombre)) {
        Response::error("Nombre de documento invalido: {$nombre}", 400);
    }
    if ($archivo !== '' && strlen($archivo) > 300000) {
        Response::error("Documento '{$nombre}' supera el tamano permitido", 413);
    }
    $adjuntos[] = [
        'nombre'    => $nombre,
        'archivo'   => $archivo,
        'cargadoEn' => $ahora,
    ];
    if (count($adjuntos) > 15) {
        Response::error('Demasiados documentos en una sola solicitud', 400);
    }
}

$upd = $pdo->prepare(
    "UPDATE radicados
     SET documentos_adjuntos = :d, estado = 'Docs OPS cargados'
     WHERE id = :id AND estado IN ('Solicitud OPS enviada', 'Docs OPS cargados')"
);
$upd->execute([
    ':d' => json_encode($adjuntos, JSON_UNESCAPED_UNICODE),
    ':id' => (int)$row['id'],
]);
if ($upd->rowCount() === 0) {
    Response::error('La solicitud cambio de estado mientras se cargaban los documentos', 409);
}

Response::json([
    'ok'      => true,
    'message' => 'Documentos cargados correctamente. Pendiente validacion del solicitante.',
    'numero'  => $numero,
    'estado'  => 'Docs OPS cargados',
]);
