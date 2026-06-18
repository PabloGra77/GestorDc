<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

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
               u.must_change_password, u.permisos, u.rol_id,
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
    Response::error('Credenciales invalidas', 401);
}

// Generar token con expiración de 1 hora
// Usamos la clase Jwt si existe, si no, lo generamos manual para evitar fallos en cascada
if (class_exists('Jwt')) {
    $token = Jwt::sign([
        'sub' => (int)$row['id'],
        'correo' => $row['correo'],
        'iat' => time(),
        'exp' => time() + 3600,
    ]);
} else {
    // Fallback manual por si Jwt falla
    $secret = 'clave_secreta_temporal_12345'; 
    $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
    $payload = json_encode(['sub' => (int)$row['id'], 'correo' => $row['correo'], 'iat' => time(), 'exp' => time() + 3600]);
    $b64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $b64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    $signature = hash_hmac('sha256', $b64Header . "." . $b64Payload, $secret, true);
    $b64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    $token = $b64Header . "." . $b64Payload . "." . $b64Signature;
}

Response::json([
    'token' => $token,
    'expires_in' => 3600,
    'usuario' => [
        'id' => (int)$row['id'],
        'nombreCompleto' => $row['nombre_completo'],
        'correo' => $row['correo'],
        'activo' => (bool)$row['activo'],
        'debeCambiarPassword' => (bool)$row['must_change_password'],
        'permisos' => json_decode($row['permisos'] ?: '{}', true) ?: new stdClass(),
        'rol' => [
            'id' => (int)$row['r_id'],
            'nombre' => $row['r_nombre'],
            'descripcion' => $row['r_desc'],
            'activo' => (bool)$row['r_activo'],
            'permisos' => json_decode($row['r_permisos'] ?: '{}', true) ?: new stdClass(),
        ],
    ],
]);