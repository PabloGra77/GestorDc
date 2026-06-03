<?php
/**
 * Crea (o resetea) el usuario administrador.
 *
 * Uso (por SSH, fuera de public_html):
 *   php seed-admin.php correo@dominio.com 'PasswordSegura!'
 *
 * El password se asigna como definitivo (must_change_password=0).
 * Si el correo existe, actualiza su hash en lugar de duplicar.
 *
 * Lee credenciales DB desde el .env de public_html/api.
 */
declare(strict_types=1);

if ($argc < 3) {
    fwrite(STDERR, "Uso: php seed-admin.php correo password\n");
    exit(1);
}

[$_, $correo, $password] = $argv;
$correo = strtolower(trim($correo));
if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Correo invalido\n");
    exit(1);
}
if (!str_ends_with($correo, '@ipsgoleman.com.co')) {
    fwrite(STDERR, "El admin debe pertenecer al dominio @ipsgoleman.com.co\n");
    exit(1);
}
if (strlen($password) < 10) {
    fwrite(STDERR, "Password muy corto (minimo 10)\n");
    exit(1);
}

// Buscar .env: prueba varias ubicaciones tipicas de Hostinger
$envCandidates = [
    __DIR__ . '/../public_html/api/.env',
    dirname(__DIR__) . '/public_html/api/.env',
];
foreach (glob('/home/*/websites/*/public_html/api/.env') ?: [] as $p) {
    $envCandidates[] = $p;
}
// Permitir override via env var GD_ENV_PATH
if ($envOverride = getenv('GD_ENV_PATH')) {
    array_unshift($envCandidates, $envOverride);
}
$envPath = null;
foreach ($envCandidates as $p) {
    if (is_readable($p)) { $envPath = $p; break; }
}
if (!$envPath) {
    fwrite(STDERR, "No se encuentra .env en: " . implode(', ', $envCandidates) . "\n");
    exit(2);
}

$env = [];
foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#') continue;
    $eq = strpos($line, '=');
    if ($eq === false) continue;
    $k = trim(substr($line, 0, $eq));
    $v = trim(substr($line, $eq + 1));
    if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && $v[strlen($v)-1] === $v[0]) {
        $v = substr($v, 1, -1);
    }
    $env[$k] = $v;
}

$dsn = sprintf(
    "mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4",
    $env['DB_HOST'] ?? 'localhost',
    $env['DB_PORT'] ?? '3306',
    $env['DB_NAME'] ?? ''
);

try {
    $pdo = new PDO($dsn, $env['DB_USER'] ?? '', $env['DB_PASSWORD'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (Throwable $e) {
    fwrite(STDERR, "Conexion DB fallo: " . $e->getMessage() . "\n");
    exit(3);
}

// Buscar rol Administrador
$st = $pdo->query("SELECT id FROM roles WHERE LOWER(nombre) = 'administrador' LIMIT 1");
$rolId = $st->fetchColumn();
if (!$rolId) {
    fwrite(STDERR, "No existe rol 'Administrador'. Ejecuta primero schema.sql\n");
    exit(4);
}

$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$check = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER(correo) = :c LIMIT 1");
$check->execute([':c' => $correo]);
$existing = $check->fetchColumn();

if ($existing) {
    $upd = $pdo->prepare(
        "UPDATE usuarios SET password_hash = :p, must_change_password = 0,
           rol_id = :r, activo = 1
         WHERE id = :id"
    );
    $upd->execute([':p' => $hash, ':r' => (int)$rolId, ':id' => (int)$existing]);
    fwrite(STDOUT, "Password del admin {$correo} actualizado (id={$existing})\n");
} else {
    $ins = $pdo->prepare(
        "INSERT INTO usuarios
         (primer_nombre, primer_apellido, tipo_documento, numero_documento,
          nombre_completo, correo, area, permisos, password_hash,
          must_change_password, activo, rol_id)
         VALUES
         ('Admin','Sistema','CC','0000000','Admin Sistema',
          :c, 'Administracion', JSON_OBJECT(), :p, 0, 1, :r)"
    );
    $ins->execute([':c' => $correo, ':p' => $hash, ':r' => (int)$rolId]);
    fwrite(STDOUT, "Admin {$correo} creado (id={$pdo->lastInsertId()})\n");
}

fwrite(STDOUT, "Listo. Inicia sesion con ese correo y password.\n");
