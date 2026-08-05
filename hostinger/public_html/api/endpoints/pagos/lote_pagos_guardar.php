<?php
declare(strict_types=1);

Auth::requireUser();

$id = (int) ($params['id'] ?? 0);
$lote = PagosLote::obtener($id);
if (!$lote) {
    Response::error('El lote no existe', 404);
}
if (!PagosLote::puedeEditar($lote)) {
    Response::error('No puede editar este lote', 403);
}

$body = Request::body();
$pagos = $body['pagos'] ?? null;
if (!is_array($pagos)) {
    Response::error('Falta la lista de pagos', 400);
}

try {
    PagosLote::guardarPagos($id, $pagos);
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
}

if ($lote['estado'] === 'validado') {
    PagosLote::cambiarEstado($id, 'borrador');
}
PagosAudit::registrar('lote.pagos_guardados', 'lote', (string) $id, ['cantidad' => count($pagos)]);

Response::json(['ok' => true]);
