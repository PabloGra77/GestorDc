<?php
declare(strict_types=1);
/**
 * GET /viajes/buscar
 * Busca opciones de vuelo y bus entre dos ciudades colombianas.
 * Intenta Amadeus API; si no está configurada o falla, retorna precios estimados.
 *
 * Params: origen (IATA|nombre), destino (IATA|nombre), fecha_ida (YYYY-MM-DD), fecha_regreso? (YYYY-MM-DD)
 */

require_auth();
throttle('viajes_buscar', 30, 60);

if ($method !== 'GET') {
    Response::error('Método no permitido', 405);
}

/* ─── Parámetros ─────────────────────────────────────────────── */
$origen       = strtoupper(trim($_GET['origen']   ?? ''));
$destino      = strtoupper(trim($_GET['destino']  ?? ''));
$fechaIda     = trim($_GET['fecha_ida']            ?? '');
$fechaRegreso = trim($_GET['fecha_regreso']         ?? '');

if (!$origen || !$destino) {
    Response::error('Parámetros origen y destino son obligatorios', 400);
}
if (!$fechaIda || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaIda)) {
    Response::error('fecha_ida debe tener formato YYYY-MM-DD', 400);
}
if ($fechaRegreso && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaRegreso)) {
    Response::error('fecha_regreso debe tener formato YYYY-MM-DD', 400);
}
if ($origen === $destino) {
    Response::error('Origen y destino no pueden ser iguales', 400);
}

/* ─── Normalizar a códigos IATA (máx 3 letras A-Z) ──────────── */
function validarIata(string $code): bool
{
    return (bool) preg_match('/^[A-Z]{2,3}$/', $code);
}

// Si el parámetro es un nombre de ciudad, intentamos obtener IATA del mapa
$CIUDAD_IATA = [
    'BOGOTA'       => 'BOG', 'BOGOTÁ'        => 'BOG',
    'MEDELLIN'     => 'MDE', 'MEDELLÍN'      => 'MDE',
    'CALI'         => 'CLO',
    'CARTAGENA'    => 'CTG',
    'BARRANQUILLA' => 'BAQ',
    'BUCARAMANGA'  => 'BGA',
    'PEREIRA'      => 'PEI',
    'SANTAMARTA'   => 'SMR', 'SANTA MARTA'  => 'SMR',
    'CUCUTA'       => 'CUC', 'CÚCUTA'       => 'CUC',
    'MANIZALES'    => 'MZL',
    'ARMENIA'      => 'AXM',
    'IBAGUE'       => 'IBE', 'IBAGUÉ'       => 'IBE',
    'MONTERIA'     => 'MTR', 'MONTERÍA'     => 'MTR',
    'VILLAVICENCIO'=> 'VVC',
    'PASTO'        => 'PSO',
    'NEIVA'        => 'HEI',
    'VALLEDUPAR'   => 'VUP',
    'SANANDRES'    => 'ADZ', 'SAN ANDRÉS'   => 'ADZ',
    'POPAYAN'      => 'PPN', 'POPAYÁN'      => 'PPN',
    'LETICIA'      => 'LET',
    'FLORENCIA'    => 'FLA',
    'YOPAL'        => 'EYP',
    'RIOHACHA'     => 'RCH',
];

$origenIata  = validarIata($origen)  ? $origen  : ($CIUDAD_IATA[$origen]  ?? $origen);
$destinoIata = validarIata($destino) ? $destino : ($CIUDAD_IATA[$destino] ?? $destino);

