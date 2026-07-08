<?php
declare(strict_types=1);

$jwt = Auth::requireUser();
$usuarioId = (int)($jwt['sub'] ?? 0);
$pdo = Db::pdo();

// ── Traer usuario actual ──────────────────────────────────────────────────
$stmt = $pdo->prepare(
    "SELECT u.*, r.id AS r_id, r.nombre AS r_nombre, r.descripcion AS r_desc,
            r.activo AS r_activo, r.permisos AS r_permisos
     FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = :id LIMIT 1"
);
$stmt->execute([':id' => $usuarioId]);
$row = $stmt->fetch();
if (!$row) Response::error('Usuario no encontrado', 404);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Agregar teléfono y dirección si la columna existe (migración gradual)
    $extra = [];
    try {
        $chk = $pdo->prepare("SELECT telefono, direccion, banco, tipo_cuenta, numero_cuenta, titular_cuenta, correo_personal, fecha_nacimiento, fecha_expedicion, lugar_expedicion FROM usuarios WHERE id = :id LIMIT 1");
        $chk->execute([':id' => $usuarioId]);
        $ex = $chk->fetch();
        if ($ex !== false) {
            $extra['telefono'] = $ex['telefono'] ?? null;
            $extra['direccion'] = $ex['direccion'] ?? null;
            $extra['banco'] = $ex['banco'] ?? null;
            $extra['tipoCuenta'] = $ex['tipo_cuenta'] ?? null;
            $extra['numeroCuenta'] = $ex['numero_cuenta'] ?? null;
            $extra['titularCuenta'] = $ex['titular_cuenta'] ?? null;
            $extra['correoPersonal'] = $ex['correo_personal'] ?? null;
            $extra['fechaNacimiento'] = $ex['fecha_nacimiento'] ?? null;
            $extra['fechaExpedicion'] = $ex['fecha_expedicion'] ?? null;
            $extra['lugarExpedicion'] = $ex['lugar_expedicion'] ?? null;
        }
    } catch (Throwable) { /* columnas aún no existen */ }

    // Campos OPS (EPS + documentos adjuntos en perfil)
    try {
        $chkOps = $pdo->prepare("SELECT eps, archivo_eps_id, archivo_eps_nombre, archivo_documento_id, archivo_documento_nombre, archivo_cuenta_id, archivo_cuenta_nombre FROM usuarios WHERE id = :id LIMIT 1");
        $chkOps->execute([':id' => $usuarioId]);
        $exOps = $chkOps->fetch();
        if ($exOps !== false) {
            $extra['eps'] = $exOps['eps'] ?? null;
            $extra['archivoEpsId'] = $exOps['archivo_eps_id'] ?? null;
            $extra['archivoEpsNombre'] = $exOps['archivo_eps_nombre'] ?? null;
            $extra['archivoDocumentoId'] = $exOps['archivo_documento_id'] ?? null;
            $extra['archivoDocumentoNombre'] = $exOps['archivo_documento_nombre'] ?? null;
            $extra['archivoCuentaId'] = $exOps['archivo_cuenta_id'] ?? null;
            $extra['archivoCuentaNombre'] = $exOps['archivo_cuenta_nombre'] ?? null;
        }
    } catch (Throwable) { /* columnas OPS aún no existen */ }

    Response::json(array_merge(Shapes::usuario($row), $extra));
    exit;
}

// ── PATCH: actualizar solo campos personales del propio usuario ──────────
$body = Request::body();

// Campos de nombre
foreach ([
    'primerNombre'    => 'primer_nombre',
    'segundoNombre'   => 'segundo_nombre',
    'primerApellido'  => 'primer_apellido',
    'segundoApellido' => 'segundo_apellido',
    'numeroDocumento' => 'numero_documento',
] as $in => $col) {
    if (array_key_exists($in, $body)) {
        $row[$col] = $body[$in] !== null ? trim((string)$body[$in]) : null;
    }
}
if (array_key_exists('tipoDocumento', $body)) {
    $row['tipo_documento'] = strtoupper(trim((string)$body['tipoDocumento']));
}

// Reconstruir nombre_completo
$joined = implode(' ', array_filter([
    $row['primer_nombre'], $row['segundo_nombre'],
    $row['primer_apellido'], $row['segundo_apellido'],
]));
if ($joined !== '') $row['nombre_completo'] = $joined;

// Correo (con validación de dominio)
if (array_key_exists('correo', $body)) {
    $correo = strtolower(trim((string)$body['correo']));
    DomainPolicy::requireValid($correo);
    $dup = $pdo->prepare("SELECT id FROM usuarios WHERE correo = :c AND id <> :id LIMIT 1");
    $dup->execute([':c' => $correo, ':id' => $usuarioId]);
    if ($dup->fetch()) Response::error('Ya existe otro usuario con ese correo', 409);
    $row['correo'] = $correo;
}

// Actualizar campos básicos
$upd = $pdo->prepare(
    "UPDATE usuarios SET
        primer_nombre   = :pn,
        segundo_nombre  = :sn,
        primer_apellido = :pa,
        segundo_apellido = :sa,
        tipo_documento  = :td,
        numero_documento = :nd,
        nombre_completo = :nc,
        correo          = :co
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
    ':id' => $usuarioId,
]);

