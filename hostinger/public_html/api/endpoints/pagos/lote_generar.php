<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('generarArchivo');

$id = (int) ($params['id'] ?? 0);
$lote = PagosLote::obtener($id);
if (!$lote || !PagosLote::puedeVer($lote)) {
    Response::error('El lote no existe o no tiene acceso a él', 404);
}

$maxLenCuenta = (int) Config::get('PAGOS_MAX_LEN_CUENTA', '17');
$resultado = PagosLote::generarArchivo($id, $maxLenCuenta);

if (!$resultado['ok']) {
    Response::error($resultado['mensaje'], 422);
}

Response::json([
    'ok'      => true,
    'mensaje' => $resultado['mensaje'],
    'nombre'  => $resultado['nombre'],
]);
