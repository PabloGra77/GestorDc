<?php
declare(strict_types=1);

Auth::requireAdmin();

$id = (int)($params['id'] ?? 0);
$body = Request::body();
$pdo = Db::pdo();

$cur = $pdo->prepare(
    "SELECT u.*, r.id AS r_id, r.nombre AS r_nombre, r.descripcion AS r_desc,
            r.activo AS r_activo, r.permisos AS r_permisos
     FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = :id LIMIT 1"
);
$cur->execute([':id' => $id]);
$row = $cur->fetch();
if (!$row) Response::error('Usuario no encontrado', 404);

$rolNombre = $row['r_nombre'];

// Detectar transicion de "Bloqueado" a "Activo" (aprobacion de auto-registro)
$estabaInactivo = (int)$row['activo'] === 0;
$tieneAprobacionPendiente = $estabaInactivo && (int)$row['must_change_password'] === 1;
$seEstaActivando = $tieneAprobacionPendiente
    && array_key_exists('activo', $body)
    && (int)(bool)$body['activo'] === 1;

// Si activan a un usuario que se autorregistro, generar credenciales nuevas
$nuevaPasswordTemp = null;
if ($seEstaActivando) {
    $nuevaPasswordTemp = bin2hex(random_bytes(6)) . '!Aa';
    $row['password_hash'] = password_hash($nuevaPasswordTemp, PASSWORD_BCRYPT, ['cost' => 12]);
    $row['must_change_password'] = 1;
}

// Correo
if (isset($body['correo'])) {
    $correo = strtolower(trim((string)$body['correo']));
    DomainPolicy::requireValid($correo);
    $dup = $pdo->prepare("SELECT id FROM usuarios WHERE correo = :c AND id <> :id LIMIT 1");
    $dup->execute([':c' => $correo, ':id' => $id]);
    if ($dup->fetch()) Response::error('Ya existe un usuario con ese correo', 409);
    $row['correo'] = $correo;
}

// Rol
if (isset($body['rolId'])) {
    $rolStmt = $pdo->prepare("SELECT id, nombre FROM roles WHERE id = :id LIMIT 1");
    $rolStmt->execute([':id' => (int)$body['rolId']]);
    $r = $rolStmt->fetch();
    if (!$r) Response::error('El rol indicado no existe', 404);
    $row['rol_id'] = (int)$r['id'];
    $rolNombre = $r['nombre'];
}

// Permisos
if (array_key_exists('permisos', $body)) {
    $esAdmin = strtolower(trim($rolNombre)) === 'administrador';
    if ($esAdmin) {
        Response::error('No esta permitido modificar permisos de usuarios con rol Administrador', 403);
    }
    $row['permisos'] = json_encode(Permissions::normalize($body['permisos']), JSON_UNESCAPED_UNICODE);
}

// Campos simples
foreach ([
    'primerNombre'    => 'primer_nombre',
    'segundoNombre'   => 'segundo_nombre',
    'primerApellido'  => 'primer_apellido',
    'segundoApellido' => 'segundo_apellido',
    'numeroDocumento' => 'numero_documento',
    'area'            => 'area',
] as $in => $col) {
    if (array_key_exists($in, $body)) {
        $row[$col] = $body[$in] !== null ? trim((string)$body[$in]) : null;
    }
}
if (array_key_exists('tipoDocumento', $body)) {
    $row['tipo_documento'] = strtoupper(trim((string)$body['tipoDocumento']));
}
if (array_key_exists('nombreCompleto', $body) && trim((string)$body['nombreCompleto']) !== '') {
    $row['nombre_completo'] = trim((string)$body['nombreCompleto']);
} else {
    $joined = implode(' ', array_filter([
        $row['primer_nombre'], $row['segundo_nombre'],
        $row['primer_apellido'], $row['segundo_apellido'],
    ]));
    if ($joined !== '') $row['nombre_completo'] = $joined;
}

// Password
if (array_key_exists('password', $body) || array_key_exists('passwordHash', $body)) {
    $raw = trim((string)($body['password'] ?? $body['passwordHash'] ?? ''));
    if ($raw === '') {
        $row['password_hash'] = null;
    } else {
        $row['password_hash'] = password_hash($raw, PASSWORD_BCRYPT, ['cost' => 12]);
    }
    $row['must_change_password'] = 1;
}

if (array_key_exists('activo', $body)) {
    $row['activo'] = (int)(bool)$body['activo'];
}

