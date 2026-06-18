<?php
declare(strict_types=1);

// Endpoint PUBLICO: auto-registro de usuario PRE-AUTORIZADO.
// Solo cedulas que el administrador haya cargado en `personal_autorizado`
// pueden crear cuenta. El rol y el area vienen de esa whitelist (no se piden
// en el formulario). La cuenta queda activa y se envia contrasena temporal.

Throttle::hit('reg-pub:' . Throttle::clientIp(), 5, 60);
Throttle::hit('reg-pub-hour:' . Throttle::clientIp(), 20, 3600);

require_once __DIR__ . '/../personal/_helpers.php';

$capitalizar = static function (string $s): string {
    $s = trim($s);
    if ($s === '') return '';
    return preg_replace_callback('/(^|[\s\-])(\p{Ll})/u', static fn($m) => $m[1] . mb_strtoupper($m[2], 'UTF-8'), mb_strtolower($s, 'UTF-8'));
};

$body = Request::body();
$primerNombre    = $capitalizar((string)($body['primerNombre'] ?? ''));
$segundoNombre   = $capitalizar((string)($body['segundoNombre'] ?? '')) ?: null;
$primerApellido  = $capitalizar((string)($body['primerApellido'] ?? ''));
$segundoApellido = $capitalizar((string)($body['segundoApellido'] ?? '')) ?: null;
$tipoDocumento   = strtoupper(trim((string)($body['tipoDocumento'] ?? '')));
$numeroDocumento = PersonalHelpers::limpiarDocumento((string)($body['numeroDocumento'] ?? ''));
$correo          = strtolower(trim((string)($body['correo'] ?? '')));

$tiposDocValidos = ['CC', 'CE', 'TI', 'PP', 'PEP', 'NIT'];
if ($tipoDocumento !== '' && !in_array($tipoDocumento, $tiposDocValidos, true)) $tipoDocumento = '';

if ($primerNombre === '' || $primerApellido === '' || $correo === '') {
    Response::error('Primer nombre, apellido y correo son obligatorios', 400);
}
if (strlen($numeroDocumento) < 4) Response::error('Numero de documento invalido', 400);
if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) Response::error('Correo invalido', 400);
DomainPolicy::requireValid($correo);

$pdo = Db::pdo();

// 1) La cedula DEBE estar autorizada y sin usar
$wl = $pdo->prepare("SELECT * FROM personal_autorizado WHERE numero_documento = :cc LIMIT 1");
$wl->execute([':cc' => $numeroDocumento]);
$auth = $wl->fetch();
if (!$auth) {
    Response::error('Tu numero de documento no esta autorizado para crear cuenta. Contacta al administrador.', 403);
}
if ((int)$auth['usado'] === 1) {
    Response::error('Ya existe una cuenta creada con este documento. Si olvidaste tu acceso, usa "Olvide mi contrasena".', 409);
}

// 2) Correo no duplicado
$dup = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER(correo) = :c LIMIT 1");
$dup->execute([':c' => $correo]);
if ($dup->fetch()) Response::error('Ya existe un usuario con ese correo', 409);

// 3) Resolver rol y area desde la whitelist
$rolSlug = PersonalHelpers::normalizarRol((string)$auth['rol']);
$rolId   = PersonalHelpers::rolIdPorSlug($pdo, $rolSlug);
if ($rolId === null) Response::error('El rol autorizado ya no existe. Contacta al administrador.', 400);
$rolNombreStmt = $pdo->prepare("SELECT nombre FROM roles WHERE id = :id LIMIT 1");
$rolNombreStmt->execute([':id' => $rolId]);
$rolNombre = (string)($rolNombreStmt->fetchColumn() ?: ucfirst($rolSlug));
$areaId  = PersonalHelpers::areaIdPorNombre($pdo, $auth['area'] ?? null);
$nivel   = $auth['nivel_aprobacion'] ?: PersonalHelpers::nivelDeRol($rolSlug);

$nombreCompleto = implode(' ', array_filter([$primerNombre, $segundoNombre, $primerApellido, $segundoApellido]));
$tempPassword = bin2hex(random_bytes(5)) . rand(10, 99) . '!Aa';
$tempHash = password_hash($tempPassword, PASSWORD_BCRYPT, ['cost' => 12]);

