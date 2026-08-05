<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerirAlguno(['verLotes', 'crearLotes', 'gestionarConfiguracion']);

$soloActivos = Request::query('todos') !== '1';
$bancos = PagosBancos::todos($soloActivos);

Response::json(array_map(static fn($b) => [
    'codigo'  => $b['codigo'],
    'nombre'  => $b['nombre'],
    'oficial' => $b['oficial'],
    'activo'  => $b['activo'],
], array_values($bancos)));
