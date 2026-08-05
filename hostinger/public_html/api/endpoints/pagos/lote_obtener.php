<?php
declare(strict_types=1);

Auth::requireUser();

$id = (int) ($params['id'] ?? 0);
$lote = PagosLote::obtener($id);
if (!$lote || !PagosLote::puedeVer($lote)) {
    Response::error('El lote no existe o no tiene acceso a él', 404);
}

$pagos = PagosLote::pagos($id);

Response::json([
    'id'               => (int) $lote['id'],
    'referencia'       => $lote['referencia'],
    'empresaId'        => (int) $lote['empresa_id'],
    'empresaNombre'    => $lote['empresa_nombre'],
    'usuarioId'        => (int) $lote['usuario_id'],
    'autor'            => $lote['autor'],
    'descripcion'      => $lote['descripcion'],
    'fechaProceso'     => $lote['fecha_proceso'],
    'estado'           => $lote['estado'],
    'cantidadPagos'    => (int) $lote['cantidad_pagos'],
    'valorTotal'       => $lote['valor_total'],
    'archivoNombre'    => $lote['archivo_nombre'],
    'archivoNombreCsv' => $lote['archivo_nombre_csv'],
    'archivoZipNombre' => $lote['archivo_zip_nombre'],
    'generadoEn'       => $lote['generado_en'],
    'vecesReabierto'   => (int) $lote['veces_reabierto'],
    'puedeEditar'      => PagosLote::puedeEditar($lote),
    'puedeReabrir'     => PagosLote::puedeReabrir($lote),
    'pagos'            => array_map(static fn($p) => [
        'orden'              => (int) $p['orden'],
        'filaOrigen'         => $p['fila_origen'] !== null ? (int) $p['fila_origen'] : null,
        'identificacion'     => $p['identificacion'],
        'tipoIdentificacion' => $p['tipo_identificacion'],
        'productoDestino'    => $p['producto_destino'],
        'tipoProducto'       => $p['tipo_producto'],
        'codigoBanco'        => $p['codigo_banco'],
        'valor'              => $p['valor'],
        'beneficiario'       => $p['beneficiario'],
        'bancoManual'        => (bool) $p['banco_manual'],
    ], $pagos),
]);
