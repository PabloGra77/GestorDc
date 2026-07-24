<?php
declare(strict_types=1);

require_once __DIR__ . '/_flujo.php';

$jwt = Auth::requireUser();
$id = (int)($params['id'] ?? 0);
$body = Request::body();
$motivo = trim((string)($body['comentario'] ?? ''));
if ($motivo === '') Response::error('El motivo de devolucion es obligatorio', 400);

$pdo = Db::pdo();
['sol' => $sol, 'user' => $user] = FlujoHelpers::cargarYAutorizar($pdo, $id, (int)$jwt['sub']);

if ($sol['estado'] !== 'en_validacion') {
    Response::error('La solicitud no esta en validacion', 400);
}

$pdo->beginTransaction();
try {
    $upd = $pdo->prepare(
        "UPDATE solicitudes SET estado = 'devuelto'
         WHERE id = :id AND estado = 'en_validacion' AND paso_actual = :pa_prev"
    );
    $upd->execute([':id' => $id, ':pa_prev' => $sol['paso_actual']]);
    if ($upd->rowCount() === 0) {
        $pdo->rollBack();
        Response::error('La solicitud ya fue actualizada por otro validador', 409);
    }
    FlujoHelpers::registrarMovimiento(
        $pdo, $id, 'devuelta', $sol['paso_actual'],
        'devuelto', $user, "Devuelta al solicitante: {$motivo}", 'publico'
    );
    FlujoHelpers::notificarSolicitante($sol,
        "Solicitud {$sol['numero_radicado']} devuelta - requiere correccion",
        "Su solicitud {$sol['numero_radicado']} fue devuelta para correccion.\n\n" .
        "Motivo: {$motivo}\n\n" .
        "Por favor revise los documentos / datos e ingrese de nuevo a la plataforma."
    );
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[devolver] ' . $e->getMessage());
    Response::error('No se pudo devolver la solicitud', 500);
}

Auditoria::registrar(
    'devolver',
    "Radicado {$sol['numero_radicado']} · paso: {$sol['paso_actual']} · Motivo: {$motivo}",
    true,
    (int)$jwt['sub']
);

Response::json(['ok' => true, 'estado' => 'devuelto']);
