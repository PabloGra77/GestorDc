<?php
declare(strict_types=1);

Throttle::hit('login:' . Throttle::clientIp(), 10, 60);

$body = Request::body();
$correo = strtolower(trim((string)($body['correo'] ?? '')));
$password = (string)($body['password'] ?? '');

if ($correo === '' || $password === '') {
    Response::error('Correo y password son obligatorios', 400);
}
DomainPolicy::requireValid($correo);

$pdo = Db::pdo();
$sql = "SELECT u.id, u.nombre_completo, u.correo, u.activo, u.must_change_password,
               u.permisos, u.password_hash, u.rol_id,
               r.id AS r_id, r.nombre AS r_nombre, r.descripcion AS r_desc,
               r.activo AS r_activo, r.permisos AS r_permisos
        FROM usuarios u
        INNER JOIN roles r ON r.id = u.rol_id
        WHERE LOWER(u.correo) = :correo
        LIMIT 1";
$stmt = $pdo->prepare($sql);
$stmt->execute([':correo' => $correo]);
$row = $stmt->fetch();

// Hash dummy fijo para igualar tiempo cuando el usuario no existe / cuenta inactiva.
// Asi password_verify se ejecuta siempre y se elimina la enumeracion por timing.
$DUMMY_HASH = '$2y$12$GuJAIgi8SGWHyjXOdpYZI.nSJldVeE8G0ijdlcM4Nr.A7P4SBZl4G';
$hashAComparar = ($row && (int)$row['activo'] === 1 && !empty($row['password_hash']))
    ? (string)$row['password_hash']
    : $DUMMY_HASH;
$passwordOk = password_verify($password, $hashAComparar);
if (!$row || (int)$row['activo'] !== 1 || empty($row['password_hash']) || !$passwordOk) {
    Response::error('Credenciales invalidas', 401);
}

$token = Jwt::sign([
    'sub'    => (int)$row['id'],
    'correo' => $row['correo'],
]);

Response::json([
    'token'   => $token,
    'usuario' => [
        'id'                  => (int)$row['id'],
        'nombreCompleto'      => $row['nombre_completo'],
        'correo'              => $row['correo'],
        'activo'              => (bool)$row['activo'],
        'debeCambiarPassword' => (bool)$row['must_change_password'],
        'permisos'            => json_decode($row['permisos'] ?: '{}', true) ?: new stdClass(),
        'rol' => [
            'id'          => (int)$row['r_id'],
            'nombre'      => $row['r_nombre'],
            'descripcion' => $row['r_desc'],
            'activo'      => (bool)$row['r_activo'],
            'permisos'    => json_decode($row['r_permisos'] ?: '{}', true) ?: new stdClass(),
        ],
    ],
]);
