<?php
declare(strict_types=1);

Auth::requireAdmin();

$body = Request::body();
$nombre = trim((string)($body['nombre'] ?? ''));
if ($nombre === '') Response::error('Nombre es obligatorio', 400);

$slug = strtolower(trim((string)($body['slug'] ?? '')));
if ($slug === '') {
    $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $nombre));
    $slug = trim($slug, '-');
}

$pdo = Db::pdo();
$dup = $pdo->prepare("SELECT id FROM areas WHERE slug = :s LIMIT 1");
$dup->execute([':s' => $slug]);
if ($dup->fetch()) Response::error('Ya existe un area con ese identificador', 409);

$ins = $pdo->prepare(
    "INSERT INTO areas (nombre, descripcion, slug, activo, orden)
     VALUES (:n, :d, :s, :a, :o)"
);
$ins->execute([
    ':n' => $nombre,
    ':d' => trim((string)($body['descripcion'] ?? '')) ?: null,
    ':s' => $slug,
    ':a' => isset($body['activo']) ? (int)(bool)$body['activo'] : 1,
    ':o' => isset($body['orden']) ? (int)$body['orden'] : 0,
]);
$id = (int)$pdo->lastInsertId();

$sel = $pdo->prepare("SELECT * FROM areas WHERE id = :id");
$sel->execute([':id' => $id]);
$row = $sel->fetch();

Response::json([
    'id'          => (int)$row['id'],
    'nombre'      => $row['nombre'],
    'descripcion' => $row['descripcion'],
    'slug'        => $row['slug'],
    'activo'      => (bool)$row['activo'],
    'orden'       => (int)$row['orden'],
    'creadoEn'    => $row['creado_en'],
], 201);
