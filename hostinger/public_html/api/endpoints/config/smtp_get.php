<?php
declare(strict_types=1);

// GET /config/smtp  — solo administrador.
// NUNCA devuelve la contraseña; solo indica si esta configurada.
Auth::requireAdmin();

$host = Settings::get('smtp_host', Config::get('SMTP_HOST', '')) ?? '';
$port = (int)(Settings::get('smtp_port', (string)Config::getInt('SMTP_PORT', 587)));
$secureRaw = Settings::get('smtp_secure');
$secure = $secureRaw !== null
    ? in_array(strtolower($secureRaw), ['1', 'true', 'yes', 'on'], true)
    : Config::getBool('SMTP_SECURE', false);
$user = Settings::get('smtp_user', Config::get('SMTP_USER', '')) ?? '';
$from = Settings::get('smtp_from', Config::get('SMTP_FROM', '')) ?? '';
$passSet = (Settings::get('smtp_pass', Config::get('SMTP_PASS', '')) ?? '') !== '';

Response::json([
    'host'                => $host,
    'port'                => $port,
    'secure'              => $secure,
    'usuario'             => $user,
    'remitente'           => $from,
    'passwordConfigurada' => $passSet,
    // De donde sale la config efectiva: 'base_datos' si el panel ya la guardo, si no 'env'.
    'fuente'              => Settings::get('smtp_host') !== null ? 'base_datos' : 'env',
]);
