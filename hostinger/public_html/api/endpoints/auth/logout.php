<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

// Limpiar la cookie HttpOnly sin importar si el token es válido
$secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
setcookie('payops_token', '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'secure'   => $secure,
    'httponly' => true,
    'samesite' => 'Strict',
]);

Response::json(['ok' => true]);
