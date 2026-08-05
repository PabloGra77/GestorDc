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
if (!$claveMaestra || strlen($claveMaestra) < 64) {
    Response::error(
        'El servidor no tiene configurada PAGOS_CLAVE_MAESTRA en .env (genérela con: '
        . 'php -r "echo bin2hex(random_bytes(32));"). Sin ella no se puede cifrar el ZIP.',
        500
    );
}

$resultado = PagosLote::empaquetar($id, $claveMaestra);
if (!$resultado['ok']) {
    Response::error($resultado['mensaje'], 422);
}

Response::json([
    'ok'      => true,
    'mensaje' => $resultado['mensaje'],
    'clave'   => $resultado['clave'],
    'nombre'  => $resultado['nombre'],
]);
