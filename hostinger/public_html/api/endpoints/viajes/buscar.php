<?php
declare(strict_types=1);
/**
 * GET /viajes/buscar
 * Transporte entre ciudades colombianas: vuelo, bus o multimodal (avión+bus).
 * Cuando el destino es un municipio sin aeropuerto, genera rutas combinadas
 * automáticamente (p.ej. Bogotá→Valledupar en avión + bus a Pelaya).
 * Intenta Amadeus API; si falla o no está configurada, usa simulación enriquecida.
 *
 * Params: origen, destino, fecha_ida (YYYY-MM-DD), fecha_regreso? (YYYY-MM-DD)
 */

Auth::requireUser();
Throttle::hit('viajes:' . Throttle::clientIp(), 30, 60);

/* ── Parámetros ──────────────────────────────────────────────────────────── */
$origenRaw    = strtoupper(trim($_GET['origen']       ?? ''));
$destinoRaw   = strtoupper(trim($_GET['destino']      ?? ''));
$fechaIda     = trim($_GET['fecha_ida']                ?? '');
$fechaRegreso = trim($_GET['fecha_regreso']             ?? '');

if (!$origenRaw || !$destinoRaw)
    Response::error('Parámetros origen y destino son obligatorios', 400);
if (!$fechaIda || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaIda))
    Response::error('fecha_ida debe tener formato YYYY-MM-DD', 400);
if ($fechaRegreso && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaRegreso))
    Response::error('fecha_regreso debe tener formato YYYY-MM-DD', 400);
if ($origenRaw === $destinoRaw)
    Response::error('Origen y destino no pueden ser iguales', 400);

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function validarIata(string $c): bool
{
    return (bool) preg_match('/^[A-Z]{2,3}$/', $c);
}

function normCiudad(string $s): string
{
    $s = mb_strtoupper(trim($s), 'UTF-8');
    return strtr($s, [
        'Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','Ü'=>'U','Ñ'=>'N',
        'á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n',
    ]);
}

function minutosADur(int $mins): string
{
    $h = intdiv($mins, 60);
    $m = $mins % 60;
    return trim(($h ? "{$h}h " : '') . ($m ? "{$m}m" : '')) ?: '—';
}

function sumarMinutos(string $hora, int $mins): string
{
    $parts = explode(':', $hora . ':00');
    $t = (int)$parts[0] * 60 + (int)$parts[1] + $mins;
    return sprintf('%02d:%02d', intdiv($t, 60) % 24, $t % 60);
}

function seedRuta(string $a, string $b, string $fecha): void
{
    mt_srand(abs(crc32("{$a}-{$b}-{$fecha}")));
}

function precioRand(int $min, int $max): int
{
    // Redondear a miles para precios más naturales
    $raw = mt_rand($min, $max);
    return (int) (round($raw / 1000) * 1000);
}

function elegirSlots(array $slots, int $n): array
{
    shuffle($slots);
    $sel = array_slice($slots, 0, min($n, count($slots)));
    sort($sel);
    return $sel;
}

/* ── Ciudades con aeropuerto → IATA ──────────────────────────────────────── */
$CIUDAD_IATA = [
    /* Capitales / grandes aeropuertos */
    'BOGOTA'=>'BOG','BOGOTÁ'=>'BOG','SANTAFE DE BOGOTA'=>'BOG','SANTA FE DE BOGOTA'=>'BOG',
    'MEDELLIN'=>'MDE','MEDELLÍN'=>'MDE','BELLO'=>'MDE','ITAGUI'=>'MDE','ITAGÜÍ'=>'MDE','ENVIGADO'=>'MDE',
    'CALI'=>'CLO','PALMIRA'=>'CLO','YUMBO'=>'CLO',
    'CARTAGENA'=>'CTG','CARTAGENA DE INDIAS'=>'CTG',
    'BARRANQUILLA'=>'BAQ','SOLEDAD'=>'BAQ',
    'BUCARAMANGA'=>'BGA','FLORIDABLANCA'=>'BGA','GIRON'=>'BGA','GIRÓN'=>'BGA','PIEDECUESTA'=>'BGA',
    'PEREIRA'=>'PEI','DOSQUEBRADAS'=>'PEI',
    'SANTA MARTA'=>'SMR','SANTAMARTA'=>'SMR',
    'CUCUTA'=>'CUC','CÚCUTA'=>'CUC','VILLA DEL ROSARIO'=>'CUC','LOS PATIOS'=>'CUC','SAN JOSE DE CUCUTA'=>'CUC',
    'MANIZALES'=>'MZL',
    'ARMENIA'=>'AXM',
    'IBAGUE'=>'IBE','IBAGUÉ'=>'IBE',
    'MONTERIA'=>'MTR','MONTERÍA'=>'MTR',
    'VILLAVICENCIO'=>'VVC',
    'PASTO'=>'PSO',
    'NEIVA'=>'HEI',
    'VALLEDUPAR'=>'VUP',
    'SAN ANDRES'=>'ADZ','SAN ANDRÉS'=>'ADZ','SANANDRES'=>'ADZ','ISLA DE SAN ANDRES'=>'ADZ',
    'POPAYAN'=>'PPN','POPAYÁN'=>'PPN',
    'LETICIA'=>'LET',
    'FLORENCIA'=>'FLA',
    'YOPAL'=>'EYP',
    'RIOHACHA'=>'RCH',
    'QUIBDO'=>'UIB','QUIBDÓ'=>'UIB',
    'ARAUCA'=>'AUC',
    'BARRANCABERMEJA'=>'EJA',
    'TUMACO'=>'TCC',
    'COROZAL'=>'CZU','SINCELEJO'=>'CZU',
    'APARTADO'=>'APO','APARTADÓ'=>'APO',
    'TURBO'=>'TRB',
    'PUERTO CARRENO'=>'PCR','PUERTO CARREÑO'=>'PCR',
    'MITU'=>'MVP','MITÚ'=>'MVP',
    'INIRIDA'=>'PDA','INÍRIDA'=>'PDA',
    'SAN JOSE DEL GUAVIARE'=>'SJE','SAN JOSÉ DEL GUAVIARE'=>'SJE',
    'SARAVENA'=>'ULS',
    /* Departamentos → aeropuerto principal */
    'CESAR'=>'VUP','DEPARTAMENTO DE CESAR'=>'VUP',
    'CORDOBA'=>'MTR','CÓRDOBA'=>'MTR',
    'CAUCA'=>'PPN',
    'NARINO'=>'PSO','NARIÑO'=>'PSO',
    'HUILA'=>'HEI',
    'META'=>'VVC',
    'CASANARE'=>'EYP',
    'CAQUETA'=>'FLA','CAQUETÁ'=>'FLA',
    'GUAVIARE'=>'SJE',
    'CHOCO'=>'UIB','CHOCÓ'=>'UIB',
    'LA GUAJIRA'=>'RCH',
    'MAGDALENA'=>'SMR',
    'BOLIVAR'=>'CTG','BOLÍVAR'=>'CTG',
];

