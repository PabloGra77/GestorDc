<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

Auth::requireAdmin();

$body = json_decode((string)file_get_contents('php://input'), true) ?? [];

$aereo     = max(0, (float)($body['precioAereo']     ?? 0));
$terrestre = max(0, (float)($body['precioTerrestre'] ?? 0));
$desayuno  = max(0, (float)($body['precioDesayuno']  ?? 0));
$almuerzo  = max(0, (float)($body['precioAlmuerzo']  ?? 0));
$cena      = max(0, (float)($body['precioCena']      ?? 0));
$hospedaje = max(0, (float)($body['precioHospedaje'] ?? 0));

$pdo = Db::pdo();
$pdo->prepare(
    "INSERT INTO tarifas_viaticos (id, precio_aereo, precio_terrestre, precio_desayuno, precio_almuerzo, precio_cena, precio_hospedaje)
     VALUES (1, :a, :t, :d, :al, :c, :h)
     ON DUPLICATE KEY UPDATE
       precio_aereo = VALUES(precio_aereo),
       precio_terrestre = VALUES(precio_terrestre),
       precio_desayuno = VALUES(precio_desayuno),
       precio_almuerzo = VALUES(precio_almuerzo),
       precio_cena = VALUES(precio_cena),
       precio_hospedaje = VALUES(precio_hospedaje)"
)->execute([':a'=>$aereo,':t'=>$terrestre,':d'=>$desayuno,':al'=>$almuerzo,':c'=>$cena,':h'=>$hospedaje]);

Response::json([
    'precioAereo'     => $aereo,
    'precioTerrestre' => $terrestre,
    'precioDesayuno'  => $desayuno,
    'precioAlmuerzo'  => $almuerzo,
    'precioCena'      => $cena,
    'precioHospedaje' => $hospedaje,
]);
