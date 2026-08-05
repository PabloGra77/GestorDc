<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('anularLotes');

$id = (int) ($params['id'] ?? 0);
$body = Request::body();
$motivo = trim((string) ($body['motivo'] ?? ''));

$resultado = PagosLote::anular($id, $motivo);
if (!$resultado['ok']) {
    Response::error($resultado['mensaje'], 422);
}

Response::json($resultado);
