<?php
declare(strict_types=1);

$jwt = Auth::requireUser();
$usuarioId = (int)($jwt['sub'] ?? 0);

$body = Request::body();
$current = (string)($body['currentPassword'] ?? '');
$new = (string)($body['newPassword'] ?? '');

if ($usuarioId <= 0 || $current === '' || strlen($new) < 8) {
    Response::error('Datos invalidos', 400);
}

$pdo = Db::pdo();
$stmt = $pdo->prepare("SELECT id, activo, password_hash, must_change_password FROM usuarios WHERE id = :id LIMIT 1");
$stmt->execute([':id' => $usuarioId]);
$u = $stmt->fetch();

if (!$u || (int)$u['activo'] !== 1 || empty($u['password_hash'])) {
    Response::error('Credenciales invalidas', 401);
}
if (!password_verify($current, $u['password_hash'])) {
    Response::error('Credenciales invalidas', 401);
}
if ((int)$u['must_change_password'] !== 1) {
    Response::error('El usuario no requiere cambio inicial de contrasena', 400);
}
if ($current === $new) {
    Response::error('La nueva contrasena debe ser diferente a la temporal', 400);
}

$hash = password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]);
$upd = $pdo->prepare("UPDATE usuarios SET password_hash = :p, must_change_password = 0, password_changed_at = UTC_TIMESTAMP() WHERE id = :id");
$upd->execute([':p' => $hash, ':id' => (int)$u['id']]);

Response::json(['message' => 'Contrasena actualizada correctamente']);
