<?php
declare(strict_types=1);

// Eliminar el lote por completo (no solo anular) es irreversible: solo admin.
Auth::requireAdmin();

$id = (int) ($params['id'] ?? 0);
$body = Request::body();
$motivo = trim((string) ($body['motivo'] ?? ''));

$resultado = PagosLote::eliminar($id, $motivo);
if (!$resultado['ok']) {
    Response::error($resultado['mensaje'], 422);
}

Response::json($resultado);
