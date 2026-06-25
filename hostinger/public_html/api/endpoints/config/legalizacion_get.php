<?php
declare(strict_types=1);

// GET /config/legalizacion — devuelve configuración editable de legalizaciones.
// Cualquier usuario autenticado puede leer (categorías, límite, mensaje).
Auth::requireUser();

$categorias = json_decode(Settings::get('legalizacion.categorias', '[]') ?? '[]', true) ?: [
    'Alimentación', 'Viajes', 'Transporte', 'Papelería / Útiles', 'Representación', 'Otros',
];
$montoMaximo = (float)(Settings::get('legalizacion.monto_maximo', '0') ?? '0');
$mensajePago = Settings::get(
    'legalizacion.mensaje_pago',
    'Tu solicitud de legalización con número de radicado {radicado} fue aprobada. El pago será realizado en el transcurso de los días hábiles.'
) ?? '';

Response::json([
    'categorias'   => $categorias,
    'montoMaximo'  => $montoMaximo,
    'mensajePago'  => $mensajePago,
]);
