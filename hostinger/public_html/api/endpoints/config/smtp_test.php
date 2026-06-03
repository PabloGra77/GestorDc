<?php
declare(strict_types=1);

// POST /config/smtp/test  — solo administrador.
// Envia un correo de prueba con la configuracion SMTP vigente (BD o .env).
Auth::requireAdmin();

$body = Request::body();
$to = strtolower(trim((string)($body['destinatario'] ?? '')));
if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    Response::error('Destinatario invalido', 400);
}

$ok = Mailer::send([
    'to'      => [$to],
    'subject' => 'Prueba SMTP · Payops',
    'text'    => "Este es un correo de prueba enviado desde el panel de administrador de Payops.\n\n"
        . "Si lo recibiste, la configuracion SMTP funciona correctamente.",
]);

if (!$ok) {
    Response::error('No se pudo enviar el correo de prueba. Revisa el host, usuario y contraseña SMTP.', 502);
}

Response::json(['ok' => true, 'mensaje' => "Correo de prueba enviado a {$to}."]);
