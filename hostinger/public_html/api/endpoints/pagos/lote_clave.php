<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('generarArchivo');

$id = (int) ($params['id'] ?? 0);
$lote = PagosLote::obtener($id);
if (!$lote || !PagosLote::puedeVer($lote)) {
    Response::error('El lote no existe o no tiene acceso a él', 404);
}

$claveMaestra = Config::get('PAGOS_CLAVE_MAESTRA', '');
if (!$claveMaestra) {
    Response::error('El servidor no tiene configurada PAGOS_CLAVE_MAESTRA en .env', 500);
}

$clave = PagosLote::claveZip($id, $claveMaestra);
if ($clave === null) {
    Response::error('Este lote no tiene un ZIP empaquetado', 404);
}

PagosAudit::registrar('lote.clave_consultada', 'lote', (string) $id);

Response::json(['clave' => $clave]);
