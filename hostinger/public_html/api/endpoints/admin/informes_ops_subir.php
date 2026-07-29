<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

$admin = Auth::requireAdmin();
$uid   = (int)($admin['jwt']['sub'] ?? 0);

$nombre        = trim((string)($_POST['nombre']        ?? ''));
$periodoInicio = trim((string)($_POST['periodoInicio'] ?? ''));
$periodoFin    = trim((string)($_POST['periodoFin']    ?? ''));
$plataforma    = trim((string)($_POST['plataforma']    ?? ''));

if (!$nombre) Response::error('El nombre del informe es obligatorio', 400);

$plataformasValidas = ['360', 'panacea'];
if (!in_array($plataforma, $plataformasValidas, true)) $plataforma = null;

if (empty($_FILES['archivo']) || ($_FILES['archivo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    Response::error('Debes adjuntar el archivo CSV del informe', 400);
}

$tmpPath = $_FILES['archivo']['tmp_name'];
if (!is_uploaded_file($tmpPath)) Response::error('Error al recibir el archivo', 400);

$contenido = file_get_contents($tmpPath);
if ($contenido === false) Response::error('No se pudo leer el archivo', 500);

// Eliminar BOM UTF-8 y normalizar saltos de línea
$contenido = ltrim($contenido, "\xEF\xBB\xBF");
$lineas    = preg_split('/\r\n|\r|\n/', $contenido);
$lineas    = array_values(array_filter(array_map('trim', $lineas), fn($l) => $l !== ''));

if (count($lineas) < 2) Response::error('El archivo está vacío o solo tiene encabezado', 400);

// Auto-detectar delimitador (;  ,  o tab)
$headerLine = $lineas[0];
$cSemi  = substr_count($headerLine, ';');
$cComma = substr_count($headerLine, ',');
$cTab   = substr_count($headerLine, "\t");
$delim  = ';';
if ($cComma > $cSemi && $cComma > $cTab)      $delim = ',';
elseif ($cTab > $cSemi && $cTab > $cComma)    $delim = "\t";

// Parsear encabezado
$enc = array_map(fn($h) => mb_strtolower(trim(str_replace(['"', "'"], '', $h))), str_getcsv($headerLine, $delim));

// Alias de columnas del formato unificado
$alias = [
    'cc_profesional'     => ['cc_profesional','cc profesional','cedula profesional','cedula_profesional','cc','numero_cc'],
    'fecha_atencion'     => ['fecha_atencion','fecha atencion','fecha','dia','fecha_de_atencion'],
    'nombres_paciente'   => ['nombres_paciente','nombres paciente','nombres','primer_nombre','nombre_paciente'],
    'apellidos_paciente' => ['apellidos_paciente','apellidos paciente','apellidos','primer_apellido','apellido_paciente'],
    'cc_paciente'        => ['cc_paciente','cc paciente','cedula paciente','cedula_paciente','id_paciente','documento_paciente','identificacion'],
    'servicio'           => ['servicio','tipo_servicio','tipo servicio','nombre_servicio'],
    'numero_historia'    => ['numero_historia','numero historia','num_historia','historia','n_historia','historia_clinica','hc','num_hc'],
];

$cols = [];
foreach ($alias as $campo => $nombres) {
    foreach ($nombres as $n) {
        $idx = array_search($n, $enc, true);
        if ($idx !== false) { $cols[$campo] = (int)$idx; break; }
    }
}

if (!isset($cols['cc_profesional'])) {
    Response::error(
        "No se encontró la columna requerida 'cc_profesional'. Columnas detectadas: " . implode(', ', $enc),
        400
    );
}

// Helpers
$normCC   = fn(string $v): string => preg_replace('/[^0-9]/', '', $v);
$normStr  = fn(string $v, int $max = 200): string => mb_substr(trim($v), 0, $max);
$normServ = fn(string $v): string => mb_strtoupper(trim($v));

$parseDate = function(string $v): ?string {
    $v = trim($v);
    if (!$v) return null;
    foreach (['Y-m-d','d/m/Y','m/d/Y','d-m-Y','Y/m/d'] as $fmt) {
        $dt = DateTime::createFromFormat($fmt, $v);
        if ($dt !== false) return $dt->format('Y-m-d');
    }
    $ts = strtotime($v);
    return $ts !== false ? date('Y-m-d', $ts) : null;
};

$pdo = Db::pdo();

// Detectar columnas disponibles (migración 017 puede estar pendiente)
$colsOps = array_column($pdo->query("SHOW COLUMNS FROM informes_ops")->fetchAll(), 'Field');
$tienePlataforma = in_array('plataforma', $colsOps, true);

$colsDet = array_column($pdo->query("SHOW COLUMNS FROM informe_atenciones_detalle")->fetchAll(), 'Field');
$tieneHistoria = in_array('numero_historia', $colsDet, true);

// Insertar registro padre
$sqlInsOps = $tienePlataforma
    ? "INSERT INTO informes_ops (nombre, periodo_inicio, periodo_fin, total_filas, subido_por_id, tipo_plantilla, plataforma) VALUES (:nom, :pi, :pf, 0, :uid, 'servicio', :pl)"
    : "INSERT INTO informes_ops (nombre, periodo_inicio, periodo_fin, total_filas, subido_por_id, tipo_plantilla) VALUES (:nom, :pi, :pf, 0, :uid, 'servicio')";
$stmt = $pdo->prepare($sqlInsOps);
$params = [':nom' => $nombre, ':pi' => $periodoInicio ?: null, ':pf' => $periodoFin ?: null, ':uid' => $uid ?: null];
if ($tienePlataforma) $params[':pl'] = $plataforma;
$stmt->execute($params);
$informeId = (int)$pdo->lastInsertId();

// Insertar filas en lotes de 500 — cada fila = 1 atención
// INSERT IGNORE evita duplicados por numero_historia único (si la columna existe)
$total = 0;
$batch = [];

$insSQL = $tieneHistoria
    ? "INSERT IGNORE INTO informe_atenciones_detalle (informe_id, cc_profesional, fecha_atencion, nombres_paciente, apellidos_paciente, cc_paciente, servicio, numero_historia, numero_sesiones) VALUES "
    : "INSERT INTO informe_atenciones_detalle (informe_id, cc_profesional, fecha_atencion, nombres_paciente, apellidos_paciente, cc_paciente, servicio, numero_sesiones) VALUES ";

$flush = function() use (&$batch, &$total, $pdo, $insSQL, $informeId, $tieneHistoria) {
    if (!$batch) return;
    $ph = [];
    $pm = [];
    foreach ($batch as $i => $r) {
        if ($tieneHistoria) {
            $ph[] = "(:inf{$i},:cc{$i},:fa{$i},:np{$i},:ap{$i},:cp{$i},:sv{$i},:nh{$i},1)";
            $pm  += [":inf{$i}"=>$informeId,":cc{$i}"=>$r['cc'],":fa{$i}"=>$r['fa'],
                     ":np{$i}"=>$r['np'],":ap{$i}"=>$r['ap'],":cp{$i}"=>$r['cp'],
                     ":sv{$i}"=>$r['sv'],":nh{$i}"=>$r['nh']];
        } else {
            $ph[] = "(:inf{$i},:cc{$i},:fa{$i},:np{$i},:ap{$i},:cp{$i},:sv{$i},1)";
            $pm  += [":inf{$i}"=>$informeId,":cc{$i}"=>$r['cc'],":fa{$i}"=>$r['fa'],
                     ":np{$i}"=>$r['np'],":ap{$i}"=>$r['ap'],":cp{$i}"=>$r['cp'],
                     ":sv{$i}"=>$r['sv']];
        }
    }
    $stmt = $pdo->prepare($insSQL . implode(',', $ph));
    $stmt->execute($pm);
    $total += $stmt->rowCount();
    $batch  = [];
};

for ($i = 1, $n = count($lineas); $i < $n; $i++) {
    $f  = str_getcsv($lineas[$i], $delim);
    $cc = $normCC((string)($f[$cols['cc_profesional']] ?? ''));
    if (!$cc) continue;

    $nh = isset($cols['numero_historia']) ? $normStr((string)($f[$cols['numero_historia']] ?? ''), 50) : null;
    if ($nh === '') $nh = null;

    $batch[] = [
        'cc' => $cc,
        'fa' => isset($cols['fecha_atencion'])     ? $parseDate((string)($f[$cols['fecha_atencion']]     ?? '')) : null,
        'np' => isset($cols['nombres_paciente'])   ? $normStr((string)($f[$cols['nombres_paciente']]   ?? '')) : null,
        'ap' => isset($cols['apellidos_paciente']) ? $normStr((string)($f[$cols['apellidos_paciente']] ?? '')) : null,
        'cp' => isset($cols['cc_paciente'])        ? $normCC((string)($f[$cols['cc_paciente']]         ?? '')) : null,
        'sv' => isset($cols['servicio'])           ? $normServ((string)($f[$cols['servicio']]           ?? '')) : null,
        'nh' => $nh,
    ];

    if (count($batch) >= 500) $flush();
}
$flush();

// Actualizar total_filas con el conteo real de filas insertadas
$pdo->prepare("UPDATE informes_ops SET total_filas = :t WHERE id = :id")->execute([':t' => $total, ':id' => $informeId]);

Response::json([
    'id'            => $informeId,
    'nombre'        => $nombre,
    'totalFilas'    => $total,
    'periodoInicio' => $periodoInicio ?: null,
    'periodoFin'    => $periodoFin    ?: null,
], 201);
