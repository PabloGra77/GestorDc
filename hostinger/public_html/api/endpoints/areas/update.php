<?php
declare(strict_types=1);

Auth::requireAdmin();

$id = (int)($params['id'] ?? 0);
$body = Request::body();
$pdo = Db::pdo();

$cur = $pdo->prepare("SELECT * FROM areas WHERE id = :id LIMIT 1");
$cur->execute([':id' => $id]);
$row = $cur->fetch();
if (!$row) Response::error('Area no encontrada', 404);

if (isset($body['nombre'])) $row['nombre'] = trim((string)$body['nombre']);
if (array_key_exists('descripcion', $body)) {
    $d = trim((string)$body['descripcion']);
    $row['descripcion'] = $d === '' ? null : $d;
}
if (isset($body['slug'])) {
    $slug = strtolower(trim((string)$body['slug']));
    if ($slug !== '' && $slug !== $row['slug']) {
        $dup = $pdo->prepare("SELECT id FROM areas WHERE slug = :s AND id <> :id LIMIT 1");
        $dup->execute([':s' => $slug, ':id' => $id]);
        if ($dup->fetch()) Response::error('Ya existe un area con ese identificador', 409);
        $row['slug'] = $slug;
    }
}
if (array_key_exists('activo', $body)) $row['activo'] = (int)(bool)$body['activo'];
if (array_key_exists('orden', $body)) $row['orden'] = (int)$body['orden'];

$upd = $pdo->prepare(
    "UPDATE areas SET nombre = :n, descripcion = :d, slug = :s, activo = :a, orden = :o WHERE id = :id"
);
$upd->execute([
    ':n' => $row['nombre'],
    ':d' => $row['descripcion'],
    ':s' => $row['slug'],
    ':a' => (int)$row['activo'],
    ':o' => (int)$row['orden'],
    ':id' => $id,
]);

Response::json([
    'id'          => (int)$row['id'],
    'nombre'      => $row['nombre'],
    'descripcion' => $row['descripcion'],
    'slug'        => $row['slug'],
    'activo'      => (bool)$row['activo'],
    'orden'       => (int)$row['orden'],
    'creadoEn'    => $row['creado_en'],
]);
