<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerirAlguno(['verLotes', 'crearLotes', 'gestionarConfiguracion']);

$filas = PagosDb::todos('SELECT * FROM pagos_empresas ORDER BY nombre ASC');

Response::json(array_map(static fn($e) => [
    'id'                 => (int) $e['id'],
    'nombre'             => $e['nombre'],
    'identificacion'     => $e['identificacion'],
    'tipoIdentificacion' => $e['tipo_identificacion'],
    'cuentaOrigen'       => $e['cuenta_origen'],
    'tipoCuenta'         => $e['tipo_cuenta'],
    'activa'             => (bool) $e['activa'],
], $filas));
