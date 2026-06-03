<?php
declare(strict_types=1);

Auth::requireAdmin();

$body = Request::body();
$correo = strtolower(trim((string)($body['correo'] ?? '')));
if ($correo === '') Response::error('Correo es obligatorio', 400);
DomainPolicy::requireValid($correo);

$primerNombre   = trim((string)($body['primerNombre']   ?? ''));
$primerApellido = trim((string)($body['primerApellido'] ?? ''));
$tipoDocumento  = strtoupper(trim((string)($body['tipoDocumento'] ?? '')));
$numeroDocumento = trim((string)($body['numeroDocumento'] ?? ''));
$rolId          = (int)($body['rolId'] ?? 0);

if ($primerNombre === '' || $primerApellido === '' || $tipoDocumento === '' || $numeroDocumento === '' || $rolId <= 0) {
    Response::error('Faltan campos obligatorios', 400);
}

$pdo = Db::pdo();

$dup = $pdo->prepare("SELECT id FROM usuarios WHERE correo = :c LIMIT 1");
$dup->execute([':c' => $correo]);
if ($dup->fetch()) Response::error('Ya existe un usuario con ese correo', 409);

$rolStmt = $pdo->prepare("SELECT id, nombre FROM roles WHERE id = :id LIMIT 1");
$rolStmt->execute([':id' => $rolId]);
$rol = $rolStmt->fetch();
if (!$rol) Response::error('El rol indicado no existe', 404);

$segundoNombre = trim((string)($body['segundoNombre'] ?? '')) ?: null;
$segundoApellido = trim((string)($body['segundoApellido'] ?? '')) ?: null;
$area = trim((string)($body['area'] ?? '')) ?: $rol['nombre'];

$nombreCompleto = trim((string)($body['nombreCompleto'] ?? '')) ?:
    implode(' ', array_filter([$primerNombre, $segundoNombre, $primerApellido, $segundoApellido]));

$esAdmin = strtolower(trim($rol['nombre'])) === 'administrador';
$permisos = $esAdmin ? new stdClass() : Permissions::normalize($body['permisos'] ?? []);

// Password temporal aleatorio por usuario (no reutilizar default global).
// 12 bytes hex + un caracter especial = ~96 bits de entropia.
$tempPassword = bin2hex(random_bytes(6)) . '!Aa';
$tempHash = password_hash($tempPassword, PASSWORD_BCRYPT, ['cost' => 12]);

// Area institucional (opcional) + nivel de aprobacion
$areaIdInst = isset($body['areaId']) && $body['areaId'] !== '' ? (int)$body['areaId'] : null;
if ($areaIdInst) {
    $aChk = $pdo->prepare("SELECT id FROM areas WHERE id = :id LIMIT 1");
    $aChk->execute([':id' => $areaIdInst]);
    if (!$aChk->fetch()) Response::error('El area indicada no existe', 404);
}
$nivelAprob = trim((string)($body['nivelAprobacion'] ?? '')) ?: null;
$nivelesValidos = ['analista', 'coordinador', 'director', 'contabilidad'];
if ($nivelAprob && !in_array($nivelAprob, $nivelesValidos, true)) {
    Response::error('Nivel de aprobacion invalido', 400);
}

// 1) Crear el usuario. El envio de correo NO debe bloquear la creacion.
try {
    $ins = $pdo->prepare(
        "INSERT INTO usuarios
         (primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
          tipo_documento, numero_documento, nombre_completo, correo, area,
          permisos, password_hash, must_change_password, activo, rol_id, area_id, nivel_aprobacion)
         VALUES
         (:pn, :sn, :pa, :sa, :td, :nd, :nc, :co, :ar,
          :pe, :ph, 1, :ac, :ri, :ai, :na)"
    );
    $ins->execute([
        ':pn' => $primerNombre,
        ':sn' => $segundoNombre,
        ':pa' => $primerApellido,
        ':sa' => $segundoApellido,
        ':td' => $tipoDocumento,
        ':nd' => $numeroDocumento,
        ':nc' => $nombreCompleto,
        ':co' => $correo,
        ':ar' => $area,
        ':pe' => json_encode($permisos, JSON_UNESCAPED_UNICODE),
        ':ph' => $tempHash,
        ':ac' => isset($body['activo']) ? ((int)(bool)$body['activo']) : 1,
        ':ri' => (int)$rol['id'],
        ':ai' => $areaIdInst,
        ':na' => $nivelAprob,
    ]);
    $newId = (int)$pdo->lastInsertId();
} catch (Throwable $e) {
    error_log('[usuarios/create] ' . $e->getMessage());
    Response::error('No se pudo crear el usuario', 500);
}

// 2) Correo de bienvenida (best-effort: si falla, el usuario YA quedo creado).
$base = rtrim(Config::get('WEB_BASE_URL', ''), '/');
$loginLink = $base . '/login';
$text = "Hola {$nombreCompleto},\n\nSe realizo la creacion de tu usuario en la plataforma GestorDoc.\n"
      . "Usuario: {$correo}\nContrasena temporal: {$tempPassword}\n\n"
      . "Al ingresar por primera vez debes cambiar tu contrasena.\nAcceso: {$loginLink}";
$html = '<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">'
      . '<p>Hola ' . htmlspecialchars($nombreCompleto) . ',</p>'
      . '<p>Se realizo la creacion de tu usuario en la plataforma <strong>GestorDoc</strong>.</p>'
      . '<p><strong>Usuario:</strong> ' . htmlspecialchars($correo) . '<br/>'
      . '<strong>Contrasena temporal:</strong> ' . htmlspecialchars($tempPassword) . '</p>'
      . '<p>Al ingresar por primera vez debes cambiar tu contrasena.</p>'
      . '<p><a href="' . htmlspecialchars($loginLink) . '">Ir a iniciar sesion</a></p></div>';

$correoEnviado = false;
try {
    $correoEnviado = Mailer::send([
        'to'      => [$correo],
        'subject' => 'Creacion de usuario - GestorDoc',
        'text'    => $text,
        'html'    => $html,
    ]);
} catch (Throwable $e) {
    error_log('[usuarios/create email] ' . $e->getMessage());
}

$sel = $pdo->prepare(
    "SELECT u.*, r.id AS r_id, r.nombre AS r_nombre, r.descripcion AS r_desc,
            r.activo AS r_activo, r.permisos AS r_permisos
     FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = :id"
);
$sel->execute([':id' => $newId]);
$out = Shapes::usuario($sel->fetch());
$out['correoEnviado'] = $correoEnviado;
// Si el correo no salio, devolver la contrasena temporal para que el admin la entregue.
$out['passwordTemporal'] = $correoEnviado ? null : $tempPassword;
Response::json($out, 201);
