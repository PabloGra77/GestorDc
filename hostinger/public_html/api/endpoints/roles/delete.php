<?php
declare(strict_types=1);

Auth::requireAdmin();

$id = (int)($params['id'] ?? 0);
if ($id <= 0) Response::error('ID invalido', 400);

$pdo = Db::pdo();

$rolStmt = $pdo->prepare("SELECT id, nombre FROM roles WHERE id = :id LIMIT 1");
$rolStmt->execute([':id' => $id]);
$rol = $rolStmt->fetch();
if (!$rol) Response::error('Rol no encontrado', 404);

if (strtolower(trim((string)$rol['nombre'])) === 'administrador') {
    Response::error('No se puede eliminar el rol Administrador', 400);
}

$usoStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM usuarios WHERE rol_id = :id");
$usoStmt->execute([':id' => $id]);
$uso = (int)($usoStmt->fetch()['total'] ?? 0);
if ($uso > 0) {
    Response::error("No se puede eliminar el rol porque tiene {$uso} usuario(s) asignado(s)", 409);
}

$del = $pdo->prepare("DELETE FROM roles WHERE id = :id");
$del->execute([':id' => $id]);

Response::json(['ok' => true, 'message' => "Rol \"{$rol['nombre']}\" eliminado correctamente"]);
