<?php
declare(strict_types=1);

// Quita una autorizacion de la whitelist. Solo admin. No borra la cuenta si ya existe.
Auth::requireAdmin();

$id = (int)($params['id'] ?? 0);
if ($id <= 0) Response::error('id invalido', 400);

$pdo = Db::pdo();
$st = $pdo->prepare("DELETE FROM personal_autorizado WHERE id = :id");
$st->execute([':id' => $id]);

Response::json(['ok' => true, 'eliminado' => $st->rowCount() > 0]);