/* ─── Base de precios estimados Colombia ─────────────────────── */
// Formato: 'ORG-DST' => ['vuelo' => [min, mid, max], 'bus' => precio|null, 'durVuelo' => 'Xh Ym', 'durBus' => 'Xh Ym'|null]
$RUTAS = [
    'BOG-MDE' => ['vuelo' => [280000, 320000, 370000], 'bus' => 78000,  'durVuelo' => '1h 10m', 'durBus' => '8h 30m'],
    'BOG-CLO' => ['vuelo' => [260000, 300000, 350000], 'bus' => 72000,  'durVuelo' => '1h 05m', 'durBus' => '8h'],
    'BOG-CTG' => ['vuelo' => [320000, 380000, 460000], 'bus' => 130000, 'durVuelo' => '1h 35m', 'durBus' => '20h'],
    'BOG-BAQ' => ['vuelo' => [300000, 360000, 440000], 'bus' => 120000, 'durVuelo' => '1h 25m', 'durBus' => '17h'],
    'BOG-BGA' => ['vuelo' => [220000, 260000, 310000], 'bus' => 55000,  'durVuelo' => '50m',    'durBus' => '6h'],
    'BOG-PEI' => ['vuelo' => [230000, 270000, 330000], 'bus' => 50000,  'durVuelo' => '55m',    'durBus' => '5h 30m'],
    'BOG-SMR' => ['vuelo' => [280000, 340000, 410000], 'bus' => 100000, 'durVuelo' => '1h 20m', 'durBus' => '15h'],
    'BOG-CUC' => ['vuelo' => [250000, 300000, 360000], 'bus' => 90000,  'durVuelo' => '1h 10m', 'durBus' => '12h'],
    'BOG-MZL' => ['vuelo' => [240000, 280000, 340000], 'bus' => 58000,  'durVuelo' => '1h 00m', 'durBus' => '7h'],
    'BOG-AXM' => ['vuelo' => [230000, 270000, 325000], 'bus' => 52000,  'durVuelo' => '55m',    'durBus' => '6h'],
    'BOG-IBE' => ['vuelo' => [220000, 260000, 310000], 'bus' => 40000,  'durVuelo' => '50m',    'durBus' => '4h'],
    'BOG-MTR' => ['vuelo' => [260000, 310000, 375000], 'bus' => 95000,  'durVuelo' => '1h 10m', 'durBus' => '14h'],
    'BOG-VVC' => ['vuelo' => [210000, 250000, 300000], 'bus' => 45000,  'durVuelo' => '45m',    'durBus' => '4h 30m'],
    'BOG-PSO' => ['vuelo' => [260000, 310000, 375000], 'bus' => 75000,  'durVuelo' => '1h 15m', 'durBus' => '9h'],
    'BOG-HEI' => ['vuelo' => [230000, 270000, 325000], 'bus' => 55000,  'durVuelo' => '55m',    'durBus' => '6h 30m'],
    'BOG-VUP' => ['vuelo' => [280000, 340000, 415000], 'bus' => 110000, 'durVuelo' => '1h 20m', 'durBus' => '16h'],
    'BOG-ADZ' => ['vuelo' => [420000, 520000, 650000], 'bus' => null,   'durVuelo' => '1h 55m', 'durBus' => null],
    'BOG-PPN' => ['vuelo' => [250000, 295000, 355000], 'bus' => 68000,  'durVuelo' => '1h 05m', 'durBus' => '8h 30m'],
    'BOG-LET' => ['vuelo' => [380000, 470000, 590000], 'bus' => null,   'durVuelo' => '2h 00m', 'durBus' => null],
    'BOG-FLA' => ['vuelo' => [220000, 260000, 315000], 'bus' => 50000,  'durVuelo' => '50m',    'durBus' => '6h'],
    'BOG-EYP' => ['vuelo' => [230000, 275000, 330000], 'bus' => 48000,  'durVuelo' => '55m',    'durBus' => '5h'],
    'BOG-RCH' => ['vuelo' => [290000, 350000, 430000], 'bus' => 115000, 'durVuelo' => '1h 25m', 'durBus' => '18h'],
    'MDE-CLO' => ['vuelo' => [220000, 260000, 315000], 'bus' => 65000,  'durVuelo' => '1h 00m', 'durBus' => '7h'],
    'MDE-CTG' => ['vuelo' => [260000, 310000, 375000], 'bus' => 110000, 'durVuelo' => '1h 10m', 'durBus' => '13h'],
    'MDE-BAQ' => ['vuelo' => [240000, 290000, 355000], 'bus' => 90000,  'durVuelo' => '1h 05m', 'durBus' => '11h'],
    'MDE-BGA' => ['vuelo' => [200000, 240000, 295000], 'bus' => 55000,  'durVuelo' => '45m',    'durBus' => '6h'],
    'CLO-CTG' => ['vuelo' => [260000, 315000, 380000], 'bus' => 120000, 'durVuelo' => '1h 15m', 'durBus' => '16h'],
    'CTG-BAQ' => ['vuelo' => [200000, 240000, 295000], 'bus' => 50000,  'durVuelo' => '40m',    'durBus' => '5h'],
];

