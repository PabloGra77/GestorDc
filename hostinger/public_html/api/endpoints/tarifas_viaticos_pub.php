<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

Auth::requireUser();

$pdo = Db::pdo();
$row = $pdo->query(
    "SELECT precio_aereo, precio_terrestre, precio_desayuno, precio_almuerzo, precio_cena, precio_hospedaje
     FROM tarifas_viaticos WHERE id = 1 LIMIT 1"
)->fetch();

Response::json($row ? [
    'precioAereo'     => (float)$row['precio_aereo'],
    'precioTerrestre' => (float)$row['precio_terrestre'],
    'precioDesayuno'  => (float)$row['precio_desayuno'],
    'precioAlmuerzo'  => (float)$row['precio_almuerzo'],
    'precioCena'      => (float)$row['precio_cena'],
    'precioHospedaje' => (float)$row['precio_hospedaje'],
] : [
    'precioAereo' => 0, 'precioTerrestre' => 0,
    'precioDesayuno' => 0, 'precioAlmuerzo' => 0, 'precioCena' => 0,
    'precioHospedaje' => 0,
]);
