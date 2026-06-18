<?php
declare(strict_types=1);

// El AREA FINAL (nivel contabilidad) o admin envia un recordatorio al solicitante
// para que legalice (pague con facturas) su anticipo.
require_once __DIR__ . '/_flujo.php';

$jwt = Auth::requireUser();
$id = (int)($params['id'] ?? 0);

$pdo = Db::pdo();
$uStmt = $pdo->prepare("SELECT u.id, u.nombre_completo, u.nivel_aprobacion, r.nombre AS rol FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id WHERE u.id = :id LIMIT 1");
$uStmt->execute([':id' => (int)$jwt['sub']]);
$user = $uStmt->fetch();
if (!$user) Response::error('Usuario no encontrado', 404);
$esAreaFinal = strtolower(trim($user['rol'] ?? '')) === 'administrador' || ($user['nivel_aprobacion'] ?? '') === 'contabilidad';
if (!$esAreaFinal) Response::error('Solo el area final (Contabilidad) puede enviar recordatorios', 403);

$st = $pdo->prepare("SELECT * FROM solicitudes WHERE id = :id LIMIT 1");
$st->execute([':id' => $id]);
$sol = $st->fetch();
if (!$sol) Response::error('Solicitud no encontrada', 404);
if (!in_array($sol['estado'], ['por_legalizar', 'en_legalizacion'], true)) {
    Response::error('Este anticipo no esta pendiente de legalizacion', 400);
}

$datos = json_decode($sol['datos_formulario'] ?? '{}', true) ?: [];
$fechaLeg = (string)($datos['fechaLegalizacion'] ?? '');

FlujoHelpers::notificarSolicitante($sol,
    "Recordatorio: legaliza tu anticipo {$sol['numero_radicado']}",
    "Hola, te recordamos que debes legalizar (pagar con facturas/soportes) tu anticipo {$sol['numero_radicado']}." .
    ($fechaLeg ? " Fecha compromiso: {$fechaLeg}." : '') .
    "\n\nIngresa a Payops -> Mis solicitudes -> Legalizar y adjunta las evidencias del gasto. La inteligencia artificial validara los soportes."
);
FlujoHelpers::registrarMovimiento($pdo, $id, 'recordatorio', null, $sol['estado'], $user, 'Recordatorio de legalizacion enviado al solicitante', 'publico');

Response::json(['ok' => true, 'enviado' => true]);
