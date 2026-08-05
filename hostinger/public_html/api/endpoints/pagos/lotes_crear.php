<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('crearLotes');

$body = Request::body();
$empresaId = (int) ($body['empresaId'] ?? 0);
$descripcion = (string) ($body['descripcion'] ?? '');
$fecha = (string) ($body['fechaProceso'] ?? '');

if ($empresaId <= 0) {
    Response::error('Seleccione la empresa ordenante', 400);
}
$empresa = PagosDb::uno('SELECT id, activa FROM pagos_empresas WHERE id = ?', [$empresaId]);
if (!$empresa || !$empresa['activa']) {
    Response::error('La empresa seleccionada no existe o está inactiva', 400);
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) || strtotime($fecha) === false) {
    Response::error('La fecha de proceso no es válida (use AAAA-MM-DD)', 400);
}

$id = PagosLote::crear($empresaId, $descripcion, $fecha);

Response::json(['id' => $id], 201);
