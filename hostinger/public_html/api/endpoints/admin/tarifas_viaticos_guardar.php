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

// Viajes específicos: array de {origen, destino, tipo, precio}
$viajesRaw = is_array($body['viajesEspecificos'] ?? null) ? $body['viajesEspecificos'] : [];
$viajes = [];
foreach ($viajesRaw as $v) {
    $origen  = trim((string)($v['origen']  ?? ''));
    $destino = trim((string)($v['destino'] ?? ''));
    $tipo    = in_array($v['tipo'] ?? '', ['aereo', 'terrestre'], true) ? $v['tipo'] : 'aereo';
    $precio  = max(0, (float)($v['precio'] ?? 0));
    if ($origen && $destino) {
        $viajes[] = ['origen' => $origen, 'destino' => $destino, 'tipo' => $tipo, 'precio' => $precio];
    }
}
$viajesJson = json_encode($viajes, JSON_UNESCAPED_UNICODE);

$pdo = Db::pdo();
$pdo->prepare(
    "INSERT INTO tarifas_viaticos (id, precio_aereo, precio_terrestre, precio_desayuno, precio_almuerzo, precio_cena, precio_hospedaje, viajes_especificos)
     VALUES (1, :a, :t, :d, :al, :c, :h, :ve)
     ON DUPLICATE KEY UPDATE
       precio_aereo = VALUES(precio_aereo),
       precio_terrestre = VALUES(precio_terrestre),
       precio_desayuno = VALUES(precio_desayuno),
       precio_almuerzo = VALUES(precio_almuerzo),
       precio_cena = VALUES(precio_cena),
       precio_hospedaje = VALUES(precio_hospedaje),
       viajes_especificos = VALUES(viajes_especificos)"
)->execute([':a'=>$aereo,':t'=>$terrestre,':d'=>$desayuno,':al'=>$almuerzo,':c'=>$cena,':h'=>$hospedaje,':ve'=>$viajesJson]);

Response::json([
    'precioAereo'       => $aereo,
    'precioTerrestre'   => $terrestre,
    'precioDesayuno'    => $desayuno,
    'precioAlmuerzo'    => $almuerzo,
    'precioCena'        => $cena,
    'precioHospedaje'   => $hospedaje,
    'viajesEspecificos' => $viajes,
]);