/* ── Municipios SIN aeropuerto → aeropuerto más cercano ─────────────────── */
/* Formato: nombre → [iata, ciudad_aeropuerto, min_bus, precio_min, precio_max, [empresas]] */
$MUNICIPIOS_SIN_AEROPUERTO = [
    /* Cesar */
    /* Cesar — municipios sur (conexión BGA, ruta troncal Magdalena) */
    'PELAYA'                 => ['BGA','Bucaramanga',240, 38000, 52000, ['Copetran','Expreso Brasilia']],
    'PAILITAS'               => ['BGA','Bucaramanga',270, 42000, 58000, ['Copetran','Expreso Brasilia']],
    'AGUACHICA'              => ['BGA','Bucaramanga',150, 32000, 45000, ['Copetran','Berlinas del Fonce']],
    'GAMARRA'                => ['BGA','Bucaramanga',210, 36000, 50000, ['Copetran']],
    'SAN ALBERTO'            => ['BGA','Bucaramanga',180, 38000, 52000, ['Copetran','Berlinas del Fonce']],
    'AGUACHICA CESAR'        => ['BGA','Bucaramanga',150, 32000, 45000, ['Copetran']],
    /* Cesar — municipios norte (conexión VUP, más cerca de Valledupar) */
    'LA JAGUA DE IBIRICO'    => ['VUP','Valledupar',  60, 16000, 22000, ['Copetran']],
    'BECERRIL'               => ['VUP','Valledupar', 120, 24000, 34000, ['Copetran']],
    'CHIMICHAGUA'            => ['VUP','Valledupar', 150, 28000, 40000, ['Copetran']],
    'CURUMANI'               => ['VUP','Valledupar', 120, 23000, 32000, ['Copetran']],
    'MANAURE BALCON DEL CESAR'=> ['VUP','Valledupar', 80, 18000, 25000, ['Copetran']],
    /* Magdalena */
    'EL BANCO'               => ['VUP','Valledupar', 180, 42000, 58000, ['Expreso Brasilia','Copetran']],
    'PLATO'                  => ['SMR','Santa Marta', 120, 28000, 38000, ['Flota Magdalena','Expreso Brasilia']],
    'CIENAGA'                => ['SMR','Santa Marta',  60, 13000, 18000, ['Flota Magdalena','Expreso Brasilia']],
    'FUNDACION'              => ['SMR','Santa Marta',  90, 20000, 28000, ['Flota Magdalena']],
    'ARACATACA'              => ['SMR','Santa Marta', 120, 26000, 36000, ['Flota Magdalena']],
    'PIVIJAY'                => ['BAQ','Barranquilla',  90, 22000, 30000, ['Expreso Brasilia']],
    'EL DIFICIL'             => ['SMR','Santa Marta', 150, 30000, 42000, ['Flota Magdalena']],
    /* Bolívar */
    'MAGANGUE'               => ['CTG','Cartagena',  210, 50000, 70000, ['Expreso Brasilia','Rápido Ochoa']],
    'MAGANGUÉ'               => ['CTG','Cartagena',  210, 50000, 70000, ['Expreso Brasilia','Rápido Ochoa']],
    'MOMPOX'                 => ['BAQ','Barranquilla',300, 60000, 85000, ['Expreso Brasilia']],
    'MOMPOS'                 => ['BAQ','Barranquilla',300, 60000, 85000, ['Expreso Brasilia']],
    'EL CARMEN DE BOLIVAR'   => ['CTG','Cartagena',  180, 40000, 56000, ['Expreso Brasilia']],
    'SAN JUAN NEPOMUCENO'    => ['CTG','Cartagena',  150, 35000, 48000, ['Expreso Brasilia']],
    /* Boyacá */
    'TUNJA'                  => ['BOG','Bogotá',      150, 28000, 38000, ['Expreso Bolivariano','Libertadores']],
    'DUITAMA'                => ['BOG','Bogotá',      180, 33000, 46000, ['Expreso Bolivariano','Libertadores']],
    'SOGAMOSO'               => ['BOG','Bogotá',      210, 36000, 50000, ['Expreso Bolivariano','Libertadores']],
    'PAIPA'                  => ['BOG','Bogotá',      170, 30000, 42000, ['Expreso Bolivariano']],
    'VILLA DE LEYVA'         => ['BOG','Bogotá',      175, 32000, 44000, ['Expreso Bolivariano']],
    'CHIQUINQUIRA'           => ['BOG','Bogotá',      180, 30000, 42000, ['Expreso Bolivariano','Flota Boyacá']],
    /* Caldas */
    'LA DORADA'              => ['MZL','Manizales',    90, 23000, 32000, ['Expreso Bolivariano','Flota Occidental']],
    'RIOSUCIO'               => ['MZL','Manizales',   120, 26000, 36000, ['Expreso Bolivariano']],
    'CHINCHINA'              => ['MZL','Manizales',    40, 10000, 14000, ['Expreso Bolivariano']],
    'ANSERMA'                => ['MZL','Manizales',    90, 20000, 28000, ['Flota Occidental']],
    /* Cundinamarca */
    'GIRARDOT'               => ['BOG','Bogotá',      120, 26000, 36000, ['Expreso Bolivariano','Flota Magdalena']],
    'FUSAGASUGA'             => ['BOG','Bogotá',       90, 16000, 22000, ['Expreso Bolivariano']],
    'FUSAGASUGÁ'             => ['BOG','Bogotá',       90, 16000, 22000, ['Expreso Bolivariano']],
    'FACATATIVA'             => ['BOG','Bogotá',       50, 10000, 14000, ['Expreso Bolivariano']],
    'FACATATIVÁ'             => ['BOG','Bogotá',       50, 10000, 14000, ['Expreso Bolivariano']],
    'ZIPAQUIRA'              => ['BOG','Bogotá',       60, 12000, 16000, ['Expreso Bolivariano']],
    'ZIPAQUIRÁ'              => ['BOG','Bogotá',       60, 12000, 16000, ['Expreso Bolivariano']],
    'VILLETA'                => ['BOG','Bogotá',       90, 18000, 25000, ['Expreso Bolivariano']],
    'LA MESA'                => ['BOG','Bogotá',       75, 14000, 20000, ['Expreso Bolivariano']],
    /* Santander */
    'SAN GIL'                => ['BGA','Bucaramanga', 120, 26000, 36000, ['Berlinas del Fonce','Copetran']],
    'VELEZ'                  => ['BGA','Bucaramanga', 180, 36000, 50000, ['Copetran']],
    'VÉLEZ'                  => ['BGA','Bucaramanga', 180, 36000, 50000, ['Copetran']],
    'SOCORRO'                => ['BGA','Bucaramanga', 150, 30000, 42000, ['Copetran']],
    'MALAGA'                 => ['BGA','Bucaramanga', 180, 35000, 48000, ['Copetran']],
    'MÁLAGA'                 => ['BGA','Bucaramanga', 180, 35000, 48000, ['Copetran']],
    'BARBOSA'                => ['BGA','Bucaramanga',  90, 20000, 28000, ['Berlinas del Fonce']],
    /* Norte de Santander */
    'OCANA'                  => ['CUC','Cúcuta',      180, 36000, 50000, ['Coflonorte','Fronteras']],
    'OCAÑA'                  => ['CUC','Cúcuta',      180, 36000, 50000, ['Coflonorte','Fronteras']],
    'PAMPLONA'               => ['CUC','Cúcuta',       90, 16000, 22000, ['Copetran','Fronteras']],
    'TIBU'                   => ['CUC','Cúcuta',      120, 22000, 30000, ['Fronteras']],
    'TIBÚ'                   => ['CUC','Cúcuta',      120, 22000, 30000, ['Fronteras']],
    'CHINACOTA'              => ['CUC','Cúcuta',       60, 12000, 16000, ['Fronteras']],
    /* Tolima */
    'ESPINAL'                => ['IBE','Ibagué',       60, 16000, 22000, ['Expreso Bolivariano']],
    'HONDA'                  => ['IBE','Ibagué',       90, 20000, 28000, ['Expreso Bolivariano','Flota Magdalena']],
    'MELGAR'                 => ['IBE','Ibagué',       90, 18000, 25000, ['Expreso Bolivariano']],
    'CHAPARRAL'              => ['IBE','Ibagué',      120, 26000, 36000, ['Coomotor']],
    'PURIFICACION'           => ['IBE','Ibagué',      100, 22000, 30000, ['Expreso Bolivariano']],
    'PURIFICACIÓN'           => ['IBE','Ibagué',      100, 22000, 30000, ['Expreso Bolivariano']],
    /* Huila */
    'GARZON'                 => ['HEI','Neiva',       120, 26000, 36000, ['Coomotor','Expreso Bolivariano']],
    'GARZÓN'                 => ['HEI','Neiva',       120, 26000, 36000, ['Coomotor','Expreso Bolivariano']],
    'PITALITO'               => ['HEI','Neiva',       180, 32000, 45000, ['Coomotor']],
    'LA PLATA'               => ['HEI','Neiva',       150, 28000, 38000, ['Coomotor']],
    'SAN AGUSTIN'            => ['HEI','Neiva',       210, 38000, 52000, ['Coomotor']],
    'SAN AGUSTÍN'            => ['HEI','Neiva',       210, 38000, 52000, ['Coomotor']],
    /* Nariño */
    'IPIALES'                => ['PSO','Pasto',        90, 20000, 28000, ['Expreso Bolivariano','La Veloz del Sur']],
    'SAMANIEGO'              => ['PSO','Pasto',       120, 26000, 36000, ['Expreso Bolivariano']],
    'LA UNION'               => ['PSO','Pasto',        90, 18000, 25000, ['Expreso Bolivariano']],
    'LA UNIÓN'               => ['PSO','Pasto',        90, 18000, 25000, ['Expreso Bolivariano']],
    /* Putumayo */
    'MOCOA'                  => ['PSO','Pasto',       120, 26000, 36000, ['Expreso Bolivariano']],
    'PUERTO ASIS'            => ['PSO','Pasto',       300, 60000, 84000, ['Cootranscaquetá']],
    'PUERTO ASÍS'            => ['PSO','Pasto',       300, 60000, 84000, ['Cootranscaquetá']],
    'SIBUNDOY'               => ['PSO','Pasto',        90, 18000, 25000, ['Expreso Bolivariano']],
    'ORITO'                  => ['PSO','Pasto',       270, 55000, 75000, ['Cootranscaquetá']],
    /* Cauca */
    'SANTANDER DE QUILICHAO' => ['CLO','Cali',         60, 16000, 22000, ['Expreso Bolivariano','Flota Occidental']],
    'MIRANDA'                => ['CLO','Cali',          80, 18000, 25000, ['Expreso Bolivariano']],
    'PUERTO TEJADA'          => ['CLO','Cali',          70, 16000, 22000, ['Flota Occidental']],
    'PATIA'                  => ['PPN','Popayán',       90, 18000, 25000, ['Expreso Bolivariano']],
    /* Córdoba */
    'LORICA'                 => ['MTR','Montería',      45, 10000, 14000, ['Expreso Brasilia']],
    'PLANETA RICA'           => ['MTR','Montería',     120, 20000, 28000, ['Expreso Brasilia','Rápido Ochoa']],
    'SAHAGUN'                => ['MTR','Montería',     120, 22000, 30000, ['Expreso Brasilia']],
    'SAHAGÚN'                => ['MTR','Montería',     120, 22000, 30000, ['Expreso Brasilia']],
    'CIENAGA DE ORO'         => ['MTR','Montería',      60, 13000, 18000, ['Expreso Brasilia']],
    'TIERRALTA'              => ['MTR','Montería',     150, 28000, 38000, ['Expreso Brasilia']],
    /* Sucre */
    'SINCE'                  => ['CZU','Sincelejo',     45, 10000, 14000, ['Expreso Brasilia']],
    'SAMPUES'                => ['CZU','Sincelejo',     60, 13000, 18000, ['Expreso Brasilia']],
    'TOLU'                   => ['CZU','Sincelejo',     90, 18000, 25000, ['Expreso Brasilia']],
    'TOLÚ'                   => ['CZU','Sincelejo',     90, 18000, 25000, ['Expreso Brasilia']],
    'SAN MARCOS'             => ['CZU','Sincelejo',    120, 22000, 30000, ['Expreso Brasilia']],
    /* Antioquia/Urabá */
    'CHIGORODO'              => ['APO','Apartadó',      45, 10000, 14000, ['Rápido Ochoa']],
    'CHIGORODÓ'              => ['APO','Apartadó',      45, 10000, 14000, ['Rápido Ochoa']],
    /* Meta */
    'ACACIAS'                => ['VVC','Villavicencio',  40, 10000, 14000, ['Expreso Bolivariano']],
    'GRANADA META'           => ['VVC','Villavicencio',  90, 20000, 28000, ['Expreso Bolivariano']],
    'SAN MARTIN DE LOS LLANOS'=> ['VVC','Villavicencio', 60, 14000, 20000, ['Expreso Bolivariano']],
    /* Casanare */
    'AGUAZUL'                => ['EYP','Yopal',          60, 13000, 18000, ['Expreso Bolivariano']],
    'TAURAMENA'              => ['EYP','Yopal',           90, 18000, 25000, ['Expreso Bolivariano']],
    'VILLANUEVA'             => ['EYP','Yopal',           90, 18000, 25000, ['Expreso Bolivariano']],
];

