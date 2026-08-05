<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('verLotes');

$limite = min(200, max(1, (int) (Request::query('limite') ?? '50')));
$lotes = PagosLote::listar($limite);

Response::json(array_map(static fn($l) => [
    'id'             => (int) $l['id'],
    'referencia'     => $l['referencia'],
    'empresaNombre'  => $l['empresa_nombre'],
    'autor'          => $l['autor'],
    'descripcion'    => $l['descripcion'],
    'fechaProceso'   => $l['fecha_proceso'],
    'estado'         => $l['estado'],
    'cantidadPagos'  => (int) $l['cantidad_pagos'],
    'valorTotal'     => $l['valor_total'],
    'generadoEn'     => $l['generado_en'],
    'vecesReabierto' => (int) $l['veces_reabierto'],
    'creadoEn'       => $l['creado_en'],
], $lotes));
