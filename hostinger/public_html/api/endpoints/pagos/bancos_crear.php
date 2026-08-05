<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('gestionarConfiguracion');

$body = Request::body();
$resultado = PagosBancos::registrarManual(
    (string) ($body['codigo'] ?? ''),
    (string) ($body['nombre'] ?? '')
);

if (!$resultado['ok']) {
    Response::error($resultado['mensaje'], 422);
}

Response::json($resultado, 201);
