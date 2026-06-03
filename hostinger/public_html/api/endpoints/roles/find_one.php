<?php
declare(strict_types=1);
Auth::requireUser();
$id = (int)($params['id'] ?? 0);
$stmt = Db::pdo()->prepare("SELECT * FROM roles WHERE id = :id LIMIT 1");
$stmt->execute([':id' => $id]);
$row = $stmt->fetch();
if (!$row) Response::error('Rol no encontrado', 404);
Response::json(Shapes::role($row));
