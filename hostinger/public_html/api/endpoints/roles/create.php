<?php
declare(strict_types=1);

Auth::requireAdmin();

$body = Request::body();
$nombre = trim((string)($body['nombre'] ?? ''));
if ($nombre === '') Response::error('Nombre es obligatorio', 400);

$pdo = Db::pdo();
$dup = $pdo->prepare("SELECT id FROM roles WHERE nombre = :n LIMIT 1");
$dup->execute([':n' => $nombre]);
if ($dup->fetch()) Response::error('Ya existe un rol con ese nombre', 409);

$ins = $pdo->prepare(
    "INSERT INTO roles (nombre, descripcion, activo, permisos)
     VALUES (:n, :d, :a, :p)"
);
$ins->execute([
    ':n' => $nombre,
    ':d' => trim((string)($body['descripcion'] ?? '')) ?: null,
    ':a' => isset($body['activo']) ? (int)(bool)$body['activo'] : 1,
    ':p' => json_encode(Permissions::normalize($body['permisos'] ?? []), JSON_UNESCAPED_UNICODE),
]);
$id = (int)$pdo->lastInsertId();

$sel = $pdo->prepare("SELECT * FROM roles WHERE id = :id");
$sel->execute([':id' => $id]);
Response::json(Shapes::role($sel->fetch()), 201);
