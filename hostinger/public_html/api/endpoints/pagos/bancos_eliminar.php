<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('gestionarConfiguracion');

$codigo = (int) ($params['codigo'] ?? 0);
$resultado = PagosBancos::eliminarManual($codigo);

if (!$resultado['ok']) {
    Response::error($resultado['mensaje'], 409);
}

Response::json($resultado);
