<?php
declare(strict_types=1);

require_once __DIR__ . '/_flujo.php';

$jwt = Auth::requireUser();
$id = (int)($params['id'] ?? 0);
$body = Request::body();
$areaIdDestino = (int)($body['areaIdDestino'] ?? 0);
$comentario = trim((string)($body['comentario'] ?? '')) ?: 'Remitida a otra area';

if ($id <= 0 || $areaIdDestino <= 0) {
    Response::error('Datos invalidos', 400);
}

$pdo = Db::pdo();
['sol' => $sol, 'user' => $user] = FlujoHelpers::cargarYAutorizar($pdo, $id, (int)$jwt['sub']);

if ($sol['estado'] !== 'en_validacion') {
    Response::error('Solo se pueden remitir solicitudes en validacion', 400);
}

if ((int)$sol['area_id'] === $areaIdDestino) {
    Response::error('La solicitud ya esta en esa area', 400);
}

$aStmt = $pdo->prepare("SELECT id, nombre, activo FROM areas WHERE id = :id LIMIT 1");
$aStmt->execute([':id' => $areaIdDestino]);
$areaDest = $aStmt->fetch();
if (!$areaDest || (int)$areaDest['activo'] !== 1) {
    Response::error('Area de destino invalida', 400);
}

// Si el tipo de solicitud define un flujo de areas, validar remisiones permitidas.
$tipoChk = $pdo->prepare("SELECT flujo_areas FROM tipos_solicitud WHERE id = :id LIMIT 1");
$tipoChk->execute([':id' => (int)$sol['tipo_solicitud_id']]);
$tipoRow = $tipoChk->fetch();
$flujoAreas = $tipoRow && $tipoRow['flujo_areas']
    ? (json_decode($tipoRow['flujo_areas'], true) ?: null)
    : null;
if ($flujoAreas) {
    $participantes = is_array($flujoAreas['areasParticipantes'] ?? null)
        ? array_map('intval', $flujoAreas['areasParticipantes'])
        : [];
    if (!empty($participantes) && !in_array($areaIdDestino, $participantes, true)) {
        Response::error('El area de destino no participa en el flujo de este tipo de solicitud', 403);
    }
    $remision = is_array($flujoAreas['remision'] ?? null) ? $flujoAreas['remision'] : [];
    $permitidos = is_array($remision[(string)$sol['area_id']] ?? null)
        ? array_map('intval', $remision[(string)$sol['area_id']])
        : null;
    if ($permitidos !== null && !in_array($areaIdDestino, $permitidos, true)) {
        Response::error('No esta permitido remitir desde tu area al area de destino', 403);
    }
}

$pdo->beginTransaction();
try {
    $upd = $pdo->prepare(
        "UPDATE solicitudes
         SET area_id = :aid, paso_actual = 'analista', paso_orden = 1
         WHERE id = :id AND estado = 'en_validacion'"
    );
    $upd->execute([':aid' => $areaIdDestino, ':id' => $id]);
    if ($upd->rowCount() === 0) {
        $pdo->rollBack();
        Response::error('La solicitud cambio de estado mientras se remitia', 409);
    }

    FlujoHelpers::registrarMovimiento(
        $pdo, $id, 'remitida', $sol['paso_actual'],
        'en_validacion', $user,
        "Remitida al área: {$areaDest['nombre']}. Motivo: {$comentario}",
        'publico'
    );

    FlujoHelpers::notificarSolicitante(
        $sol,
        "Solicitud {$sol['numero_radicado']} remitida",
        "Tu solicitud {$sol['numero_radicado']} fue remitida al area de {$areaDest['nombre']} para continuar el tramite.\nMotivo: {$comentario}"
    );

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[remitir] ' . $e->getMessage());
    Response::error('No se pudo remitir la solicitud', 500);
}

Response::json([
    'ok' => true,
    'areaIdDestino' => $areaIdDestino,
    'areaNombreDestino' => $areaDest['nombre'],
]);