function obtenerRuta(string $a, string $b, array &$RUTAS): ?array
{
    $key = "$a-$b";
    $keyInv = "$b-$a";
    if (isset($RUTAS[$key]))    return array_merge($RUTAS[$key], ['invertida' => false]);
    if (isset($RUTAS[$keyInv])) return array_merge($RUTAS[$keyInv], ['invertida' => true]);
    return null;
}

/* ─── Aerolíneas estimadas para el fallback ──────────────────── */
$AEROLINEAS = [
    ['Avianca', '06:10', '07:25'],
    ['LATAM Colombia', '08:30', '09:40'],
    ['JetSmart', '11:15', '12:20'],
    ['Avianca', '15:00', '16:10'],
    ['LATAM Colombia', '18:45', '19:55'],
];

function generarOpcionesEstimadas(array $ruta, string $fechaIda, bool $esRegreso, array $aerols): array
{
    $opciones = [];
    $precios  = $ruta['vuelo'];
    sort($precios);
    $prefijos = ['opt_ida_', 'opt_reg_'];
    $prefix   = $prefijos[$esRegreso ? 1 : 0];

    // Vuelos
    foreach ($aerols as $i => [$empresa, $salida, $llegada]) {
        // Variar ligeramente el precio por aerolínea
        $precio = (int) round($precios[min($i, count($precios) - 1)] * (0.9 + ($i * 0.12)));
        $opciones[] = [
            'id'          => $prefix . 'v' . $i,
            'tipo'        => 'vuelo',
            'empresa'     => $empresa,
            'salida'      => $salida,
            'llegada'     => $llegada,
            'duracion'    => $ruta['durVuelo'],
            'precio'      => $precio,
            'esEstimado'  => true,
        ];
    }
    // Bus (si aplica)
    if (!is_null($ruta['bus']) && $ruta['durBus']) {
        $opciones[] = [
            'id'         => $prefix . 'bus',
            'tipo'       => 'bus',
            'empresa'    => 'Pullman / Bolivariano',
            'salida'     => '07:00',
            'llegada'    => '—',
            'duracion'   => $ruta['durBus'],
            'precio'     => $ruta['bus'],
            'esEstimado' => true,
        ];
    }
    // Ordenar por precio
    usort($opciones, fn($a, $b) => $a['precio'] - $b['precio']);
    return $opciones;
}

/* ─── Intentar Amadeus API ───────────────────────────────────── */
$clientId     = (string) Config::get('AMADEUS_CLIENT_ID',     '');
$clientSecret = (string) Config::get('AMADEUS_CLIENT_SECRET', '');
$opcionesIda     = [];
$opcionesRegreso = [];
$fuente          = 'estimado';

