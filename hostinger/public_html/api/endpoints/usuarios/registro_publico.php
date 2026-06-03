<?php
declare(strict_types=1);

// Endpoint PUBLICO: auto-registro de usuario.
// Crea cuenta con activo=0 (pendiente de aprobacion por administrador).
// El usuario recibe correo de bienvenida; el administrador recibe notificacion.

Throttle::hit('reg-pub:' . Throttle::clientIp(), 3, 60);
Throttle::hit('reg-pub-hour:' . Throttle::clientIp(), 10, 3600);

$body = Request::body();
$primerNombre   = trim((string)($body['primerNombre'] ?? ''));
$segundoNombre  = trim((string)($body['segundoNombre'] ?? '')) ?: null;
$primerApellido = trim((string)($body['primerApellido'] ?? ''));
$segundoApellido = trim((string)($body['segundoApellido'] ?? '')) ?: null;
$correo         = strtolower(trim((string)($body['correo'] ?? '')));
$rolId          = (int)($body['rolId'] ?? 0);
$areaId         = (int)($body['areaId'] ?? 0);

if ($primerNombre === '' || $primerApellido === '' || $correo === '') {
    Response::error('Primer nombre, apellido y correo son obligatorios', 400);
}
if (strlen($primerNombre) > 80 || strlen($primerApellido) > 80) {
    Response::error('Nombre o apellido demasiado largos', 400);
}
if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    Response::error('Correo invalido', 400);
}
// Solo dominio corporativo
DomainPolicy::requireValid($correo);

if ($rolId <= 0 || $areaId <= 0) {
    Response::error('Debes seleccionar rol y area', 400);
}

$pdo = Db::pdo();

$dup = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER(correo) = :c LIMIT 1");
$dup->execute([':c' => $correo]);
if ($dup->fetch()) Response::error('Ya existe un usuario con ese correo', 409);

// Validar que rol y area existan y esten activos. Bloquear auto-registro como Administrador.
$rolStmt = $pdo->prepare("SELECT id, nombre, activo FROM roles WHERE id = :id LIMIT 1");
$rolStmt->execute([':id' => $rolId]);
$rol = $rolStmt->fetch();
if (!$rol || (int)$rol['activo'] !== 1) Response::error('Rol invalido', 400);
if (strtolower(trim((string)$rol['nombre'])) === 'administrador') {
    Response::error('No es posible auto-registrarse con rol administrador', 403);
}

$areaStmt = $pdo->prepare("SELECT id, activo FROM areas WHERE id = :id LIMIT 1");
$areaStmt->execute([':id' => $areaId]);
$area = $areaStmt->fetch();
if (!$area || (int)$area['activo'] !== 1) Response::error('Area invalida', 400);

$nombreCompleto = implode(' ', array_filter([$primerNombre, $segundoNombre, $primerApellido, $segundoApellido]));
$tempPassword = bin2hex(random_bytes(6)) . '!Aa';
$tempHash = password_hash($tempPassword, PASSWORD_BCRYPT, ['cost' => 12]);