/* ── Aerolíneas colombianas por tipo de ruta ─────────────────────────────── */
$AL_TRUNK    = ['Avianca','LATAM Colombia','Wingo','JetSmart','Copa Airlines'];
$AL_REGIONAL = ['Avianca','LATAM Colombia','EasyFly','JetSmart','Wingo'];
$AL_REMOTE   = ['Satena','EasyFly','Avianca'];

/* Horarios de salida por tipo */
$SLV_TRUNK    = ['05:30','06:10','07:20','08:00','08:45','09:30','10:30','11:15','12:30','13:00','14:30','15:00','16:00','17:20','17:45','18:30','19:00','20:10'];
$SLV_REGIONAL = ['06:00','06:30','07:30','08:30','09:00','10:00','11:00','12:30','14:00','15:30','16:30','17:30','18:00','19:00'];
$SLV_REMOTE   = ['06:00','08:00','10:00','12:30','14:00','16:00'];
$SL_BUS       = ['04:00','04:30','05:00','05:30','06:00','06:30','07:00','08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','22:30'];

/* ── Empresas de bus por región ──────────────────────────────────────────── */
$BUS_COSTA    = ['Expreso Brasilia','Copetran','Flota Magdalena','Omega Ltda','Berlinastur','Expreso Bolivariano'];
$BUS_INTERIOR = ['Expreso Bolivariano','Flota Occidental','Rápido Tolima','Autobuses del Sur','Coflonorte'];
$BUS_ORIENTE  = ['Copetran','Berlinas del Fonce','San Silvestre','Fronteras','Expreso Brasilia'];
$BUS_SUR      = ['Coomotor','La Veloz del Sur','Expreso Bolivariano','Cootranscaquetá','Sotracesa'];
$BUS_ANTIOQ   = ['Rápido Ochoa','Flota Occidental','Expreso Bolivariano','Cotrafa','Transportes Gómez Hernández'];
$BUS_GENERAL  = ['Expreso Bolivariano','Expreso Brasilia','Copetran','Flota Magdalena','Omega Ltda','Rápido Ochoa'];