if ($clientId && $clientSecret && validarIata($origenIata) && validarIata($destinoIata)) {
    try {
        // 1) Obtener token OAuth2
        $ch = curl_init('https://test.api.amadeus.com/v1/security/oauth2/token');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_POSTFIELDS     => http_build_query([
                'grant_type'    => 'client_credentials',
                'client_id'     => $clientId,
                'client_secret' => $clientSecret,
            ]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        $tokenRaw = curl_exec($ch);
        $tokenErr = curl_error($ch);
        curl_close($ch);

        if ($tokenErr || !$tokenRaw) throw new RuntimeException('Amadeus token error: ' . $tokenErr);
        $tokenData = json_decode((string)$tokenRaw, true);
        $token     = $tokenData['access_token'] ?? '';
        if (!$token) throw new RuntimeException('Amadeus: no access_token');

        // Mapa aerolíneas
        $AIRLINES = ['AV' => 'Avianca', 'LA' => 'LATAM Colombia', 'P5' => 'LATAM Colombia',
                     '5Z' => 'JetSmart', '9R' => 'JetSmart', 'KR' => 'Copa Airlines'];

        function buscarVuelosAmadeus(string $token, string $origen, string $destino, string $fecha, array $AIRLINES): array
        {
            $url = 'https://test.api.amadeus.com/v2/shopping/flight-offers?' . http_build_query([
                'originLocationCode'      => $origen,
                'destinationLocationCode' => $destino,
                'departureDate'           => $fecha,
                'adults'                  => 1,
                'currencyCode'            => 'COP',
                'max'                     => 6,
            ]);
            $ch2 = curl_init($url);
            curl_setopt_array($ch2, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $token],
            ]);
            $raw  = curl_exec($ch2);
            $err2 = curl_error($ch2);
            curl_close($ch2);
            if ($err2 || !$raw) throw new RuntimeException('Amadeus flights error: ' . $err2);
            $data = json_decode((string)$raw, true);
            $offers = $data['data'] ?? [];
            $opciones = [];
            foreach ($offers as $i => $offer) {
                $itinerary = $offer['itineraries'][0] ?? null;
                if (!$itinerary) continue;
                $seg0    = $itinerary['segments'][0] ?? null;
                $segLast = end($itinerary['segments']);
                if (!$seg0) continue;
                $codigo   = $seg0['carrierCode'] ?? '';
                $empresa  = $AIRLINES[$codigo] ?? $codigo;
                $precio   = (int) round((float) ($offer['price']['grandTotal'] ?? 0));
                $salida   = substr($seg0['departure']['at'] ?? '', 11, 5);
                $llegada  = substr($segLast['arrival']['at'] ?? '', 11, 5);
                $durRaw   = $itinerary['duration'] ?? 'PT1H';
                // Convertir PT2H30M → '2h 30m'
                preg_match('/PT(\d+H)?(\d+M)?/', $durRaw, $dm);
                $h = isset($dm[1]) ? (int)$dm[1] : 0;
                $m = isset($dm[2]) ? (int)$dm[2] : 0;
                $dur = ($h ? "{$h}h " : '') . ($m ? "{$m}m" : '');
                $opciones[] = [
                    'id'         => "ama_$i",
                    'tipo'       => count($itinerary['segments']) > 1 ? 'vuelo_escala' : 'vuelo',
                    'empresa'    => $empresa ?: 'Aerolínea',
                    'salida'     => $salida,
                    'llegada'    => $llegada,
                    'duracion'   => trim($dur) ?: '—',
                    'precio'     => $precio,
                    'esEstimado' => false,
                ];
            }
            usort($opciones, fn($a, $b) => $a['precio'] - $b['precio']);
            return $opciones;
        }

        $opcionesIda = buscarVuelosAmadeus($token, $origenIata, $destinoIata, $fechaIda, $AIRLINES);
        if ($fechaRegreso) {
            $opcionesRegreso = buscarVuelosAmadeus($token, $destinoIata, $origenIata, $fechaRegreso, $AIRLINES);
        }
        $fuente = 'api';

    } catch (Throwable $e) {
        error_log('[gestordoc][viajes] Amadeus falló: ' . $e->getMessage() . '. Usando estimados.');
        $opcionesIda     = [];
        $opcionesRegreso = [];
        $fuente          = 'estimado';
    }
}

/* ─── Fallback a precios estimados ──────────────────────────── */
if (empty($opcionesIda)) {
    $ruta = obtenerRuta($origenIata, $destinoIata, $RUTAS);
    if ($ruta) {
        $opcionesIda = generarOpcionesEstimadas($ruta, $fechaIda, false, $AEROLINEAS);
        if ($fechaRegreso) {
            $opcionesRegreso = generarOpcionesEstimadas($ruta, $fechaRegreso, true, $AEROLINEAS);
        }
    } else {
        // Sin datos para esta ruta: devolvemos lista vacía (frontend muestra mensaje)
        $opcionesIda     = [];
        $opcionesRegreso = [];
    }
}

Response::json([
    'opciones'        => $opcionesIda,
    'opcionesRegreso' => $opcionesRegreso,
    'fuente'          => $fuente,
]);
