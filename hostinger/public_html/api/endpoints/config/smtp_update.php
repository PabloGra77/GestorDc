<?php
declare(strict_types=1);

// PUT /config/smtp  — solo administrador.
// La contraseña solo se actualiza si se envia un valor no vacio (campo de solo-escritura).
Auth::requireAdmin();

$body = Request::body();
$host = trim((string)($body['host'] ?? ''));
$port = (int)($body['port'] ?? 0);
$secure = !empty($body['secure']);
$user = strtolower(trim((string)($body['usuario'] ?? '')));
$from = trim((string)($body['remitente'] ?? ''));
$pass = array_key_exists('password', $body) ? (string)$body['password'] : null;

if ($host === '' || $user === '') {
    Response::error('Host y usuario son obligatorios', 400);
}
if ($port < 1 || $port > 65535) {
    Response::error('Puerto invalido', 400);
}
if (!filter_var($user, FILTER_VALIDATE_EMAIL)) {
    Response::error('El usuario debe ser un correo valido', 400);
}
if (strlen($host) > 200 || strlen($user) > 200 || strlen($from) > 200) {
    Response::error('Algun valor es demasiado largo', 400);
}
if ($pass !== null && strlen($pass) > 200) {
    Response::error('La contraseña es demasiado larga', 400);
}

Settings::set('smtp_host', $host);
Settings::set('smtp_port', (string)$port);
Settings::set('smtp_secure', $secure ? 'true' : 'false');
Settings::set('smtp_user', $user);
Settings::set('smtp_from', $from !== '' ? $from : $user);
// Solo tocar la contraseña si llega una nueva no vacia. Se cifra antes de persistir.
if ($pass !== null && $pass !== '') {
    Settings::set('smtp_pass', Settings::encryptSecret($pass));
}

Response::json(['ok' => true]);
