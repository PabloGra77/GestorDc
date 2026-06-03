<?php
declare(strict_types=1);

Throttle::hit('reset-req:' . Throttle::clientIp(), 5, 60);

$body = Request::body();
$correo = strtolower(trim((string)($body['correo'] ?? '')));
$genericResponse = ['message' => 'Si el correo existe, enviaremos un enlace de restablecimiento.'];

if ($correo === '' || !DomainPolicy::valid($correo)) {
    // Respuesta generica para no filtrar si el dominio es valido o no
    Response::json($genericResponse);
}

$pdo = Db::pdo();
$stmt = $pdo->prepare("SELECT id, correo, nombre_completo, activo FROM usuarios WHERE LOWER(correo) = :c LIMIT 1");
$stmt->execute([':c' => $correo]);
$u = $stmt->fetch();

if (!$u || (int)$u['activo'] !== 1) {
    Response::json($genericResponse);
}

$token = bin2hex(random_bytes(32));
$tokenHash = hash('sha256', $token);
$ttl = Config::getInt('PASSWORD_RESET_TTL_MINUTES', 30);
$expiresAt = gmdate('Y-m-d H:i:s', time() + $ttl * 60);

$upd = $pdo->prepare("UPDATE usuarios SET password_reset_token_hash = :h, password_reset_expires_at = :e WHERE id = :id");
$upd->execute([':h' => $tokenHash, ':e' => $expiresAt, ':id' => $u['id']]);

$base = rtrim(Config::get('WEB_BASE_URL', ''), '/');
$link = $base . '/reset-password?token=' . urlencode($token);
$nombre = $u['nombre_completo'] ?: 'usuario';

$text = "Hola {$nombre},\n\nRecibimos una solicitud para restablecer tu contrasena en GestorDoc.\n"
      . "Para continuar, usa el siguiente enlace:\n{$link}\n\n"
      . "Este enlace vence en {$ttl} minutos.\n"
      . "Si no solicitaste este cambio, puedes ignorar este mensaje.";

$html = '<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">'
      . '<p>Hola ' . htmlspecialchars($nombre) . ',</p>'
      . '<p>Recibimos una solicitud para restablecer tu contrasena en <strong>GestorDoc</strong>.</p>'
      . '<p>Haz clic en este enlace para crear una nueva contrasena:</p>'
      . '<p><a href="' . htmlspecialchars($link) . '">' . htmlspecialchars($link) . '</a></p>'
      . '<p>Este enlace vence en ' . $ttl . ' minutos.</p>'
      . '<p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>'
      . '</div>';

Mailer::send([
    'to'      => [$u['correo']],
    'subject' => 'Restablecimiento de contrasena - GestorDoc',
    'text'    => $text,
    'html'    => $html,
]);

Response::json($genericResponse);
