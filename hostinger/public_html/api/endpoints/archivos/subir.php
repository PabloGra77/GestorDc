<?php
declare(strict_types=1);

// Subida de un adjunto (PDF/imagen). Requiere usuario autenticado.
// Guarda el archivo con un nombre aleatorio en api/uploads (protegido por .htaccess)
// y devuelve un id opaco que luego se sirve por archivos/ver con verificación de sesión.
Auth::requireUser();
Throttle::hit('upload:' . Throttle::clientIp(), 40, 60);

if (empty($_FILES['archivo']) || !is_array($_FILES['archivo'])) {
    Response::error('No se recibió ningún archivo', 400);
}
$f = $_FILES['archivo'];
if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    Response::error('El archivo no se pudo subir', 400);
}

$maxBytes = 10 * 1024 * 1024; // 10 MB
if ((int)$f['size'] <= 0 || (int)$f['size'] > $maxBytes) {
    Response::error('El archivo está vacío o supera el límite de 10 MB', 413);
}

$permitidos = [
    'application/pdf' => 'pdf',
    'image/jpeg'      => 'jpg',
    'image/png'       => 'png',
    'image/webp'      => 'webp',
];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string)$finfo->file($f['tmp_name']);
if (!isset($permitidos[$mime])) {
    Response::error('Tipo de archivo no permitido. Solo PDF, JPG, PNG o WEBP.', 415);
}
$ext = $permitidos[$mime];

$dir = __DIR__ . '/../../uploads';
if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
    Response::error('No se pudo preparar el almacenamiento', 500);
}

$id = bin2hex(random_bytes(16)) . '.' . $ext;
$destino = $dir . '/' . $id;
if (!move_uploaded_file($f['tmp_name'], $destino)) {
    Response::error('No se pudo guardar el archivo', 500);
}
@chmod($destino, 0644);

// Nombre original solo para mostrar (saneado, sin rutas)
$nombre = basename((string)($f['name'] ?? 'archivo'));
$nombre = preg_replace('/[^\p{L}\p{N}.\-_ ]+/u', '', $nombre) ?: 'archivo';

Response::json([
    'id'     => $id,
    'nombre' => $nombre,
    'mime'   => $mime,
    'size'   => (int)$f['size'],
], 201);
