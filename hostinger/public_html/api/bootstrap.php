<?php
declare(strict_types=1);

// Bloquear acceso web directo — solo puede ser incluido por index.php
if (!defined('PAYOPS_BOOTSTRAP')) {
    http_response_code(403);
    exit;
}

// Sin exponer errores al usuario, todo a log
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
ini_set('expose_php', '0');
error_reporting(E_ALL);

date_default_timezone_set('UTC');

// Headers de seguridad a nivel PHP (refuerzan los del .htaccess)
header_remove('X-Powered-By');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 0');
header('Referrer-Policy: no-referrer');

require_once __DIR__ . '/lib/config.php';
require_once __DIR__ . '/lib/logger.php';
require_once __DIR__ . '/lib/response.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/settings.php';
require_once __DIR__ . '/lib/jwt.php';
require_once __DIR__ . '/lib/mailer.php';
require_once __DIR__ . '/lib/permissions.php';
require_once __DIR__ . '/lib/throttle.php';
require_once __DIR__ . '/lib/shapes.php';
require_once __DIR__ . '/lib/domain.php';
require_once __DIR__ . '/lib/forense.php';
require_once __DIR__ . '/lib/auditoria.php';

try {
    Config::load(__DIR__ . '/.env');
} catch (Throwable $e) {
    error_log('[gestordoc] config: ' . $e->getMessage());
    Response::error('Servicio no configurado', 500);
}

// Politica CORS: solo el mismo origen del WEB_BASE_URL (no permite cualquier dominio)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedBase = rtrim((string)Config::get('WEB_BASE_URL', ''), '/');
$allowed = ($allowedBase !== '' && rtrim($origin, '/') === $allowedBase);

if ($allowed) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 600');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

set_exception_handler(function (Throwable $e): void {
    error_log('[gestordoc] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::error('Error interno del servidor', 500);
});

set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) return false;
    error_log("[gestordoc][php] {$message} @ {$file}:{$line}");
    return true;
});
