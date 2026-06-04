<?php
declare(strict_types=1);

// Verificación forense de un documento (factura/soporte) subido en base64.
// Requiere usuario autenticado (validadores/admin). No persiste el archivo.

Auth::requireUser();
Throttle::hit('forense:' . Throttle::clientIp(), 30, 60);

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

$reporte = Forense::analizar($bytes, $nombre);
Response::json($reporte);
