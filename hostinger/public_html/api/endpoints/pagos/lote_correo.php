<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('generarArchivo');

$id = (int) ($params['id'] ?? 0);
$lote = PagosLote::obtener($id);
if (!$lote || !PagosLote::puedeVer($lote)) {
    Response::error('El lote no existe o no tiene acceso a él', 404);
}
if ($lote['estado'] !== 'generado') {
    Response::error('Primero genere el archivo del lote', 422);
}

$claveMaestra = Config::get('PAGOS_CLAVE_MAESTRA', '');
$clave = $claveMaestra ? PagosLote::claveZip($id, $claveMaestra) : null;
if ($clave === null) {
    Response::error('Este lote todavía no tiene un ZIP empaquetado', 422);
}

$body = Request::body();
$para = trim((string) ($body['para'] ?? ''));
$cc = trim((string) ($body['cc'] ?? ''));
$asunto = trim((string) ($body['asunto'] ?? '')) ?: ('Portal de Pagos — lote ' . $lote['referencia']);
$cuerpo = trim((string) ($body['cuerpo'] ?? '')) ?: PagosCorreo::cuerpoPredeterminado($lote, $clave);

if ($para === '' || !filter_var($para, FILTER_VALIDATE_EMAIL)) {
    Response::error('El destinatario no tiene un correo válido', 400);
}

$stmt = Db::pdo()->prepare('SELECT nombre_completo, correo FROM usuarios WHERE id = ?');
$stmt->execute([PagosAuth::id()]);
$usuario = $stmt->fetch();

$rutaZip = PagosLote::storageDir() . '/' . $id . '.zip';
$rutaCsv = PagosLote::storageDir() . '/' . $id . '.csv';
if (!is_file($rutaZip) || !is_file($rutaCsv)) {
    Response::error('Faltan los archivos generados de este lote', 422);
}

$eml = PagosCorreo::construirEml(
    ['nombre' => (string) ($usuario['nombre_completo'] ?? ''), 'email' => (string) ($usuario['correo'] ?? '')],
    $para,
    $cc,
    $asunto,
    $cuerpo,
    [
        ['nombre' => $lote['archivo_zip_nombre'] ?: 'ArchivoPagos.zip', 'contenido' => (string) file_get_contents($rutaZip), 'tipoMime' => 'application/zip'],
        ['nombre' => $lote['archivo_nombre_csv'] ?: 'ArchivoPagos.csv', 'contenido' => (string) file_get_contents($rutaCsv), 'tipoMime' => 'text/csv'],
    ]
);

PagosAudit::registrar('lote.correo_generado', 'lote', (string) $id, ['para' => $para]);

header('Content-Type: message/rfc822');
header('Content-Length: ' . strlen($eml));
header('Content-Disposition: attachment; filename="PortalPagos-' . $lote['referencia'] . '.eml"');
header('X-Content-Type-Options: nosniff');
echo $eml;
exit;
