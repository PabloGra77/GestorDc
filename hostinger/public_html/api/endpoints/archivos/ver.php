<?php
declare(strict_types=1);

// Sirve un adjunto previamente subido. Requiere sesión (cualquier usuario del sistema).
// El id es aleatorio e inadivinable; se valida su forma para evitar path traversal.
Auth::requireUser();

$id = (string)($_GET['id'] ?? '');
if (!preg_match('/^[a-f0-9]{32}\.(pdf|jpg|png|webp)$/', $id)) {
    Response::error('Identificador inválido', 400);
}

$path = __DIR__ . '/../../uploads/' . $id;
if (!is_file($path)) {
    Response::error('Archivo no encontrado', 404);
}

$mimes = [
    'pdf'  => 'application/pdf',
    'jpg'  => 'image/jpeg',
    'png'  => 'image/png',
    'webp' => 'image/webp',
];
$ext = strtolower((string)pathinfo($id, PATHINFO_EXTENSION));

header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($path));
header('Content-Disposition: inline; filename="adjunto.' . $ext . '"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=300');
readfile($path);
exit;