// Teléfono y dirección (si las columnas existen)
$camposExtra = [];
if (array_key_exists('telefono', $body)) $camposExtra['telefono'] = trim((string)($body['telefono'] ?? '')) ?: null;
if (array_key_exists('direccion', $body)) $camposExtra['direccion'] = trim((string)($body['direccion'] ?? '')) ?: null;
if (array_key_exists('banco', $body)) $camposExtra['banco'] = trim((string)($body['banco'] ?? '')) ?: null;
if (array_key_exists('tipoCuenta', $body)) $camposExtra['tipo_cuenta'] = trim((string)($body['tipoCuenta'] ?? '')) ?: null;
if (array_key_exists('numeroCuenta', $body)) $camposExtra['numero_cuenta'] = trim((string)($body['numeroCuenta'] ?? '')) ?: null;
if (array_key_exists('titularCuenta', $body)) $camposExtra['titular_cuenta'] = trim((string)($body['titularCuenta'] ?? '')) ?: null;
if (array_key_exists('correoPersonal', $body)) {
    $cp = trim((string)($body['correoPersonal'] ?? ''));
    $camposExtra['correo_personal'] = $cp ?: null;
}
if (array_key_exists('fechaNacimiento', $body)) $camposExtra['fecha_nacimiento'] = $body['fechaNacimiento'] ?: null;
if (array_key_exists('fechaExpedicion', $body)) $camposExtra['fecha_expedicion'] = $body['fechaExpedicion'] ?: null;
if (array_key_exists('lugarExpedicion', $body)) {
    $le = trim((string)($body['lugarExpedicion'] ?? ''));
    $camposExtra['lugar_expedicion'] = $le ?: null;
}
// Campos OPS
if (array_key_exists('eps', $body)) $camposExtra['eps'] = trim((string)($body['eps'] ?? '')) ?: null;
if (array_key_exists('archivoEpsId', $body)) $camposExtra['archivo_eps_id'] = $body['archivoEpsId'] ?: null;
if (array_key_exists('archivoEpsNombre', $body)) $camposExtra['archivo_eps_nombre'] = $body['archivoEpsNombre'] ?: null;
if (array_key_exists('archivoDocumentoId', $body)) $camposExtra['archivo_documento_id'] = $body['archivoDocumentoId'] ?: null;
if (array_key_exists('archivoDocumentoNombre', $body)) $camposExtra['archivo_documento_nombre'] = $body['archivoDocumentoNombre'] ?: null;
if (array_key_exists('archivoCuentaId', $body)) $camposExtra['archivo_cuenta_id'] = $body['archivoCuentaId'] ?: null;
if (array_key_exists('archivoCuentaNombre', $body)) $camposExtra['archivo_cuenta_nombre'] = $body['archivoCuentaNombre'] ?: null;
if (!empty($camposExtra)) {
    try {
        $sets = implode(', ', array_map(fn($k) => "$k = :$k", array_keys($camposExtra)));
        $params = array_merge([':id' => $usuarioId], array_combine(
            array_map(fn($k) => ":$k", array_keys($camposExtra)),
            array_values($camposExtra)
        ));
        $pdo->prepare("UPDATE usuarios SET $sets WHERE id = :id")->execute($params);
    } catch (Throwable) { /* columnas aún no existen, silencioso */ }
}

// Devolver el perfil actualizado
$sel = $pdo->prepare(
    "SELECT u.*, r.id AS r_id, r.nombre AS r_nombre, r.descripcion AS r_desc,
            r.activo AS r_activo, r.permisos AS r_permisos
     FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = :id LIMIT 1"
);
$sel->execute([':id' => $usuarioId]);
$updated = $sel->fetch();

$extra = [];
try {
    $chk = $pdo->prepare("SELECT telefono, direccion, banco, tipo_cuenta, numero_cuenta, titular_cuenta, correo_personal, fecha_nacimiento, fecha_expedicion, lugar_expedicion FROM usuarios WHERE id = :id LIMIT 1");
    $chk->execute([':id' => $usuarioId]);
    $ex = $chk->fetch();
    if ($ex !== false) {
        $extra['telefono'] = $ex['telefono'] ?? null;
        $extra['direccion'] = $ex['direccion'] ?? null;
        $extra['banco'] = $ex['banco'] ?? null;
        $extra['tipoCuenta'] = $ex['tipo_cuenta'] ?? null;
        $extra['numeroCuenta'] = $ex['numero_cuenta'] ?? null;
        $extra['titularCuenta'] = $ex['titular_cuenta'] ?? null;
        $extra['correoPersonal'] = $ex['correo_personal'] ?? null;
        $extra['fechaNacimiento'] = $ex['fecha_nacimiento'] ?? null;
        $extra['fechaExpedicion'] = $ex['fecha_expedicion'] ?? null;
        $extra['lugarExpedicion'] = $ex['lugar_expedicion'] ?? null;
    }
} catch (Throwable) { /* columnas aún no existen */ }

try {
    $chkOps2 = $pdo->prepare("SELECT eps, archivo_eps_id, archivo_eps_nombre, archivo_documento_id, archivo_documento_nombre, archivo_cuenta_id, archivo_cuenta_nombre FROM usuarios WHERE id = :id LIMIT 1");
    $chkOps2->execute([':id' => $usuarioId]);
    $exOps2 = $chkOps2->fetch();
    if ($exOps2 !== false) {
        $extra['eps'] = $exOps2['eps'] ?? null;
        $extra['archivoEpsId'] = $exOps2['archivo_eps_id'] ?? null;
        $extra['archivoEpsNombre'] = $exOps2['archivo_eps_nombre'] ?? null;
        $extra['archivoDocumentoId'] = $exOps2['archivo_documento_id'] ?? null;
        $extra['archivoDocumentoNombre'] = $exOps2['archivo_documento_nombre'] ?? null;
        $extra['archivoCuentaId'] = $exOps2['archivo_cuenta_id'] ?? null;
        $extra['archivoCuentaNombre'] = $exOps2['archivo_cuenta_nombre'] ?? null;
    }
} catch (Throwable) { /* columnas OPS aún no existen */ }

Response::json(array_merge(Shapes::usuario($updated), $extra));
