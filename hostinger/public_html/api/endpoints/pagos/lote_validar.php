<?php
declare(strict_types=1);

Auth::requireUser();

$id = (int) ($params['id'] ?? 0);
$lote = PagosLote::obtener($id);
if (!$lote || !PagosLote::puedeVer($lote)) {
    Response::error('El lote no existe o no tiene acceso a él', 404);
}

$pagos = PagosLote::pagos($id);
$validador = new PagosValidador((int) Config::get('PAGOS_MAX_LEN_CUENTA', '17'));
$hallazgos = $validador->validarLote($lote, $pagos);

if (PagosValidador::esValido($hallazgos)) {
    PagosLote::cambiarEstado($id, 'validado');
}

Response::json([
    'valido'    => PagosValidador::esValido($hallazgos),
    'errores'   => PagosValidador::errores($hallazgos),
    'avisos'    => PagosValidador::avisos($hallazgos),
    'porCelda'  => PagosValidador::porCelda($hallazgos),
]);