$pdo->beginTransaction();
try {
    $ins = $pdo->prepare(
        "INSERT INTO usuarios
         (primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
          tipo_documento, numero_documento, nombre_completo, correo, area,
          permisos, password_hash, must_change_password, activo, rol_id, area_id, nivel_aprobacion)
         VALUES
         (:pn, :sn, :pa, :sa, '', '', :nc, :co, :ar,
          :pe, :ph, 1, 0, :ri, :ai, NULL)"
    );
    $ins->execute([
        ':pn' => $primerNombre,
        ':sn' => $segundoNombre,
        ':pa' => $primerApellido,
        ':sa' => $segundoApellido,
        ':nc' => $nombreCompleto,
        ':co' => $correo,
        ':ar' => (string)$rol['nombre'],
        ':pe' => '{}',
        ':ph' => $tempHash,
        ':ri' => (int)$rol['id'],
        ':ai' => (int)$area['id'],
    ]);

    // Correo de bienvenida al solicitante
    $base = rtrim(Config::get('WEB_BASE_URL', 'https://payops.ipsgoleman.com'), '/');
    $loginLink = $base . '/login';
    $textUser = "Hola {$nombreCompleto},\n\n"
        . "Bienvenido(a) a Payops, la plataforma documental de Goleman IPS.\n\n"
        . "Tu solicitud de registro fue recibida correctamente con los siguientes datos:\n"
        . "  Correo: {$correo}\n"
        . "  Rol solicitado: {$rol['nombre']}\n\n"
        . "Tu cuenta esta pendiente de verificacion por parte de un administrador. "
        . "Una vez aprobada recibiras un correo con tu contrasena temporal y el enlace de acceso.\n\n"
        . "Si no realizaste esta solicitud, puedes ignorar este mensaje.\n\n"
        . "Atentamente,\nEquipo Payops · Goleman IPS";
    $htmlUser = '<div style="font-family:Arial,sans-serif;color:#0F172A;line-height:1.6;max-width:560px;margin:0 auto;">'
        . '<div style="background:#070B1D;color:#D4AF37;padding:18px 22px;border-radius:10px 10px 0 0;">'
        . '<h1 style="margin:0;font-size:22px;letter-spacing:0.04em;">PAYOPS</h1>'
        . '<p style="margin:4px 0 0;color:#C8CEE0;font-size:13px;">Goleman IPS · Plataforma documental</p>'
        . '</div>'
        . '<div style="background:#FFFFFF;border:1px solid rgba(212,175,55,0.4);border-top:none;padding:24px 22px;border-radius:0 0 10px 10px;">'
        . '<h2 style="color:#B8901F;margin:0 0 12px;font-size:18px;">Bienvenido(a) a Payops</h2>'
        . '<p>Hola <strong>' . htmlspecialchars($nombreCompleto, ENT_QUOTES, 'UTF-8') . '</strong>,</p>'
        . '<p>Tu solicitud de registro en <strong>Payops</strong> fue recibida correctamente.</p>'
        . '<table style="background:#F7F4EC;border:1px solid rgba(212,175,55,0.35);border-radius:8px;padding:14px;margin:14px 0;width:100%;">'
        . '<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;">Correo</td><td style="padding:4px 0;"><strong>' . htmlspecialchars($correo, ENT_QUOTES, 'UTF-8') . '</strong></td></tr>'
        . '<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;">Rol solicitado</td><td style="padding:4px 0;"><strong>' . htmlspecialchars((string)$rol['nombre'], ENT_QUOTES, 'UTF-8') . '</strong></td></tr>'
        . '</table>'
        . '<p style="background:rgba(212,175,55,0.12);border-left:4px solid #D4AF37;padding:12px 14px;border-radius:6px;">'
        . '<strong>Tu cuenta esta pendiente de verificacion</strong> por parte de un administrador. '
        . 'Una vez aprobada recibiras un nuevo correo con tu contrasena temporal y el enlace de acceso a la plataforma.</p>'
        . '<p style="color:#6B7280;font-size:12px;margin-top:24px;">Si no realizaste esta solicitud, puedes ignorar este mensaje.</p>'
        . '<p style="margin-top:18px;">Atentamente,<br/><strong>Equipo Payops</strong> · Goleman IPS</p>'
        . '</div></div>';
    try {
        Mailer::send([
            'to'      => [$correo],
            'subject' => 'Solicitud de registro recibida - Payops',
            'text'    => $textUser,
            'html'    => $htmlUser,
        ]);
    } catch (Throwable $e) {
        error_log('[registro_publico email user] ' . $e->getMessage());
    }

    // Notificacion a administradores
    $adminStmt = $pdo->prepare(
        "SELECT u.correo FROM usuarios u
         INNER JOIN roles r ON r.id = u.rol_id
         WHERE LOWER(r.nombre) = 'administrador' AND u.activo = 1"
    );
    $adminStmt->execute();
    $adminCorreos = array_column($adminStmt->fetchAll(), 'correo');
    if (!empty($adminCorreos)) {
        $textAdmin = "Nuevo registro pendiente de aprobacion en Payops.\n\n"
            . "Nombre: {$nombreCompleto}\nCorreo: {$correo}\nRol solicitado: {$rol['nombre']}\n\n"
            . "Activa la cuenta desde el Panel administrador.";
        try {
            Mailer::send([
                'to'      => $adminCorreos,
                'subject' => "Nuevo registro pendiente: {$nombreCompleto}",
                'text'    => $textAdmin,
            ]);
        } catch (Throwable $e) {
            error_log('[registro_publico email admin] ' . $e->getMessage());
        }
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[registro_publico] ' . $e->getMessage());
    Response::error('No se pudo procesar el registro', 500);
}

Response::json([
    'ok' => true,
    'message' => 'Solicitud de registro enviada. Revisa tu correo y espera la aprobacion del administrador.',
], 201);
