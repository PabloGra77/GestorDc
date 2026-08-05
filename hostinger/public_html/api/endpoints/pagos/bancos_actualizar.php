<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('gestionarConfiguracion');

$codigo = (int) ($params['codigo'] ?? 0);
if (!PagosBancos::existe($codigo)) {
    Response::error('La entidad no existe', 404);
}

$body = Request::body();
if (!array_key_exists('activo', $body)) {
    Response::error('Falta el campo activo', 400);
}

PagosBancos::cambiarEstado($codigo, (bool) $body['activo']);

Response::json(['ok' => true]);
