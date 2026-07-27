<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

// Leer el token de la cookie ANTES de limpiarla para registrar quién cerró sesión
$usuarioId = null;
$cookieToken = $_COOKIE['payops_token'] ?? null;
if ($cookieToken) {
    try {
        $payload = Jwt::verify($cookieToken);
        if ($payload && isset($payload['sub'])) {
            $usuarioId = (int)$payload['sub'];
        }
    } catch (Throwable) { /* token inválido = ok */ }
}

// Limpiar la cookie HttpOnly
$secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
setcookie('payops_token', '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'secure'   => $secure,
    'httponly' => true,
    'samesite' => 'Strict',
]);

Auditoria::registrar('logout', 'Cierre de sesión', true, $usuarioId);

Response::json(['ok' => true]);
