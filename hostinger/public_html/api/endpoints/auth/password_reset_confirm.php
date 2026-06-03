<?php
declare(strict_types=1);

Throttle::hit('reset-conf:' . Throttle::clientIp(), 5, 60);

$body = Request::body();
$token = trim((string)($body['token'] ?? ''));
$newPassword = (string)($body['newPassword'] ?? '');

if ($token === '' || strlen($newPassword) < 8) {
    Response::error('Token o nueva contrasena invalida', 400);
}

$tokenHash = hash('sha256', $token);
$pdo = Db::pdo();
$stmt = $pdo->prepare(
    "SELECT id, activo FROM usuarios
     WHERE password_reset_token_hash = :h
       AND password_reset_expires_at IS NOT NULL
       AND password_reset_expires_at > UTC_TIMESTAMP()
     LIMIT 1"
);
$stmt->execute([':h' => $tokenHash]);
$u = $stmt->fetch();

if (!$u || (int)$u['activo'] !== 1) {
    Response::error('El enlace de restablecimiento no es valido o ya vencio', 400);
}

$hash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
$upd = $pdo->prepare(
    "UPDATE usuarios
     SET password_hash = :p,
         must_change_password = 0,
         password_reset_token_hash = NULL,
         password_reset_expires_at = NULL
     WHERE id = :id"
);
$upd->execute([':p' => $hash, ':id' => $u['id']]);

Response::json(['message' => 'Contrasena restablecida correctamente']);
