<?php
declare(strict_types=1);

// Un usuario solo puede ver su propio perfil; ver el de otro requiere ser admin.
$jwt = Auth::requireUser();
$id = (int)($params['id'] ?? 0);
if ($id !== (int)($jwt['sub'] ?? 0)) {
    Auth::requireAdmin();
}
$pdo = Db::pdo();
$stmt = $pdo->prepare(
    "SELECT u.*, r.id AS r_id, r.nombre AS r_nombre, r.descripcion AS r_desc,
            r.activo AS r_activo, r.permisos AS r_permisos
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = :id
     LIMIT 1"
);
$stmt->execute([':id' => $id]);
$row = $stmt->fetch();

if (!$row) Response::error('Usuario no encontrado', 404);

Response::json(Shapes::usuario($row));