$pdo->beginTransaction();
try {
    $ins = $pdo->prepare(
        "INSERT INTO usuarios
         (primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
          tipo_documento, numero_documento, nombre_completo, correo, area,
          permisos, password_hash, must_change_password, activo, rol_id, area_id, nivel_aprobacion)
         VALUES
         (:pn, :sn, :pa, :sa, :td, :nd, :nc, :co, :ar,
          :pe, :ph, 1, 1, :ri, :ai, :niv)"
    );
    $ins->execute([
        ':pn' => $primerNombre, ':sn' => $segundoNombre,
        ':pa' => $primerApellido, ':sa' => $segundoApellido,
        ':td' => $tipoDocumento ?: null, ':nd' => $numeroDocumento,
        ':nc' => $nombreCompleto, ':co' => $correo, ':ar' => $rolNombre,
        ':pe' => '{}', ':ph' => $tempHash,
        ':ri' => $rolId, ':ai' => $areaId, ':niv' => $nivel,
    ]);

    // Marcar whitelist como usada
    $upd = $pdo->prepare("UPDATE personal_autorizado SET usado = 1, usado_en = NOW() WHERE id = :id");
    $upd->execute([':id' => (int)$auth['id']]);

    // Correo con contrasena temporal
    $base = rtrim(Config::get('WEB_BASE_URL', 'https://payops.ipsgoleman.com'), '/');
    $loginLink = $base . '/login';
    $textUser = "Hola {$nombreCompleto},\n\n"
        . "Tu cuenta en Payops (Goleman IPS) fue creada correctamente.\n\n"
        . "  Correo: {$correo}\n"
        . "  Rol: {$rolNombre}\n"
        . "  Contrasena temporal: {$tempPassword}\n\n"
        . "Ingresa en {$loginLink} y cambia tu contrasena en el primer inicio de sesion.\n\n"
        . "Si no realizaste esta solicitud, contacta al administrador.\n\nEquipo Payops - Goleman IPS";
    $htmlUser = '<div style="font-family:Arial,sans-serif;color:#0F172A;line-height:1.6;max-width:560px;margin:0 auto;">'
        . '<div style="background:#070B1D;color:#D4AF37;padding:18px 22px;border-radius:10px 10px 0 0;">'
        . '<h1 style="margin:0;font-size:22px;">PAYOPS</h1>'
        . '<p style="margin:4px 0 0;color:#C8CEE0;font-size:13px;">Goleman IPS - Plataforma documental</p></div>'
        . '<div style="background:#FFF;border:1px solid rgba(212,175,55,0.4);border-top:none;padding:24px 22px;border-radius:0 0 10px 10px;">'
        . '<h2 style="color:#B8901F;margin:0 0 12px;font-size:18px;">Tu cuenta esta lista</h2>'
        . '<p>Hola <strong>' . htmlspecialchars($nombreCompleto, ENT_QUOTES, 'UTF-8') . '</strong>, ya puedes ingresar a Payops.</p>'
        . '<table style="background:#F7F4EC;border:1px solid rgba(212,175,55,0.35);border-radius:8px;padding:14px;margin:14px 0;width:100%;">'
        . '<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;">Correo</td><td style="padding:4px 0;"><strong>' . htmlspecialchars($correo, ENT_QUOTES, 'UTF-8') . '</strong></td></tr>'
        . '<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;">Rol</td><td style="padding:4px 0;"><strong>' . htmlspecialchars($rolNombre, ENT_QUOTES, 'UTF-8') . '</strong></td></tr>'
        . '<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;">Contrasena temporal</td><td style="padding:4px 0;"><strong>' . htmlspecialchars($tempPassword, ENT_QUOTES, 'UTF-8') . '</strong></td></tr>'
        . '</table>'
        . '<p><a href="' . htmlspecialchars($loginLink, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;background:#D4AF37;color:#070B1D;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:8px;">Ingresar a Payops</a></p>'
        . '<p style="color:#6B7280;font-size:12px;margin-top:18px;">Por seguridad, cambia tu contrasena en el primer ingreso.</p>'
        . '</div></div>';
    try {
        Mailer::send(['to' => [$correo], 'subject' => 'Tu cuenta Payops esta lista', 'text' => $textUser, 'html' => $htmlUser]);
        $correoEnviado = true;
    } catch (Throwable $e) {
        error_log('[registro_publico email] ' . $e->getMessage());
        $correoEnviado = false;
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[registro_publico] ' . $e->getMessage());
    Response::error('No se pudo crear la cuenta', 500);
}

Response::json([
    'ok' => true,
    'correoEnviado' => $correoEnviado,
    'message' => $correoEnviado
        ? 'Cuenta creada. Te enviamos la contrasena temporal a tu correo.'
        : 'Cuenta creada, pero no se pudo enviar el correo. Usa "Olvide mi contrasena" para obtener acceso.',
], 201);
