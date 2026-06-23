<?php
declare(strict_types=1);

// El AREA FINAL (nivel contabilidad) o un admin da por cerrado el anticipo.
require_once __DIR__ . '/_flujo.php';

$jwt = Auth::requireUser();
$id = (int)($params['id'] ?? 0);
$body = Request::body();
$comentario = trim((string)($body['comentario'] ?? '')) ?: 'Legalizacion validada y cerrada';

$pdo = Db::pdo();
$uStmt = $pdo->prepare("SELECT u.id, u.nombre_completo, u.nivel_aprobacion, r.nombre AS rol FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id WHERE u.id = :id LIMIT 1");
$uStmt->execute([':id' => (int)$jwt['sub']]);
$user = $uStmt->fetch();
if (!$user) Response::error('Usuario no encontrado', 404);
$esAreaFinal = strtolower(trim($user['rol'] ?? '')) === 'administrador' || ($user['nivel_aprobacion'] ?? '') === 'contabilidad';
if (!$esAreaFinal) Response::error('Solo el area final (Contabilidad) puede cerrar la legalizacion', 403);

$st = $pdo->prepare("SELECT * FROM solicitudes WHERE id = :id LIMIT 1");
$st->execute([':id' => $id]);
$sol = $st->fetch();
if (!$sol) Response::error('Solicitud no encontrada', 404);
if ($sol['estado'] !== 'en_legalizacion') {
    Response::error('La legalizacion no esta lista para cerrar (el solicitante aun no envia los soportes)', 400);
}

$pdo->beginTransaction();
try {
    $up = $pdo->prepare("UPDATE solicitudes SET estado = 'legalizado' WHERE id = :id AND estado = 'en_legalizacion'");
    $up->execute([':id' => $id]);
    if ($up->rowCount() === 0) { $pdo->rollBack(); Response::error('Estado ya cambiado', 409); }
    FlujoHelpers::registrarMovimiento($pdo, $id, 'legalizado', null, 'legalizado', $user, $comentario, 'publico');
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[legalizacion_confirmar] ' . $e->getMessage());
    Response::error('No se pudo cerrar la legalizacion', 500);
}

FlujoHelpers::notificarSolicitante($sol,
    "Anticipo {$sol['numero_radicado']} legalizado",
    "Tu anticipo {$sol['numero_radicado']} fue legalizado y cerrado correctamente. Comentario: {$comentario}"
);

Response::json(['ok' => true, 'estado' => 'legalizado']);
