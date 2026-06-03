<?php
declare(strict_types=1);

// Creacion masiva de usuarios. Admin only.
// Espera body: { usuarios: [{ primerNombre, primerApellido, correo, rolId, areaId, ... }, ...] }

Auth::requireAdmin();

$body = Request::body();
$lista = isset($body['usuarios']) && is_array($body['usuarios']) ? $body['usuarios'] : [];

if (empty($lista)) Response::error('Lista de usuarios vacia', 400);
if (count($lista) > 200) Response::error('Maximo 200 usuarios por carga', 400);

$pdo = Db::pdo();
$resultados = [];
$creados = 0;
$errores = 0;

foreach ($lista as $idx => $u) {
    if (!is_array($u)) { $resultados[] = ['fila' => $idx + 1, 'ok' => false, 'error' => 'fila invalida']; $errores++; continue; }

    $primerNombre   = trim((string)($u['primerNombre'] ?? ''));
    $primerApellido = trim((string)($u['primerApellido'] ?? ''));
    $correo         = strtolower(trim((string)($u['correo'] ?? '')));
    $rolId          = (int)($u['rolId'] ?? 0);
    $areaId         = isset($u['areaId']) && $u['areaId'] !== '' ? (int)$u['areaId'] : null;

    if ($primerNombre === '' || $primerApellido === '' || $correo === '' || $rolId <= 0) {
        $resultados[] = ['fila' => $idx + 1, 'correo' => $correo, 'ok' => false, 'error' => 'Faltan campos obligatorios'];
        $errores++; continue;
    }
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        $resultados[] = ['fila' => $idx + 1, 'correo' => $correo, 'ok' => false, 'error' => 'Correo invalido'];
        $errores++; continue;
    }
    try {
        DomainPolicy::requireValid($correo);
    } catch (Throwable $e) {
        $resultados[] = ['fila' => $idx + 1, 'correo' => $correo, 'ok' => false, 'error' => 'Dominio no autorizado'];
        $errores++; continue;
    }

    $dup = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER(correo) = :c LIMIT 1");
    $dup->execute([':c' => $correo]);
    if ($dup->fetch()) {
        $resultados[] = ['fila' => $idx + 1, 'correo' => $correo, 'ok' => false, 'error' => 'Ya existe'];
        $errores++; continue;
    }

    $rolStmt = $pdo->prepare("SELECT id, nombre FROM roles WHERE id = :id LIMIT 1");
    $rolStmt->execute([':id' => $rolId]);
    $rol = $rolStmt->fetch();
    if (!$rol) {
        $resultados[] = ['fila' => $idx + 1, 'correo' => $correo, 'ok' => false, 'error' => 'Rol no existe'];
        $errores++; continue;
    }

    $segundoNombre = trim((string)($u['segundoNombre'] ?? '')) ?: null;
    $segundoApellido = trim((string)($u['segundoApellido'] ?? '')) ?: null;
    $tipoDocumento = strtoupper(trim((string)($u['tipoDocumento'] ?? 'CC')));
    $numeroDocumento = trim((string)($u['numeroDocumento'] ?? ''));
    $nombreCompleto = implode(' ', array_filter([$primerNombre, $segundoNombre, $primerApellido, $segundoApellido]));

    $tempPassword = bin2hex(random_bytes(6)) . '!Aa';
    $tempHash = password_hash($tempPassword, PASSWORD_BCRYPT, ['cost' => 12]);

    try {
        $ins = $pdo->prepare(
            "INSERT INTO usuarios
             (primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
              tipo_documento, numero_documento, nombre_completo, correo, area,
              permisos, password_hash, must_change_password, activo, rol_id, area_id, nivel_aprobacion)
             VALUES
             (:pn, :sn, :pa, :sa, :td, :nd, :nc, :co, :ar,
              '{}', :ph, 1, 1, :ri, :ai, NULL)"
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
            ':ar' => (string)$rol['nombre'],
            ':ph' => $tempHash,
            ':ri' => (int)$rol['id'],
            ':ai' => $areaId,
        ]);

        // Correo de bienvenida con credenciales
        $base = rtrim(Config::get('WEB_BASE_URL', 'https://payops.ipsgoleman.com'), '/');
        $loginLink = $base . '/login';
        try {
            Mailer::send([
                'to' => [$correo],
                'subject' => 'Bienvenido a Payops · Credenciales de acceso',
                'text' => "Hola {$nombreCompleto},\n\nTu cuenta en Payops fue creada.\n"
                    . "Correo: {$correo}\nContrasena temporal: {$tempPassword}\n\n"
                    . "Debes cambiar la contrasena en el primer ingreso: {$loginLink}",
            ]);
        } catch (Throwable $e) {
            error_log('[bulk_create email] ' . $e->getMessage());
        }

        $resultados[] = ['fila' => $idx + 1, 'correo' => $correo, 'ok' => true];
        $creados++;
    } catch (Throwable $e) {
        $resultados[] = ['fila' => $idx + 1, 'correo' => $correo, 'ok' => false, 'error' => 'Error al insertar'];
        error_log('[bulk_create insert] ' . $e->getMessage());
        $errores++;
    }
}

Response::json([
    'creados' => $creados,
    'errores' => $errores,
    'total'   => count($lista),
    'detalle' => $resultados,
]);
