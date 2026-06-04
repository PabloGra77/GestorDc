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

$text = "Hola {$nombre},\n\n"
      . "Recibimos una solicitud para restablecer tu contrasena en Payops, la plataforma documental de Goleman IPS.\n\n"
      . "Para crear una nueva contrasena, ingresa al siguiente enlace:\n{$link}\n\n"
      . "Por seguridad, este enlace vence en {$ttl} minutos.\n\n"
      . "Si no solicitaste este cambio, puedes ignorar este mensaje; tu contrasena seguira siendo la misma.\n\n"
      . "Atentamente,\nEquipo Payops · Goleman IPS";

$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
$html = '<div style="font-family:Arial,sans-serif;color:#0F172A;line-height:1.6;max-width:560px;margin:0 auto;">'
      . '<div style="background:#070B1D;color:#D4AF37;padding:22px 24px;border-radius:10px 10px 0 0;">'
      . '<h1 style="margin:0;font-size:24px;letter-spacing:0.06em;">PAYOPS</h1>'
      . '<p style="margin:4px 0 0;color:#C8CEE0;font-size:13px;">Goleman IPS &middot; Plataforma documental</p>'
      . '</div>'
      . '<div style="background:#FFFFFF;border:1px solid rgba(212,175,55,0.45);border-top:none;padding:26px 24px;border-radius:0 0 10px 10px;">'
      . '<h2 style="color:#B8901F;margin:0 0 12px;font-size:20px;">Restablecer tu contraseña</h2>'
      . '<p>Hola <strong>' . $h($nombre) . '</strong>,</p>'
      . '<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Payops</strong>.</p>'
      . '<p style="text-align:center;margin:24px 0;">'
      . '<a href="' . $h($link) . '" style="display:inline-block;background:linear-gradient(135deg,#D4AF37 0%,#F3D77B 50%,#D4AF37 100%);color:#0F172A;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">Crear nueva contraseña</a>'
      . '</p>'
      . '<p style="color:#6B7280;font-size:12px;">O copia este enlace en tu navegador:<br/><span style="word-break:break-all;color:#B8901F;">' . $h($link) . '</span></p>'
      . '<p style="background:rgba(212,175,55,0.12);border-left:4px solid #D4AF37;padding:12px 14px;border-radius:6px;font-size:13px;">'
      . 'Por seguridad, este enlace vence en <strong>' . (int)$ttl . ' minutos</strong>.</p>'
      . '<p style="color:#6B7280;font-size:12px;margin-top:20px;border-top:1px solid rgba(212,175,55,0.25);padding-top:14px;">Si no solicitaste este cambio, ignora este mensaje; tu contraseña seguirá siendo la misma.</p>'
      . '<p style="margin-top:18px;">Atentamente,<br/><strong>Equipo Payops</strong> &middot; Goleman IPS</p>'
      . '</div></div>';

Mailer::send([
    'to'      => [$u['correo']],
    'subject' => 'Restablecimiento de contraseña · Payops',
    'text'    => $text,
    'html'    => $html,
]);

Response::json($genericResponse);
