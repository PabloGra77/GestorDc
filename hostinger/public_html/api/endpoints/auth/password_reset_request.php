<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

Throttle::hit('pwd-reset-req:' . Throttle::clientIp(), 5, 60);
Throttle::hit('pwd-reset-req-hour:' . Throttle::clientIp(), 20, 3600);

$data = Request::body();
$correo = trim((string)($data['correo'] ?? ''));

$genericResponse = ['message' => 'Si el correo existe, enviaremos un enlace de restablecimiento.'];

if ($correo === '' || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    Response::json($genericResponse);
}

$pdo = Db::pdo();
$stmt = $pdo->prepare("SELECT id, correo, nombre_completo, activo FROM usuarios WHERE LOWER(correo) = :c LIMIT 1");
$stmt->execute([':c' => strtolower($correo)]);
$u = $stmt->fetch();

if (!$u || (int)$u['activo'] !== 1) {
    Response::json($genericResponse);
}

$token = bin2hex(random_bytes(32));
$tokenHash = hash('sha256', $token);
$ttl = 30; // 30 minutos
$expiresAt = gmdate('Y-m-d H:i:s', time() + $ttl * 60);

$upd = $pdo->prepare("UPDATE usuarios SET password_reset_token_hash = :h, password_reset_expires_at = :e WHERE id = :id");
$upd->execute([':h' => $tokenHash, ':e' => $expiresAt, ':id' => $u['id']]);

$base = rtrim((string)Config::get('WEB_BASE_URL', ''), '/');
if (!$base) {
    $base = 'https://' . ($_SERVER['HTTP_HOST'] ?? 'tudominio.com');
}
$link = $base . '/reset-password?token=' . urlencode($token);
$nombre = $u['nombre_completo'] ?: 'usuario';

$text = "Hola {$nombre},\n\n"
    . "Recibimos una solicitud para restablecer tu contraseña en Payops, la plataforma documental de Goleman IPS.\n\n"
    . "Para crear una nueva contraseña, ingresa al siguiente enlace:\n{$link}\n\n"
    . "Por seguridad, este enlace vence en {$ttl} minutos.\n\n"
    . "Si no solicitaste este cambio, puedes ignorar este mensaje; tu contraseña seguirá siendo la misma.\n\n"
    . "Atentamente,\nEquipo Payops · Goleman IPS";

$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
$html = '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Restablecer Contraseña</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #2563eb; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">PAYOPS</h1>
        <p style="margin: 5px 0 0 0;">Goleman IPS · Plataforma documental</p>
    </div>
    <div style="padding: 30px 20px; background: #f9fafb;">
        <h2 style="color: #1f2937;">Restablecer tu contraseña</h2>
        <p style="color: #4b5563;">Hola <strong>' . $h($nombre) . '</strong>,</p>
        <p style="color: #4b5563;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Payops</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="' . $h($link) . '" style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Crear nueva contraseña</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">O copia este enlace en tu navegador:</p>
        <p style="color: #2563eb; font-size: 12px; word-break: break-all;">' . $h($link) . '</p>
        <p style="color: #6b7280; font-size: 14px;">Por seguridad, este enlace vence en <strong>' . (int)$ttl . ' minutos</strong>.</p>
        <p style="color: #6b7280; font-size: 14px;">Si no solicitaste este cambio, ignora este mensaje; tu contraseña seguirá siendo la misma.</p>
    </div>
    <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">Atentamente,<br><strong>Equipo Payops</strong> · Goleman IPS</p>
    </div>
</body>
</html>';

// Enviar correo usando Mailer::send() con el formato correcto (array de parámetros)
$enviado = Mailer::send([
    'to' => [$u['correo']],
    'subject' => 'Restablecimiento de contraseña · Payops',
    'text' => $text,
    'html' => $html
]);

// Si el envío falló, lo registramos en el log para debugging
if (!$enviado) {
    error_log('Mailer::send() falló al enviar correo de reset a: ' . $u['correo']);
}

Response::json($genericResponse);