if (array_key_exists('areaId', $body)) {
    $aid = $body['areaId'] === '' || $body['areaId'] === null ? null : (int)$body['areaId'];
    if ($aid !== null) {
        $aChk = $pdo->prepare("SELECT id FROM areas WHERE id = :id LIMIT 1");
        $aChk->execute([':id' => $aid]);
        if (!$aChk->fetch()) Response::error('El area indicada no existe', 404);
    }
    $row['area_id'] = $aid;
}
if (array_key_exists('nivelAprobacion', $body)) {
    $na = trim((string)$body['nivelAprobacion']) ?: null;
    $nivelesValidos = ['analista', 'coordinador', 'director', 'contabilidad'];
    if ($na && !in_array($na, $nivelesValidos, true)) {
        Response::error('Nivel de aprobacion invalido', 400);
    }
    $row['nivel_aprobacion'] = $na;
}

// Campos de perfil personal y cuenta bancaria (columnas pueden no existir aún)
$camposExtra = [];
foreach ([
    'telefono'       => 'telefono',
    'correoPersonal' => 'correo_personal',
    'banco'          => 'banco',
    'tipoCuenta'     => 'tipo_cuenta',
    'numeroCuenta'   => 'numero_cuenta',
    'titularCuenta'  => 'titular_cuenta',
] as $in => $col) {
    if (array_key_exists($in, $body)) {
        $camposExtra[$col] = trim((string)($body[$in] ?? '')) ?: null;
    }
}
if (!empty($camposExtra)) {
    try {
        $sets   = implode(', ', array_map(fn($k) => "$k = :ex_$k", array_keys($camposExtra)));
        $params = array_merge([':id' => $id], array_combine(
            array_map(fn($k) => ":ex_$k", array_keys($camposExtra)),
            array_values($camposExtra)
        ));
        $pdo->prepare("UPDATE usuarios SET $sets WHERE id = :id")->execute($params);
    } catch (Throwable) {}
}

$upd = $pdo->prepare(
    "UPDATE usuarios SET
        primer_nombre = :pn,
        segundo_nombre = :sn,
        primer_apellido = :pa,
        segundo_apellido = :sa,
        tipo_documento = :td,
        numero_documento = :nd,
        nombre_completo = :nc,
        correo = :co,
        area = :ar,
        permisos = :pe,
        password_hash = :ph,
        must_change_password = :mcp,
        activo = :ac,
        rol_id = :ri,
        area_id = :ai,
        nivel_aprobacion = :na
     WHERE id = :id"
);
$upd->execute([
    ':pn' => $row['primer_nombre'],
    ':sn' => $row['segundo_nombre'],
    ':pa' => $row['primer_apellido'],
    ':sa' => $row['segundo_apellido'],
    ':td' => $row['tipo_documento'],
    ':nd' => $row['numero_documento'],
    ':nc' => $row['nombre_completo'],
    ':co' => $row['correo'],
    ':ar' => $row['area'],
    ':pe' => is_string($row['permisos']) ? $row['permisos'] : json_encode($row['permisos'], JSON_UNESCAPED_UNICODE),
    ':ph' => $row['password_hash'],
    ':mcp' => (int)$row['must_change_password'],
    ':ac' => (int)$row['activo'],
    ':ri' => (int)$row['rol_id'],
    ':ai' => $row['area_id'] !== null ? (int)$row['area_id'] : null,
    ':na' => $row['nivel_aprobacion'] ?? null,
    ':id' => $id,
]);

$sel = $pdo->prepare(
    "SELECT u.*, r.id AS r_id, r.nombre AS r_nombre, r.descripcion AS r_desc,
            r.activo AS r_activo, r.permisos AS r_permisos
     FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = :id"
);
$sel->execute([':id' => $id]);
$usuarioActualizado = $sel->fetch();

