<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('crearLotes');

$id = (int) ($params['id'] ?? 0);
$lote = PagosLote::obtener($id);
if (!$lote) {
    Response::error('El lote no existe', 404);
}
if (!PagosLote::puedeEditar($lote)) {
    Response::error('No puede editar este lote', 403);
}

if (empty($_FILES['archivo']) || ($_FILES['archivo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    Response::error('No se recibió ningún archivo', 400);
}

$f = $_FILES['archivo'];
$maxBytes = 10 * 1024 * 1024;
if (empty($f['size']) || $f['size'] > $maxBytes) {
    Response::error('El archivo está vacío o supera el límite de 10 MB', 413);
}

$nombreOriginal = basename((string) ($f['name'] ?? 'archivo'));
$lectura = PagosImportador::leerArchivo($f['tmp_name'], $nombreOriginal);
if (!$lectura['ok']) {
    Response::error($lectura['mensaje'], 422);
}

$resultado = PagosImportador::interpretar($lectura['filas']);
if (!$resultado['ok']) {
    Response::error($resultado['mensaje'], 422);
}

PagosAudit::registrar('lote.importado', 'lote', (string) $id, [
    'archivo' => $nombreOriginal, 'filas' => $resultado['filas_leidas'],
]);

// No se persiste todavía: el analista revisa la previsualización y confirma
// con PUT /pagos/lotes/{id}/pagos.
Response::json([
    'pagos'            => $resultado['pagos'],
    'hallazgos'        => $resultado['hallazgos'],
    'filasLeidas'      => $resultado['filas_leidas'],
    'celdasLimpiadas'  => $resultado['celdas_limpiadas'],
]);
