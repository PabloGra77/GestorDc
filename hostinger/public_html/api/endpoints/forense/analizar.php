<?php
declare(strict_types=1);

// Verificación forense de un documento (factura/soporte) subido en base64.
// Requiere usuario autenticado (validadores/admin). No persiste el archivo.

Auth::requireUser();
Throttle::hit('forense:' . Throttle::clientIp(), 8, 60);

$body = Request::body();
$b64 = (string)($body['archivoBase64'] ?? '');
$nombre = trim((string)($body['nombre'] ?? 'documento'));

if ($b64 === '') Response::error('Falta el archivo a analizar', 400);

// Quitar prefijo data URL si viene incluido
if (strncmp($b64, 'data:', 5) === 0) {
    $coma = strpos($b64, ',');
    if ($coma !== false) $b64 = substr($b64, $coma + 1);
}
$bytes = base64_decode($b64, true);
if ($bytes === false || strlen($bytes) < 10) Response::error('Archivo inválido', 400);
if (strlen($bytes) > 10 * 1024 * 1024) Response::error('Archivo demasiado grande para análisis (máx 10 MB)', 413);

// Anti decompression-bomb: rechazar imágenes con demasiados megapíxeles antes de decodificar en GD
$info = @getimagesizefromstring($bytes);
if ($info !== false && isset($info[0], $info[1])) {
    if ((int)$info[0] * (int)$info[1] > 25_000_000) {
        Response::error('La imagen excede el tamaño permitido para análisis (máx 25 MP)', 413);
    }
}

$reporte = Forense::analizar($bytes, $nombre);
Response::json($reporte);
