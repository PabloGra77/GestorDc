<?php
declare(strict_types=1);

Auth::requireUser();

$id = (int) ($params['id'] ?? 0);
$lote = PagosLote::obtener($id);
if (!$lote || !PagosLote::puedeVer($lote)) {
    Response::error('El lote no existe o no tiene acceso a él', 404);
}

$tipo = (string) (Request::query('tipo') ?? '');
$permitidos = [
    'txt' => ['mime' => 'text/plain; charset=utf-8',     'nombre' => $lote['archivo_nombre'] ?: 'ArchivoPagos.txt'],
    'csv' => ['mime' => 'text/csv; charset=utf-8',        'nombre' => $lote['archivo_nombre_csv'] ?: 'ArchivoPagos.csv'],
    'zip' => ['mime' => 'application/zip',                'nombre' => $lote['archivo_zip_nombre'] ?: 'ArchivoPagos.zip'],
];
if (!isset($permitidos[$tipo])) {
    Response::error('Tipo de archivo no válido. Use txt, csv o zip.', 400);
}

$ruta = PagosLote::storageDir() . '/' . $id . '.' . $tipo;
$realPath = realpath($ruta);
$storageDir = realpath(PagosLote::storageDir());
if (!$realPath || !$storageDir || strpos($realPath, $storageDir) !== 0 || !is_file($realPath)) {
    Response::error('El archivo aún no ha sido generado', 404);
}

PagosAudit::registrar('lote.descargado', 'lote', (string) $id, ['tipo' => $tipo]);

header('Content-Type: ' . $permitidos[$tipo]['mime']);
header('Content-Length: ' . filesize($realPath));
header('Content-Disposition: attachment; filename="' . $permitidos[$tipo]['nombre'] . '"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');
readfile($realPath);
exit;
