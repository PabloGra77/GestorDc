<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

// Leer el token de la cookie ANTES de limpiarla para registrar quién cerró sesión
$usuarioId = null;
$cookieToken = $_COOKIE['payops_token'] ?? null;
if ($cookieToken) {
    // Intentar verificación normal primero
    $payload = Jwt::verify($cookieToken);
    if ($payload && isset($payload['sub'])) {
        $usuarioId = (int)$payload['sub'];
    } else {
        // JWT expirado o inválido: decodificar el payload sin verificar firma/expiración
        // Solo para audit (no se usa para autorización — la cookie se elimina igualmente)
        try {
            $parts = explode('.', $cookieToken);
            if (count($parts) === 3) {
                $padded = $parts[1];
                $rem = strlen($padded) % 4;
                if ($rem) $padded .= str_repeat('=', 4 - $rem);
                $decoded = json_decode(base64_decode(strtr($padded, '-_', '+/')), true);
                if (is_array($decoded) && isset($decoded['sub'])) {
                    $usuarioId = (int)$decoded['sub'];
                }
            }
        } catch (Throwable) { /* ok */ }
    }
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
