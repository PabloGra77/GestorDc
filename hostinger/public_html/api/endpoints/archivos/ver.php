<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

$jwt = Auth::requireUser();

$id = Request::query('id');
if (!$id) {
    Response::error('ID de archivo requerido', 400);
}

// Validar formato estricto del ID (solo hex + extensión permitida)
if (!preg_match('/^[a-f0-9]{32}\.(pdf|jpg|png|webp)$/i', $id)) {
    Response::error('ID de archivo invalido', 400);
}

// Sanitizar para prevenir Path Traversal
$id = basename($id);
$path = __DIR__ . '/../../uploads/' . $id;

// Verificar que el path resuelto está DENTRO del directorio uploads
$realPath = realpath($path);
$uploadsDir = realpath(__DIR__ . '/../../uploads');

if (!$realPath || !$uploadsDir || strpos($realPath, $uploadsDir) !== 0) {
    Response::error('Archivo no encontrado', 404);
}

if (!is_file($realPath) || !is_readable($realPath)) {
    Response::error('Archivo no disponible', 404);
}

$mimes = [
    'pdf' => 'application/pdf',
    'jpg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
];

$ext = strtolower((string)pathinfo($id, PATHINFO_EXTENSION));
$mimeType = $mimes[$ext] ?? 'application/octet-stream';

// Verificar que el MIME real coincide con la extensión
$finfo = new finfo(FILEINFO_MIME_TYPE);
$realMime = $finfo->file($realPath);
if ($realMime !== $mimeType) {
    Logger::warning('MIME type mismatch en archivo', [
        'file_id' => $id,
        'expected' => $mimeType,
        'actual' => $realMime,
        'user_id' => $jwt['sub'] ?? null
    ]);
    Response::error('Tipo de archivo invalido', 415);
}

// Headers de seguridad
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . filesize($realPath));
header('Content-Disposition: inline; filename="adjunto.' . $ext . '"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=300');
header('X-Frame-Options: SAMEORIGIN');

readfile($realPath);
exit;