/* ── Tabla de rutas ──────────────────────────────────────────────────────── */
/* [v=>[min,max], b=>[min,max]|null, dv=>min_vuelo, db=>min_bus|null, al=>trunk/regional/remote, rb=>&$buses] */
$RUTAS = [
    /* ── Bogotá ── */
    'BOG-MDE'=>['v'=>[248000,395000],'b'=>[62000,95000],  'dv'=>70, 'db'=>510,'al'=>'trunk',    'rb'=>&$BUS_ANTIOQ],
    'BOG-CLO'=>['v'=>[235000,380000],'b'=>[58000,88000],  'dv'=>65, 'db'=>480,'al'=>'trunk',    'rb'=>&$BUS_INTERIOR],
    'BOG-CTG'=>['v'=>[285000,465000],'b'=>[115000,162000],'dv'=>95, 'db'=>1200,'al'=>'trunk',   'rb'=>&$BUS_COSTA],
    'BOG-BAQ'=>['v'=>[265000,445000],'b'=>[105000,150000],'dv'=>85, 'db'=>1020,'al'=>'trunk',   'rb'=>&$BUS_COSTA],
    'BOG-BGA'=>['v'=>[198000,322000],'b'=>[45000,72000],  'dv'=>50, 'db'=>360,'al'=>'trunk',    'rb'=>&$BUS_ORIENTE],
    'BOG-PEI'=>['v'=>[208000,338000],'b'=>[42000,65000],  'dv'=>55, 'db'=>330,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'BOG-SMR'=>['v'=>[258000,422000],'b'=>[88000,130000], 'dv'=>80, 'db'=>900,'al'=>'trunk',    'rb'=>&$BUS_COSTA],
    'BOG-CUC'=>['v'=>[228000,372000],'b'=>[78000,118000], 'dv'=>70, 'db'=>720,'al'=>'regional', 'rb'=>&$BUS_ORIENTE],
    'BOG-MZL'=>['v'=>[218000,348000],'b'=>[48000,74000],  'dv'=>60, 'db'=>420,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'BOG-AXM'=>['v'=>[208000,332000],'b'=>[43000,67000],  'dv'=>55, 'db'=>360,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'BOG-IBE'=>['v'=>[198000,318000],'b'=>[33000,52000],  'dv'=>50, 'db'=>240,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'BOG-MTR'=>['v'=>[238000,388000],'b'=>[85000,125000], 'dv'=>70, 'db'=>840,'al'=>'regional', 'rb'=>&$BUS_COSTA],
    'BOG-VVC'=>['v'=>[192000,308000],'b'=>[38000,58000],  'dv'=>45, 'db'=>270,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'BOG-PSO'=>['v'=>[238000,388000],'b'=>[65000,98000],  'dv'=>75, 'db'=>540,'al'=>'regional', 'rb'=>&$BUS_SUR],
    'BOG-HEI'=>['v'=>[212000,342000],'b'=>[46000,72000],  'dv'=>55, 'db'=>390,'al'=>'regional', 'rb'=>&$BUS_SUR],
    'BOG-VUP'=>['v'=>[258000,418000],'b'=>[98000,145000], 'dv'=>80, 'db'=>960,'al'=>'regional', 'rb'=>&$BUS_COSTA],
    'BOG-ADZ'=>['v'=>[398000,662000],'b'=>[null,null],    'dv'=>115,'db'=>null,'al'=>'trunk',   'rb'=>[]],
    'BOG-PPN'=>['v'=>[228000,368000],'b'=>[60000,90000],  'dv'=>65, 'db'=>510,'al'=>'regional', 'rb'=>&$BUS_SUR],
    'BOG-LET'=>['v'=>[358000,602000],'b'=>[null,null],    'dv'=>120,'db'=>null,'al'=>'remote',  'rb'=>[]],
    'BOG-FLA'=>['v'=>[202000,328000],'b'=>[43000,67000],  'dv'=>50, 'db'=>360,'al'=>'remote',   'rb'=>&$BUS_SUR],
    'BOG-EYP'=>['v'=>[212000,342000],'b'=>[40000,62000],  'dv'=>55, 'db'=>300,'al'=>'remote',   'rb'=>&$BUS_INTERIOR],
    'BOG-RCH'=>['v'=>[268000,432000],'b'=>[102000,150000],'dv'=>85, 'db'=>1080,'al'=>'regional','rb'=>&$BUS_COSTA],
    'BOG-UIB'=>['v'=>[258000,418000],'b'=>[null,null],    'dv'=>55, 'db'=>null,'al'=>'remote',  'rb'=>[]],
    'BOG-AUC'=>['v'=>[248000,402000],'b'=>[null,null],    'dv'=>60, 'db'=>null,'al'=>'remote',  'rb'=>[]],
    'BOG-EJA'=>['v'=>[218000,352000],'b'=>[62000,95000],  'dv'=>55, 'db'=>420,'al'=>'regional', 'rb'=>&$BUS_ORIENTE],
    'BOG-CZU'=>['v'=>[238000,385000],'b'=>[95000,138000], 'dv'=>60, 'db'=>780,'al'=>'regional', 'rb'=>&$BUS_COSTA],
    'BOG-APO'=>['v'=>[258000,418000],'b'=>[null,null],    'dv'=>60, 'db'=>null,'al'=>'remote',  'rb'=>[]],
    'BOG-TCC'=>['v'=>[282000,455000],'b'=>[null,null],    'dv'=>75, 'db'=>null,'al'=>'remote',  'rb'=>[]],
    'BOG-SJE'=>['v'=>[228000,368000],'b'=>[null,null],    'dv'=>60, 'db'=>null,'al'=>'remote',  'rb'=>[]],
    'BOG-PCR'=>['v'=>[348000,562000],'b'=>[null,null],    'dv'=>90, 'db'=>null,'al'=>'remote',  'rb'=>[]],
    /* ── Medellín ── */
    'MDE-CLO'=>['v'=>[202000,328000],'b'=>[55000,85000],  'dv'=>60, 'db'=>420,'al'=>'trunk',    'rb'=>&$BUS_INTERIOR],
    'MDE-CTG'=>['v'=>[238000,388000],'b'=>[97000,142000], 'dv'=>70, 'db'=>780,'al'=>'trunk',    'rb'=>&$BUS_COSTA],
    'MDE-BAQ'=>['v'=>[218000,355000],'b'=>[79000,118000], 'dv'=>65, 'db'=>660,'al'=>'trunk',    'rb'=>&$BUS_COSTA],
    'MDE-BGA'=>['v'=>[182000,298000],'b'=>[46000,70000],  'dv'=>45, 'db'=>360,'al'=>'regional', 'rb'=>&$BUS_ORIENTE],
    'MDE-MZL'=>['v'=>[178000,288000],'b'=>[33000,52000],  'dv'=>45, 'db'=>240,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'MDE-PEI'=>['v'=>[178000,288000],'b'=>[36000,57000],  'dv'=>40, 'db'=>270,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'MDE-AXM'=>['v'=>[178000,288000],'b'=>[33000,52000],  'dv'=>45, 'db'=>300,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'MDE-IBE'=>['v'=>[192000,312000],'b'=>[50000,77000],  'dv'=>50, 'db'=>360,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'MDE-CUC'=>['v'=>[202000,328000],'b'=>[65000,98000],  'dv'=>60, 'db'=>540,'al'=>'regional', 'rb'=>&$BUS_ORIENTE],
    'MDE-SMR'=>['v'=>[212000,345000],'b'=>[79000,118000], 'dv'=>65, 'db'=>720,'al'=>'regional', 'rb'=>&$BUS_COSTA],
    'MDE-HEI'=>['v'=>[202000,328000],'b'=>[65000,98000],  'dv'=>55, 'db'=>480,'al'=>'regional', 'rb'=>&$BUS_SUR],
    'MDE-VVC'=>['v'=>[192000,312000],'b'=>[69000,105000], 'dv'=>50, 'db'=>540,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'MDE-PSO'=>['v'=>[228000,372000],'b'=>[85000,128000], 'dv'=>75, 'db'=>720,'al'=>'regional', 'rb'=>&$BUS_SUR],
    'MDE-ADZ'=>['v'=>[318000,515000],'b'=>[null,null],    'dv'=>85, 'db'=>null,'al'=>'regional','rb'=>[]],
    'MDE-UIB'=>['v'=>[212000,345000],'b'=>[null,null],    'dv'=>35, 'db'=>null,'al'=>'remote',  'rb'=>[]],
    'MDE-VUP'=>['v'=>[238000,385000],'b'=>[null,null],    'dv'=>75, 'db'=>null,'al'=>'regional','rb'=>[]],
    /* ── Cali ── */
    'CLO-CTG'=>['v'=>[238000,388000],'b'=>[108000,158000],'dv'=>75, 'db'=>960,'al'=>'trunk',    'rb'=>&$BUS_COSTA],
    'CLO-BAQ'=>['v'=>[232000,378000],'b'=>[125000,178000],'dv'=>75, 'db'=>1200,'al'=>'trunk',   'rb'=>&$BUS_COSTA],
    'CLO-BGA'=>['v'=>[218000,355000],'b'=>[75000,112000], 'dv'=>70, 'db'=>540,'al'=>'regional', 'rb'=>&$BUS_ORIENTE],
    'CLO-IBE'=>['v'=>[null,null],    'b'=>[46000,70000],  'dv'=>null,'db'=>210,'al'=>null,      'rb'=>&$BUS_INTERIOR],
    'CLO-PEI'=>['v'=>[182000,298000],'b'=>[28000,44000],  'dv'=>45, 'db'=>180,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'CLO-MZL'=>['v'=>[182000,298000],'b'=>[34000,53000],  'dv'=>50, 'db'=>240,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'CLO-AXM'=>['v'=>[null,null],    'b'=>[30000,46000],  'dv'=>null,'db'=>150,'al'=>null,      'rb'=>&$BUS_INTERIOR],
    'CLO-PPN'=>['v'=>[null,null],    'b'=>[30000,46000],  'dv'=>null,'db'=>120,'al'=>null,      'rb'=>&$BUS_SUR],
    'CLO-HEI'=>['v'=>[202000,328000],'b'=>[65000,98000],  'dv'=>55, 'db'=>480,'al'=>'regional', 'rb'=>&$BUS_SUR],
    'CLO-PSO'=>['v'=>[212000,345000],'b'=>[58000,88000],  'dv'=>60, 'db'=>480,'al'=>'regional', 'rb'=>&$BUS_SUR],
    'CLO-VVC'=>['v'=>[212000,342000],'b'=>[79000,118000], 'dv'=>60, 'db'=>600,'al'=>'regional', 'rb'=>&$BUS_INTERIOR],
    'CLO-ADZ'=>['v'=>[348000,562000],'b'=>[null,null],    'dv'=>90, 'db'=>null,'al'=>'regional','rb'=>[]],
    'CLO-SMR'=>['v'=>[248000,402000],'b'=>[108000,158000],'dv'=>90, 'db'=>840,'al'=>'regional', 'rb'=>&$BUS_COSTA],
    /* ── Costa Caribe ── */
    'CTG-BAQ'=>['v'=>[182000,298000],'b'=>[40000,62000],  'dv'=>40, 'db'=>300,'al'=>'trunk',    'rb'=>&$BUS_COSTA],
    'CTG-SMR'=>['v'=>[172000,282000],'b'=>[33000,52000],  'dv'=>40, 'db'=>240,'al'=>'regional', 'rb'=>&$BUS_COSTA],
    'CTG-BGA'=>['v'=>[212000,345000],'b'=>[85000,128000], 'dv'=>60, 'db'=>600,'al'=>'regional', 'rb'=>&$BUS_ORIENTE],
    'CTG-VUP'=>['v'=>[182000,298000],'b'=>[75000,112000], 'dv'=>55, 'db'=>480,'al'=>'regional', 'rb'=>&$BUS_COSTA],
    'BAQ-SMR'=>['v'=>[null,null],    'b'=>[20000,30000],  'dv'=>null,'db'=>120,'al'=>null,      'rb'=>&$BUS_COSTA],
    'BAQ-CUC'=>['v'=>[178000,288000],'b'=>[46000,70000],  'dv'=>45, 'db'=>360,'al'=>'regional', 'rb'=>&$BUS_ORIENTE],
    'BAQ-VUP'=>['v'=>[172000,282000],'b'=>[36000,55000],  'dv'=>35, 'db'=>270,'al'=>'regional', 'rb'=>&$BUS_COSTA],
    'BAQ-RCH'=>['v'=>[162000,268000],'b'=>[28000,42000],  'dv'=>35, 'db'=>240,'al'=>'regional', 'rb'=>&$BUS_COSTA],
    'BAQ-MTR'=>['v'=>[null,null],    'b'=>[40000,62000],  'dv'=>null,'db'=>240,'al'=>null,      'rb'=>&$BUS_COSTA],
    'SMR-VUP'=>['v'=>[null,null],    'b'=>[28000,42000],  'dv'=>null,'db'=>180,'al'=>null,      'rb'=>&$BUS_COSTA],
    'SMR-BGA'=>['v'=>[182000,298000],'b'=>[72000,108000], 'dv'=>55, 'db'=>540,'al'=>'regional', 'rb'=>&$BUS_ORIENTE],
    'VUP-RCH'=>['v'=>[null,null],    'b'=>[26000,40000],  'dv'=>null,'db'=>180,'al'=>null,      'rb'=>&$BUS_COSTA],
    'VUP-BGA'=>['v'=>[182000,298000],'b'=>[82000,122000], 'dv'=>55, 'db'=>600,'al'=>'regional', 'rb'=>&$BUS_ORIENTE],
    /* ── Bucaramanga / Nororiente ── */
    'BGA-CUC'=>['v'=>[168000,272000],'b'=>[36000,56000],  'dv'=>45, 'db'=>300,'al'=>'regional', 'rb'=>&$BUS_ORIENTE],
    'BGA-SMR'=>['v'=>[182000,298000],'b'=>[72000,108000], 'dv'=>55, 'db'=>540,'al'=>'regional', 'rb'=>&$BUS_COSTA],
    /* ── Eje Cafetero ── */
    'PEI-MZL'=>['v'=>[null,null],    'b'=>[11000,17000],  'dv'=>null,'db'=>60, 'al'=>null,      'rb'=>&$BUS_INTERIOR],
    'PEI-AXM'=>['v'=>[null,null],    'b'=>[13000,20000],  'dv'=>null,'db'=>90, 'al'=>null,      'rb'=>&$BUS_INTERIOR],
    'MZL-AXM'=>['v'=>[null,null],    'b'=>[13000,20000],  'dv'=>null,'db'=>90, 'al'=>null,      'rb'=>&$BUS_INTERIOR],
    'IBE-PEI'=>['v'=>[null,null],    'b'=>[22000,34000],  'dv'=>null,'db'=>120,'al'=>null,      'rb'=>&$BUS_INTERIOR],
    'IBE-AXM'=>['v'=>[null,null],    'b'=>[26000,40000],  'dv'=>null,'db'=>150,'al'=>null,      'rb'=>&$BUS_INTERIOR],
    'IBE-MZL'=>['v'=>[null,null],    'b'=>[28000,43000],  'dv'=>null,'db'=>180,'al'=>null,      'rb'=>&$BUS_INTERIOR],
    'IBE-CLO'=>['v'=>[null,null],    'b'=>[46000,70000],  'dv'=>null,'db'=>210,'al'=>null,      'rb'=>&$BUS_INTERIOR],
    'IBE-HEI'=>['v'=>[null,null],    'b'=>[22000,34000],  'dv'=>null,'db'=>120,'al'=>null,      'rb'=>&$BUS_SUR],
    /* ── Sur / Pacífico ── */
    'HEI-PSO'=>['v'=>[212000,345000],'b'=>[52000,80000],  'dv'=>60, 'db'=>420,'al'=>'regional', 'rb'=>&$BUS_SUR],
    'HEI-CLO'=>['v'=>[202000,328000],'b'=>[65000,98000],  'dv'=>55, 'db'=>480,'al'=>'regional', 'rb'=>&$BUS_SUR],
    'PSO-PPN'=>['v'=>[null,null],    'b'=>[18000,28000],  'dv'=>null,'db'=>120,'al'=>null,      'rb'=>&$BUS_SUR],
    'FLA-PSO'=>['v'=>[202000,328000],'b'=>[52000,80000],  'dv'=>55, 'db'=>360,'al'=>'remote',   'rb'=>&$BUS_SUR],
    'PPN-CLO'=>['v'=>[null,null],    'b'=>[30000,46000],  'dv'=>null,'db'=>120,'al'=>null,      'rb'=>&$BUS_SUR],
    /* ── Llanos / Amazonía ── */
    'EYP-VVC'=>['v'=>[null,null],    'b'=>[30000,46000],  'dv'=>null,'db'=>180,'al'=>null,      'rb'=>&$BUS_INTERIOR],
    'EYP-AUC'=>['v'=>[null,null],    'b'=>[35000,52000],  'dv'=>null,'db'=>210,'al'=>null,      'rb'=>&$BUS_INTERIOR],
];

/* ── Lookup ruta (bidireccional) ─────────────────────────────────────────── */
function obtenerRuta(string $a, string $b, array &$RUTAS): ?array
{
    $k = "$a-$b"; $ki = "$b-$a";
    if (isset($RUTAS[$k]))  return array_merge($RUTAS[$k],  ['inv'=>false]);
    if (isset($RUTAS[$ki])) return array_merge($RUTAS[$ki], ['inv'=>true]);
    return null;
}

/* ── Generar opciones estimadas para una ruta con aeropuerto ─────────────── */
function generarOpciones(
    string $orgIata, string $dstIata, array $ruta, string $fecha, bool $esReg,
    array $alTrunk, array $alReg, array $alRem,
    array $slvTrunk, array $slvReg, array $slvRem, array $slBus
): array {
    $pre = $esReg ? 'reg' : 'ida';
    seedRuta($orgIata, $dstIata, $fecha);

    $alType = $ruta['al'] ?? null;
    $buses  = $ruta['rb'] ?? [];

    $aerols = match($alType) { 'trunk'=>$alTrunk, 'regional'=>$alReg, 'remote'=>$alRem, default=>[] };
    $slotsV = match($alType) { 'trunk'=>$slvTrunk, 'regional'=>$slvReg, 'remote'=>$slvRem, default=>[] };

    $minV = $ruta['v'][0] ?? null;
    $maxV = $ruta['v'][1] ?? null;
    $durV = $ruta['dv']   ?? null;
    $minB = $ruta['b'][0] ?? null;
    $maxB = $ruta['b'][1] ?? null;
    $durB = $ruta['db']   ?? null;

    $opciones = [];

    // ─ Vuelos ─
    if ($alType && $minV && $maxV && $durV && count($aerols) > 0) {
        $nV   = match($alType) { 'trunk' => mt_rand(4,6), 'regional' => mt_rand(3,5), default => mt_rand(2,3) };
        $slots = elegirSlots($slotsV, $nV + 2);
        sort($slots);
        $usadas = [];
        foreach (array_slice($slots, 0, $nV) as $i => $salida) {
            // Elegir aerolínea sin repetir consecutivamente
            do { $al = $aerols[array_rand($aerols)]; } while (count($aerols) > 1 && in_array($al, array_slice($usadas, -2)));
            $usadas[] = $al;
            $durVar  = $durV + mt_rand(-5, 12);
            $opciones[] = [
                'id'         => "{$pre}_v{$i}",
                'tipo'       => 'vuelo',
                'empresa'    => $al,
                'salida'     => $salida,
                'llegada'    => sumarMinutos($salida, $durVar),
                'duracion'   => minutosADur($durVar),
                'precio'     => precioRand($minV, $maxV),
                'esEstimado' => true,
            ];
        }
    }

    // ─ Buses ─
    if ($minB && $maxB && $durB && count($buses) > 0) {
        $nB    = mt_rand(3, min(5, count($buses) + 2));
        $slots = elegirSlots($slBus, $nB + 2);
        sort($slots);
        foreach (array_slice($slots, 0, $nB) as $i => $salida) {
            $empresa = $buses[$i % count($buses)];
            $durVar  = $durB + mt_rand(-15, 10);
            $opciones[] = [
                'id'         => "{$pre}_b{$i}",
                'tipo'       => 'bus',
                'empresa'    => $empresa,
                'salida'     => $salida,
                'llegada'    => sumarMinutos($salida, $durVar),
                'duracion'   => minutosADur($durVar),
                'precio'     => precioRand($minB, $maxB),
                'esEstimado' => true,
            ];
        }
    }

    usort($opciones, fn($a, $b) => $a['precio'] - $b['precio']);
    return $opciones;
}

/* ── Generar opciones multimodal (avión→bus o bus→avión) ─────────────────── */
function generarMultimodal(
    string $orgIata, string $orgNombre,
    string $aerIata,  string $aerNombre,
    string $municipio,
    int $busMinutos, int $busMin, int $busMax, array $busEmps,
    string $fecha, bool $esReg,
    array $rutaAerea,
    array $alTrunk, array $alReg, array $alRem,
    array $slvTrunk, array $slvReg, array $slvRem
): array {
    $pre    = $esReg ? 'mm_reg' : 'mm_ida';
    $alType = $rutaAerea['al'] ?? 'regional';
    $aerols = match($alType) { 'trunk'=>$alTrunk, 'remote'=>$alRem, default=>$alReg };
    $slotsV = match($alType) { 'trunk'=>$slvTrunk, 'remote'=>$slvRem, default=>$slvReg };
    $minV   = $rutaAerea['v'][0] ?? 240000;
    $maxV   = $rutaAerea['v'][1] ?? 400000;
    $durV   = $rutaAerea['dv']   ?? 75;

    seedRuta($orgIata, $aerIata, $fecha . '_mm');

    $n      = mt_rand(3, 5);
    $slots  = elegirSlots($slotsV, $n + 2);
    sort($slots);
    $ops    = [];

    foreach (array_slice($slots, 0, $n) as $i => $salidaP) {
        $al     = $aerols[array_rand($aerols)];
        $busEmp = $busEmps[array_rand($busEmps)];
        $durVol = $durV + mt_rand(-5, 10);
        $espera = mt_rand(30, 75); // tiempo entre aterrizar y tomar el bus

        if (!$esReg) {
            // IDA: vuelo primero, bus después
            $llegadaAer  = sumarMinutos($salidaP, $durVol);
            $salidaBus   = sumarMinutos($llegadaAer, $espera);
            $durBus      = $busMinutos + mt_rand(-10, 20);
            $llegadaFin  = sumarMinutos($salidaBus, $durBus);
            $tramos = [
                [
                    'tipo'    => 'vuelo',
                    'empresa' => $al,
                    'origen'  => "{$orgNombre} ({$orgIata})",
                    'destino' => "{$aerNombre} ({$aerIata})",
                    'salida'  => $salidaP,
                    'llegada' => $llegadaAer,
                    'duracion'=> minutosADur($durVol),
                    'precio'  => precioRand($minV, $maxV),
                ],
                [
                    'tipo'    => 'bus',
                    'empresa' => $busEmp,
                    'origen'  => $aerNombre,
                    'destino' => $municipio,
                    'salida'  => $salidaBus,
                    'llegada' => $llegadaFin,
                    'duracion'=> minutosADur($durBus),
                    'precio'  => precioRand($busMin, $busMax),
                ],
            ];
        } else {
            // REGRESO: bus primero desde municipio al aeropuerto, luego vuelo
            $durBus      = $busMinutos + mt_rand(-10, 20);
            $llegadaAer  = sumarMinutos($salidaP, $durBus);
            $salidaVuelo = sumarMinutos($llegadaAer, $espera);
            $llegadaFin  = sumarMinutos($salidaVuelo, $durVol);
            $tramos = [
                [
                    'tipo'    => 'bus',
                    'empresa' => $busEmp,
                    'origen'  => $municipio,
                    'destino' => $aerNombre,
                    'salida'  => $salidaP,
                    'llegada' => $llegadaAer,
                    'duracion'=> minutosADur($durBus),
                    'precio'  => precioRand($busMin, $busMax),
                ],
                [
                    'tipo'    => 'vuelo',
                    'empresa' => $al,
                    'origen'  => "{$aerNombre} ({$aerIata})",
                    'destino' => "{$orgNombre} ({$orgIata})",
                    'salida'  => $salidaVuelo,
                    'llegada' => $llegadaFin,
                    'duracion'=> minutosADur($durVol),
                    'precio'  => precioRand($minV, $maxV),
                ],
            ];
        }

        $durTotal    = $durVol + $espera + ($durBus ?? $busMinutos);
        $precioTotal = array_sum(array_column($tramos, 'precio'));

        $ops[] = [
            'id'          => "{$pre}_{$i}",
            'tipo'        => 'multimodal',
            'empresa'     => $tramos[0]['empresa'] . ' + ' . $tramos[1]['empresa'],
            'salida'      => $tramos[0]['salida'],
            'llegada'     => end($tramos)['llegada'],
            'duracion'    => minutosADur($durTotal),
            'precio'      => $precioTotal,
            'esEstimado'  => true,
            'tramos'      => $tramos,
            'notaRuta'    => "{$municipio} no tiene aeropuerto. La ruta óptima es " .
                             ($esReg
                                ? "bus {$municipio}→{$aerNombre} + vuelo {$aerNombre}→{$orgNombre}."
                                : "vuelo {$orgNombre}→{$aerNombre} + bus {$aerNombre}→{$municipio}."),
        ];
    }

    usort($ops, fn($a, $b) => $a['precio'] - $b['precio']);
    return $ops;
}

/* ── Opciones genéricas cuando la ruta no está en la tabla ──────────────── */
function generarGenericas(string $org, string $dst, string $fecha, bool $esReg): array
{
    $pre    = $esReg ? 'gen_reg' : 'gen_ida';
    $aerols = ['Avianca','LATAM Colombia','Wingo','JetSmart','EasyFly','Satena'];
    $buses  = ['Expreso Bolivariano','Expreso Brasilia','Copetran','Omega Ltda','Rápido Ochoa'];
    seedRuta($org, $dst, $fecha);

    $ops = [];
    $nV  = mt_rand(3, 5);
    $nB  = mt_rand(2, 4);
    $slV = ['06:10','08:30','10:00','12:30','15:00','17:30','19:00'];
    $slB = ['05:00','06:00','08:00','14:00','20:00','22:00'];

    $slotsV = elegirSlots($slV, $nV); sort($slotsV);
    $slotsB = elegirSlots($slB, $nB); sort($slotsB);

    foreach ($slotsV as $i => $sal) {
        $dur = mt_rand(45, 150);
        $ops[] = [
            'id'=>"{$pre}_v{$i}",'tipo'=>'vuelo','empresa'=>$aerols[$i % count($aerols)],
            'salida'=>$sal,'llegada'=>sumarMinutos($sal, $dur),
            'duracion'=>minutosADur($dur),'precio'=>precioRand(215000, 440000),'esEstimado'=>true,
        ];
    }
    foreach ($slotsB as $i => $sal) {
        $dur = mt_rand(240, 900);
        $ops[] = [
            'id'=>"{$pre}_b{$i}",'tipo'=>'bus','empresa'=>$buses[$i % count($buses)],
            'salida'=>$sal,'llegada'=>sumarMinutos($sal, $dur),
            'duracion'=>minutosADur($dur),'precio'=>precioRand(50000, 165000),'esEstimado'=>true,
        ];
    }
    usort($ops, fn($a, $b) => $a['precio'] - $b['precio']);
    return $ops;
}

/* ── Normalizar entradas ─────────────────────────────────────────────────── */
$origenNorm  = normCiudad($origenRaw);
$destinoNorm = normCiudad($destinoRaw);

$origenIata  = validarIata($origenRaw)  ? $origenRaw  : ($CIUDAD_IATA[$origenRaw]  ?? $CIUDAD_IATA[$origenNorm]  ?? null);
$destinoIata = validarIata($destinoRaw) ? $destinoRaw : ($CIUDAD_IATA[$destinoRaw] ?? $CIUDAD_IATA[$destinoNorm] ?? null);

$origenNombre  = ucwords(strtolower($origenRaw));
$destinoNombre = ucwords(strtolower($destinoRaw));

// Detectar si origen/destino son municipios sin aeropuerto propio
$destinoSinAerop = (!$destinoIata)
    ? ($MUNICIPIOS_SIN_AEROPUERTO[$destinoRaw] ?? $MUNICIPIOS_SIN_AEROPUERTO[$destinoNorm] ?? null)
    : null;
$origenSinAerop  = (!$origenIata)
    ? ($MUNICIPIOS_SIN_AEROPUERTO[$origenRaw] ?? $MUNICIPIOS_SIN_AEROPUERTO[$origenNorm] ?? null)
    : null;

// Si el origen es un municipio sin aeropuerto, para la ruta aérea usamos su aeropuerto más cercano
if ($origenSinAerop && !$origenIata) $origenIata = $origenSinAerop[0];
if ($destinoSinAerop && !$destinoIata) $destinoIata = $destinoSinAerop[0];

/* ── Intentar Amadeus API ────────────────────────────────────────────────── */
$clientId     = (string) Config::get('AMADEUS_CLIENT_ID',     '');
$clientSecret = (string) Config::get('AMADEUS_CLIENT_SECRET', '');
$opcionesIda     = [];
$opcionesRegreso = [];
$fuente          = 'estimado';

if ($clientId && $clientSecret && $origenIata && $destinoIata && validarIata($origenIata) && validarIata($destinoIata)) {
    try {
        $ch = curl_init('https://test.api.amadeus.com/v1/security/oauth2/token');
        curl_setopt_array($ch, [
            CURLOPT_POST=>true, CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>8,
            CURLOPT_POSTFIELDS=>http_build_query(['grant_type'=>'client_credentials','client_id'=>$clientId,'client_secret'=>$clientSecret]),
            CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded'],
        ]);
        $tokenRaw = curl_exec($ch); $tokenErr = curl_error($ch); curl_close($ch);
        if ($tokenErr || !$tokenRaw) throw new RuntimeException('Amadeus token: '.$tokenErr);
        $tokenData = json_decode((string)$tokenRaw, true);
        $token = $tokenData['access_token'] ?? '';
        if (!$token) throw new RuntimeException('Amadeus: sin token');

        $AIRLINES_MAP = ['AV'=>'Avianca','LA'=>'LATAM Colombia','P5'=>'LATAM Colombia',
                         '5Z'=>'JetSmart','9R'=>'JetSmart','KR'=>'Copa Airlines','P9'=>'Wingo',
                         'S9'=>'EasyFly','RC'=>'Satena'];

        function buscarAmadeus(string $token, string $org, string $dst, string $fecha, array $AL): array {
            $url = 'https://test.api.amadeus.com/v2/shopping/flight-offers?' . http_build_query(
                ['originLocationCode'=>$org,'destinationLocationCode'=>$dst,'departureDate'=>$fecha,'adults'=>1,'currencyCode'=>'COP','max'=>8]
            );
            $ch2 = curl_init($url);
            curl_setopt_array($ch2,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10,
                CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$token]]);
            $raw = curl_exec($ch2); $err = curl_error($ch2); curl_close($ch2);
            if ($err || !$raw) throw new RuntimeException('Amadeus flights: '.$err);
            $data = json_decode((string)$raw, true);
            $ops  = [];
            foreach (($data['data'] ?? []) as $i => $offer) {
                $it  = $offer['itineraries'][0] ?? null; if (!$it) continue;
                $s0  = $it['segments'][0] ?? null;       if (!$s0) continue;
                $end = end($it['segments']);
                $cod = $s0['carrierCode'] ?? '';
                preg_match('/PT(\d+H)?(\d+M)?/', $it['duration'] ?? 'PT1H', $dm);
                $h = isset($dm[1]) ? (int)$dm[1] : 0;
                $m = isset($dm[2]) ? (int)$dm[2] : 0;
                $ops[] = [
                    'id'         => "ama_{$i}",
                    'tipo'       => count($it['segments']) > 1 ? 'vuelo_escala' : 'vuelo',
                    'empresa'    => $AL[$cod] ?? ($cod ?: 'Aerolínea'),
                    'salida'     => substr($s0['departure']['at'] ?? '', 11, 5),
                    'llegada'    => substr($end['arrival']['at'] ?? '', 11, 5),
                    'duracion'   => trim(($h ? "{$h}h " : '') . ($m ? "{$m}m" : '')) ?: '—',
                    'precio'     => (int) round((float)($offer['price']['grandTotal'] ?? 0)),
                    'esEstimado' => false,
                ];
            }
            usort($ops, fn($a,$b) => $a['precio'] - $b['precio']);
            return $ops;
        }

        $opcionesIda = buscarAmadeus($token, $origenIata, $destinoIata, $fechaIda, $AIRLINES_MAP);
        if ($fechaRegreso) $opcionesRegreso = buscarAmadeus($token, $destinoIata, $origenIata, $fechaRegreso, $AIRLINES_MAP);
        $fuente = 'api';

    } catch (Throwable $e) {
        error_log('[gestordoc][viajes] Amadeus falló: ' . $e->getMessage() . ' — usando estimados.');
        $opcionesIda = []; $opcionesRegreso = []; $fuente = 'estimado';
    }
}

/* ── Fallback a simulación enriquecida ───────────────────────────────────── */
if (empty($opcionesIda)) {

    if ($destinoSinAerop && $origenIata) {
        /* ─ Destino es municipio sin aeropuerto → multimodal IDA ─ */
        [$aerIata,$aerNombre,$busMins,$busMin,$busMax,$busEmps] = $destinoSinAerop;
        $rutaAerea = obtenerRuta($origenIata, $aerIata, $RUTAS)
            ?? ['v'=>[240000,400000],'b'=>[null,null],'dv'=>75,'db'=>null,'al'=>'regional','rb'=>[]];

        $opcionesIda = generarMultimodal(
            $origenIata, $origenNombre, $aerIata, $aerNombre, $destinoNombre,
            $busMins, $busMin, $busMax, $busEmps,
            $fechaIda, false, $rutaAerea,
            $AL_TRUNK, $AL_REGIONAL, $AL_REMOTE, $SLV_TRUNK, $SLV_REGIONAL, $SLV_REMOTE
        );

        /* Agregar también opciones de bus directo si son razonables (<6h) */
        if ($busMins <= 360 && $rutaAerea['b'][0] ?? null) {
            seedRuta($origenIata, $destinoNombre, $fechaIda . '_busd');
            $durTotalBus = ($rutaAerea['db'] ?? 480) + $busMins;
            $busesDir    = array_merge($busEmps, ($rutaAerea['rb'] ?? []));
            $slotsBusDir = elegirSlots($SL_BUS, 3); sort($slotsBusDir);
            foreach ($slotsBusDir as $bi => $salida) {
                $durVar = $durTotalBus + mt_rand(-20, 15);
                $opcionesIda[] = [
                    'id'         => "busd_ida_{$bi}",
                    'tipo'       => 'bus',
                    'empresa'    => $busesDir[$bi % count($busesDir)],
                    'salida'     => $salida,
                    'llegada'    => sumarMinutos($salida, $durVar),
                    'duracion'   => minutosADur($durVar),
                    'precio'     => precioRand((int)($rutaAerea['b'][0] * 0.9) + $busMin, (int)($rutaAerea['b'][1] * 1.1) + $busMax),
                    'esEstimado' => true,
                ];
            }
        }

        if ($fechaRegreso) {
            $opcionesRegreso = generarMultimodal(
                $origenIata, $origenNombre, $aerIata, $aerNombre, $destinoNombre,
                $busMins, $busMin, $busMax, $busEmps,
                $fechaRegreso, true, $rutaAerea,
                $AL_TRUNK, $AL_REGIONAL, $AL_REMOTE, $SLV_TRUNK, $SLV_REGIONAL, $SLV_REMOTE
            );
        }

    } elseif ($origenIata && $destinoIata) {
        /* ─ Ruta estándar (ambos tienen aeropuerto) ─ */
        $ruta = obtenerRuta($origenIata, $destinoIata, $RUTAS);
        if ($ruta) {
            $opcionesIda = generarOpciones(
                $origenIata, $destinoIata, $ruta, $fechaIda, false,
                $AL_TRUNK, $AL_REGIONAL, $AL_REMOTE,
                $SLV_TRUNK, $SLV_REGIONAL, $SLV_REMOTE, $SL_BUS
            );
            if ($fechaRegreso) {
                $opcionesRegreso = generarOpciones(
                    $destinoIata, $origenIata, $ruta, $fechaRegreso, true,
                    $AL_TRUNK, $AL_REGIONAL, $AL_REMOTE,
                    $SLV_TRUNK, $SLV_REGIONAL, $SLV_REMOTE, $SL_BUS
                );
            }
        } else {
            $opcionesIda = generarGenericas($origenIata, $destinoIata, $fechaIda, false);
            if ($fechaRegreso) $opcionesRegreso = generarGenericas($destinoIata, $origenIata, $fechaRegreso, true);
        }
    } else {
        /* ─ Ciudades completamente desconocidas ─ */
        $orgKey = $origenIata ?: $origenNorm;
        $dstKey = $destinoIata ?: $destinoNorm;
        $opcionesIda = generarGenericas($orgKey, $dstKey, $fechaIda, false);
        if ($fechaRegreso) $opcionesRegreso = generarGenericas($dstKey, $orgKey, $fechaRegreso, true);
    }
}

// Ordenar final: vuelo primero (más rápido), luego multimodal, luego bus directo
$tipoOrd = ['vuelo' => 0, 'multimodal' => 1, 'bus' => 2];
$sortFn  = fn($a, $b) =>
    ($tipoOrd[$a['tipo']] ?? 2) <=> ($tipoOrd[$b['tipo']] ?? 2)
    ?: $a['precio'] <=> $b['precio'];
usort($opcionesIda,     $sortFn);
usort($opcionesRegreso, $sortFn);

Response::json([
    'opciones'           => $opcionesIda,
    'opcionesRegreso'    => $opcionesRegreso,
    'fuente'             => $fuente,
    'origenNombre'       => $origenNombre,
    'destinoNombre'      => $destinoNombre,
    'esMultimodal'       => $destinoSinAerop !== null,
    'aeropuertoConexion' => $destinoSinAerop ? $destinoSinAerop[1] : null,
]);
