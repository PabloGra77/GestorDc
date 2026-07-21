<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

Auth::requireAdmin();

$id = (int)($params['id'] ?? 0);
if ($id <= 0) Response::error('ID inválido', 400);

$pdo = Db::pdo();

$check = $pdo->prepare("SELECT id FROM informes_ops WHERE id = :id LIMIT 1");
$check->execute([':id' => $id]);
if (!$check->fetch()) Response::error('Informe no encontrado', 404);

// Las filas de detalle se borran en cascada por FK ON DELETE CASCADE
$pdo->prepare("DELETE FROM informes_ops WHERE id = :id")->execute([':id' => $id]);

Response::json(['ok' => true]);
