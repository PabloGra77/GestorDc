<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

Throttle::hit('login:' . Throttle::clientIp(), 5, 60);
Throttle::hit('login-hour:' . Throttle::clientIp(), 20, 3600);

$data = Request::body();
$correo = trim((string)($data['correo'] ?? ''));
$password = (string)($data['password'] ?? '');

if (!$correo || !$password) {
    Response::error('Correo y contraseña son obligatorios', 400);
}

if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    Response::error('Formato de correo invalido', 400);
}

$pdo = Db::pdo();
$sql = "SELECT u.id, u.nombre_completo, u.correo, u.activo, u.password_hash,
               u.must_change_password, u.permisos, u.rol_id, u.area_id,
               r.id AS r_id, r.nombre AS r_nombre, r.descripcion AS r_desc,
               r.activo AS r_activo, r.permisos AS r_permisos
        FROM usuarios u
        INNER JOIN roles r ON r.id = u.rol_id
        WHERE u.correo = :correo
        LIMIT 1";

$stmt = $pdo->prepare($sql);
$stmt->execute([':correo' => $correo]);
$row = $stmt->fetch();

// Hash dummy para prevenir ataques de tiempo (Timing Attack)
$DUMMY_HASH = '$2y$12$GuJAIgi8SGWHyjXOdpYZI.nSJldVeE8G0ijdlcM4Nr.A7P4SBZl4G';
$hashAComparar = ($row && (int)$row['activo'] === 1 && !empty($row['password_hash']))
    ? (string)$row['password_hash']
    : $DUMMY_HASH;

$passwordOk = password_verify($password, $hashAComparar);

if (!$row || (int)$row['activo'] !== 1 || empty($row['password_hash']) || !$passwordOk) {
    Auditoria::registrar(
        'login_fallido',
        'Intento de inicio de sesión fallido para: ' . $correo,
        false,
        null,
        $correo
    );
    Response::error('Credenciales invalidas', 401);
}

// Generar token con expiración de 1 hora.
// Jwt::sign() ya lanza RuntimeException si JWT_ACCESS_SECRET no esta configurado,
// asi que el login falla de forma segura en vez de caer a un secreto hardcodeado.
$token = Jwt::sign([
    'sub' => (int)$row['id'],
    'correo' => $row['correo'],
    'iat' => time(),
    'exp' => time() + 3600,
]);

Auditoria::registrar(
    'login_exitoso',
    'Inicio de sesión exitoso',
    true,
    (int)$row['id'],
    $row['correo'],
    $row['nombre_completo']
);

// Emitir cookie HttpOnly (inaccesible desde JavaScript)
$secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
setcookie('payops_token', $token, [
    'expires'  => time() + 3600,
    'path'     => '/',
    'secure'   => $secure,
    'httponly' => true,
    'samesite' => 'Strict',
]);

Response::json([
    'expires_in' => 3600,
    'usuario' => [
        'id' => (int)$row['id'],
        'nombreCompleto' => $row['nombre_completo'],
        'correo' => $row['correo'],
        'activo' => (bool)$row['activo'],
        'debeCambiarPassword' => (bool)$row['must_change_password'],
        'permisos' => json_decode($row['permisos'] ?: '{}', true) ?: new stdClass(),
        'areaId' => $row['area_id'] !== null ? (int)$row['area_id'] : null,
        'rol' => [
            'id' => (int)$row['r_id'],
            'nombre' => $row['r_nombre'],
            'descripcion' => $row['r_desc'],
            'activo' => (bool)$row['r_activo'],
            'permisos' => json_decode($row['r_permisos'] ?: '{}', true) ?: new stdClass(),
        ],
    ],
]);