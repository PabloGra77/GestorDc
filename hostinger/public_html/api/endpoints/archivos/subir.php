<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

$jwt = Auth::requireUser();

$maxBytes = 10 * 1024 * 1024; // 10 MB

if (empty($_FILES['archivo'])) {
    Response::error('No se recibio ningun archivo', 400);
}

$f = $_FILES['archivo'];
if (!is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $errores = [
        UPLOAD_ERR_INI_SIZE => 'El archivo excede el tamaño maximo del servidor',
        UPLOAD_ERR_FORM_SIZE => 'El archivo excede el tamaño maximo del formulario',
        UPLOAD_ERR_PARTIAL => 'El archivo se subio parcialmente',
        UPLOAD_ERR_NO_FILE => 'No se subio ningun archivo',
        UPLOAD_ERR_NO_TMP_DIR => 'No hay directorio temporal',
        UPLOAD_ERR_CANT_WRITE => 'No se pudo escribir el archivo',
        UPLOAD_ERR_EXTENSION => 'Una extension detuvo la subida',
    ];
    $codigo = $f['error'] ?? UPLOAD_ERR_NO_FILE;
    Response::error($errores[$codigo] ?? 'Error al subir el archivo', 400);
}

if (empty($f['size']) || $f['size'] > $maxBytes) {
    Response::error('El archivo esta vacio o supera el limite de 10 MB', 413);
}

$permitidos = [
    'application/pdf' => 'pdf',
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string)$finfo->file($f['tmp_name']);

if (!isset($permitidos[$mime])) {
    Response::error('Tipo de archivo no permitido. Solo PDF, JPG, PNG o WEBP.', 415);
}

$ext = $permitidos[$mime];

// Validar Magic Numbers para mayor seguridad
$contenido = file_get_contents($f['tmp_name'], false, null, 0, 16);
$magicNumbers = [
    'pdf' => '%PDF',
    'jpg' => "\xFF\xD8\xFF",
    'png' => "\x89\x50\x4E\x47",
    'webp' => 'RIFF',
];

$expectedMagic = $magicNumbers[$ext] ?? '';
if ($expectedMagic && strpos($contenido, $expectedMagic) !== 0) {
    Logger::warning('Magic number mismatch en archivo subido', [
        'expected' => $ext,
        'mime' => $mime,
        'user_id' => $jwt['sub'] ?? null
    ]);
    Response::error('El contenido del archivo no coincide con el tipo declarado', 415);
}

$dir = __DIR__ . '/../../uploads';
if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
    Response::error('No se pudo preparar el almacenamiento', 500);
}

$id = bin2hex(random_bytes(16)) . '.' . $ext;
$destino = $dir . '/' . $id;

if (!move_uploaded_file($f['tmp_name'], $destino)) {
    Logger::error('Error al mover archivo subido', [
        'tmp_name' => $f['tmp_name'],
        'destino' => $destino,
        'user_id' => $jwt['sub'] ?? null
    ]);
    Response::error('No se pudo guardar el archivo', 500);
}

@chmod($destino, 0644);

$nombre = basename((string)($f['name'] ?? 'archivo'));
$nombre = preg_replace('/[^\p{L}\p{N}.\-_ ]+/u', '', $nombre) ?: 'archivo';

Logger::info('Archivo subido exitosamente', [
    'file_id' => $id,
    'original_name' => $nombre,
    'size' => $f['size'],
    'mime' => $mime,
    'user_id' => $jwt['sub'] ?? null
]);

Response::json([
    'id' => $id,
    'nombre' => $nombre,
    'mime' => $mime,
    'size' => (int)$f['size'],
], 201);