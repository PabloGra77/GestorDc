<?php
declare(strict_types=1);

require_once __DIR__ . '/_flujo.php';

$jwt = Auth::requireUser();
$id = (int)($params['id'] ?? 0);
$body = Request::body();
$motivo = trim((string)($body['comentario'] ?? ''));
if ($motivo === '') Response::error('El motivo del rechazo es obligatorio', 400);

$pdo = Db::pdo();
['sol' => $sol, 'user' => $user] = FlujoHelpers::cargarYAutorizar($pdo, $id, (int)$jwt['sub']);

if ($sol['estado'] === 'aprobado') {
    Response::error('La solicitud ya esta aprobada', 400);
}

$pdo->beginTransaction();
try {
    $upd = $pdo->prepare(
        "UPDATE solicitudes SET estado = 'rechazado', paso_actual = NULL
         WHERE id = :id AND estado IN ('en_validacion', 'devuelto')"
    );
    $upd->execute([':id' => $id]);
    if ($upd->rowCount() === 0) {
        $pdo->rollBack();
        Response::error('La solicitud ya no puede rechazarse', 409);
    }
    FlujoHelpers::registrarMovimiento(
        $pdo, $id, 'rechazada', $sol['paso_actual'],
        'rechazado', $user, "Rechazada: {$motivo}", 'publico'
    );
    FlujoHelpers::notificarSolicitante($sol,
        "Solicitud {$sol['numero_radicado']} rechazada",
        "Su solicitud {$sol['numero_radicado']} fue rechazada.\n\nMotivo: {$motivo}"
    );
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[rechazar] ' . $e->getMessage());
    Response::error('No se pudo rechazar la solicitud', 500);
}

Auditoria::registrar(
    'rechazar',
    "Radicado {$sol['numero_radicado']} · paso: {$sol['paso_actual']} · Motivo: {$motivo}",
    true,
    (int)$jwt['sub']
);

Response::json(['ok' => true, 'estado' => 'rechazado']);
