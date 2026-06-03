<?php
declare(strict_types=1);

Auth::requireAdmin();

$id = (int)($params['id'] ?? 0);
if ($id <= 0) Response::error('ID invalido', 400);

$pdo = Db::pdo();

$tipoStmt = $pdo->prepare("SELECT id, nombre FROM tipos_solicitud WHERE id = :id LIMIT 1");
$tipoStmt->execute([':id' => $id]);
$tipo = $tipoStmt->fetch();
if (!$tipo) Response::error('Tipo no encontrado', 404);

$usoStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM solicitudes WHERE tipo_solicitud_id = :id");
$usoStmt->execute([':id' => $id]);
$uso = (int)($usoStmt->fetch()['total'] ?? 0);
if ($uso > 0) {
    Response::error("No se puede eliminar el tipo: tiene {$uso} solicitud(es) asociada(s).", 409);
}

$del = $pdo->prepare("DELETE FROM tipos_solicitud WHERE id = :id");
$del->execute([':id' => $id]);

Response::json(['ok' => true, 'message' => "Tipo \"{$tipo['nombre']}\" eliminado."]);