// Si fue una aprobacion de auto-registro, enviar correo profesional con credenciales
if ($seEstaActivando && $nuevaPasswordTemp !== null) {
    $base = rtrim(Config::get('WEB_BASE_URL', 'https://payops.ipsgoleman.com'), '/');
    $loginLink = $base . '/login';
    $nombre = (string)$usuarioActualizado['nombre_completo'];
    $correoDest = (string)$usuarioActualizado['correo'];
    $rolNombreEmail = (string)$usuarioActualizado['r_nombre'];

    $text = "Hola {$nombre},\n\n"
        . "Tu cuenta en Payops fue aprobada por un administrador. "
        . "Ya puedes ingresar a la plataforma con los siguientes datos:\n\n"
        . "  Correo: {$correoDest}\n"
        . "  Contrasena temporal: {$nuevaPasswordTemp}\n"
        . "  Rol asignado: {$rolNombreEmail}\n\n"
        . "Por seguridad, debes cambiar tu contrasena temporal en el primer ingreso.\n"
        . "Ingresa aqui: {$loginLink}\n\n"
        . "Si tienes cualquier inconveniente, comunicate con el administrador del sistema.\n\n"
        . "Atentamente,\nEquipo Payops · Goleman IPS";

    $h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $html = '<div style="font-family:Arial,sans-serif;color:#0F172A;line-height:1.6;max-width:580px;margin:0 auto;background:#F7F4EC;">'
        . '<div style="background:#070B1D;color:#D4AF37;padding:22px 24px;border-radius:10px 10px 0 0;">'
        . '<h1 style="margin:0;font-size:24px;letter-spacing:0.06em;">PAYOPS</h1>'
        . '<p style="margin:4px 0 0;color:#C8CEE0;font-size:13px;">Goleman IPS &middot; Plataforma documental</p>'
        . '</div>'
        . '<div style="background:#FFFFFF;border:1px solid rgba(212,175,55,0.45);border-top:none;padding:26px 24px;border-radius:0 0 10px 10px;">'
        . '<h2 style="color:#B8901F;margin:0 0 12px;font-size:20px;">Bienvenido(a) a Payops</h2>'
        . '<p>Hola <strong>' . $h($nombre) . '</strong>,</p>'
        . '<p>Tu cuenta fue <strong style="color:#166534;">verificada y aprobada</strong> por un administrador. '
        . 'Estos son tus datos de acceso a la plataforma:</p>'
        . '<table style="background:#F7F4EC;border:1px solid rgba(212,175,55,0.4);border-radius:8px;padding:14px;margin:14px 0;width:100%;border-collapse:separate;border-spacing:0;">'
        . '<tr><td style="padding:6px 10px;color:#6B7280;font-size:13px;width:42%;">Correo</td><td style="padding:6px 10px;"><strong>' . $h($correoDest) . '</strong></td></tr>'
        . '<tr><td style="padding:6px 10px;color:#6B7280;font-size:13px;">Contrasena temporal</td><td style="padding:6px 10px;"><code style="background:#0F172A;color:#D4AF37;padding:4px 8px;border-radius:4px;font-size:14px;letter-spacing:0.05em;">' . $h($nuevaPasswordTemp) . '</code></td></tr>'
        . '<tr><td style="padding:6px 10px;color:#6B7280;font-size:13px;">Rol asignado</td><td style="padding:6px 10px;"><strong>' . $h($rolNombreEmail) . '</strong></td></tr>'
        . '</table>'
        . '<p style="background:rgba(212,175,55,0.14);border-left:4px solid #D4AF37;padding:14px 16px;border-radius:6px;">'
        . '<strong>Importante:</strong> por seguridad, debes cambiar la contrasena temporal en el primer ingreso a la plataforma.</p>'
        . '<p style="text-align:center;margin:24px 0 16px;">'
        . '<a href="' . $h($loginLink) . '" style="display:inline-block;background:linear-gradient(135deg,#D4AF37 0%,#F3D77B 50%,#D4AF37 100%);color:#0F172A;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">Ingresar a Payops</a>'
        . '</p>'
        . '<p style="color:#6B7280;font-size:12px;margin-top:20px;border-top:1px solid rgba(212,175,55,0.25);padding-top:14px;">Si no solicitaste esta cuenta, comunicate inmediatamente con el administrador del sistema.</p>'
        . '<p style="margin-top:18px;">Atentamente,<br/><strong>Equipo Payops</strong> &middot; Goleman IPS</p>'
        . '</div></div>';

    try {
        Mailer::send([
            'to' => [$correoDest],
            'subject' => 'Tu cuenta de Payops fue aprobada · Credenciales de acceso',
            'text' => $text,
            'html' => $html,
        ]);
    } catch (Throwable $e) {
        error_log('[usuarios/update aprobacion email] ' . $e->getMessage());
    }
}

Auditoria::registrar(
    'editar_usuario',
    "Usuario editado: {$row['nombre_completo']} ({$row['correo']}) · Rol: {$rolNombre}"
);

Response::json(Shapes::usuario($usuarioActualizado));
