<?php
declare(strict_types=1);

Auth::requireAdmin();

$id = (int)($params['id'] ?? 0);
$body = Request::body();
$pdo = Db::pdo();

$stmt = $pdo->prepare("SELECT * FROM roles WHERE id = :id LIMIT 1");
$stmt->execute([':id' => $id]);
$row = $stmt->fetch();
if (!$row) Response::error('Rol no encontrado', 404);

// Bloquear renombrar el rol Administrador (su nombre es load-bearing)
$esRolAdmin = strtolower(trim((string)$row['nombre'])) === 'administrador';

if (isset($body['nombre'])) {
    $nuevo = trim((string)$body['nombre']);
    if ($nuevo !== '' && $nuevo !== $row['nombre']) {
        if ($esRolAdmin) {
            Response::error('No se puede renombrar el rol Administrador', 400);
        }
        $dup = $pdo->prepare("SELECT id FROM roles WHERE nombre = :n AND id <> :id LIMIT 1");
        $dup->execute([':n' => $nuevo, ':id' => $id]);
        if ($dup->fetch()) Response::error('Ya existe un rol con ese nombre', 409);
        $row['nombre'] = $nuevo;
    }
}
if (array_key_exists('descripcion', $body)) {
    $d = trim((string)$body['descripcion']);
    $row['descripcion'] = $d === '' ? null : $d;
}
if (array_key_exists('activo', $body)) {
    $row['activo'] = (int)(bool)$body['activo'];
}
if (array_key_exists('permisos', $body)) {
    $row['permisos'] = json_encode(Permissions::normalize($body['permisos']), JSON_UNESCAPED_UNICODE);
}

$upd = $pdo->prepare(
    "UPDATE roles SET nombre = :n, descripcion = :d, activo = :a, permisos = :p WHERE id = :id"
);
$upd->execute([
    ':n' => $row['nombre'],
    ':d' => $row['descripcion'],
    ':a' => (int)$row['activo'],
    ':p' => is_string($row['permisos']) ? $row['permisos'] : json_encode($row['permisos'], JSON_UNESCAPED_UNICODE),
    ':id' => $id,
]);

$sel = $pdo->prepare("SELECT * FROM roles WHERE id = :id");
$sel->execute([':id' => $id]);
Response::json(Shapes::role($sel->fetch()));
