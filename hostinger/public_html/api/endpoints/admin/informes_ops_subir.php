<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

$admin = Auth::requireAdmin();
$uid   = (int)($admin['jwt']['sub'] ?? 0);

$nombre         = trim((string)($_POST['nombre']         ?? ''));
$periodoInicio  = trim((string)($_POST['periodoInicio']  ?? ''));
$periodoFin     = trim((string)($_POST['periodoFin']     ?? ''));
$tipoPlantilla  = trim((string)($_POST['tipoPlantilla']  ?? 'ppl'));

if (!$nombre) Response::error('El nombre del informe es obligatorio', 400);
if (!in_array($tipoPlantilla, ['ppl', 'servicio'], true)) $tipoPlantilla = 'ppl';

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

// Parsear encabezado
$enc = array_map(fn($h) => mb_strtolower(trim(str_replace(['"', "'"], '', $h))), str_getcsv($lineas[0]));

// ── Alias de columnas según tipo de plantilla ──────────────────────────────
$aliasComun = [
    'cc_profesional' => ['cc_profesional','cc profesional','cedula profesional','cedula_profesional','cc','numero_cc','numero cc'],
    'servicio'       => ['servicio','tipo_servicio','tipo servicio','nombre_servicio','nombre servicio'],
];

$aliasPpl = [
    'fecha_atencion'  => ['fecha_atencion','fecha atencion','fecha','dia','fecha de la atencion','fecha_de_atencion'],
    'regional'        => ['regional'],
    'establecimiento' => ['establecimiento','sede','ips','institucion'],
    'cc_paciente'     => ['cc_paciente','cc paciente','cedula paciente','cedula_paciente','id_paciente','documento_paciente','numero_identificacion'],
];

$aliasServicio = [
    'nombres_paciente'   => ['nombres_paciente','nombres paciente','nombres','primer_nombre','nombre_paciente'],
    'apellidos_paciente' => ['apellidos_paciente','apellidos paciente','apellidos','primer_apellido','apellido_paciente'],
    'cc_paciente'        => ['cc_paciente','cc paciente','cedula paciente','cedula_paciente','numero_identificacion','documento_paciente','identificacion','id_paciente'],
    'numero_sesiones'    => ['numero_sesiones','numero sesiones','sesiones','num_sesiones','num sesiones','cantidad','cantidad_sesiones'],
];

$allAlias = $aliasComun + ($tipoPlantilla === 'ppl' ? $aliasPpl : $aliasServicio);

$cols = [];
foreach ($allAlias as $campo => $nombres) {
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

// ── Helpers ────────────────────────────────────────────────────────────────
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

// ── Insertar registro padre ────────────────────────────────────────────────
$stmt = $pdo->prepare(
    "INSERT INTO informes_ops (nombre, periodo_inicio, periodo_fin, total_filas, subido_por_id, tipo_plantilla)
     VALUES (:nom, :pi, :pf, 0, :uid, :tp)"
);
$stmt->execute([
    ':nom' => $nombre,
    ':pi'  => $periodoInicio ?: null,
    ':pf'  => $periodoFin    ?: null,
    ':uid' => $uid           ?: null,
    ':tp'  => $tipoPlantilla,
]);
$informeId = (int)$pdo->lastInsertId();

// ── Insertar filas en lotes de 500 ────────────────────────────────────────
$total  = 0;
$batch  = [];

$insSQLppl = "INSERT INTO informe_atenciones_detalle
    (informe_id, cc_profesional, fecha_atencion, regional, establecimiento, cc_paciente, servicio, numero_sesiones)
    VALUES ";

$insSQLserv = "INSERT INTO informe_atenciones_detalle
    (informe_id, cc_profesional, nombres_paciente, apellidos_paciente, cc_paciente, servicio, numero_sesiones)
    VALUES ";

$insSQL = $tipoPlantilla === 'ppl' ? $insSQLppl : $insSQLserv;

$flush = function() use (&$batch, &$total, $pdo, $insSQL, $informeId, $tipoPlantilla) {
    if (!$batch) return;
    $ph = [];
    $pm = [];
    foreach ($batch as $i => $r) {
        if ($tipoPlantilla === 'ppl') {
            $ph[] = "(:inf{$i},:cc{$i},:fa{$i},:reg{$i},:est{$i},:cp{$i},:sv{$i},:ns{$i})";
            $pm  += [":inf{$i}"=>$informeId,":cc{$i}"=>$r['cc'],":fa{$i}"=>$r['fa'],
                     ":reg{$i}"=>$r['reg'],":est{$i}"=>$r['est'],":cp{$i}"=>$r['cp'],
                     ":sv{$i}"=>$r['sv'],":ns{$i}"=>$r['ns']];
        } else {
            $ph[] = "(:inf{$i},:cc{$i},:np{$i},:ap{$i},:cp{$i},:sv{$i},:ns{$i})";
            $pm  += [":inf{$i}"=>$informeId,":cc{$i}"=>$r['cc'],":np{$i}"=>$r['np'],
                     ":ap{$i}"=>$r['ap'],":cp{$i}"=>$r['cp'],
                     ":sv{$i}"=>$r['sv'],":ns{$i}"=>$r['ns']];
        }
    }
    $pdo->prepare($insSQL . implode(',', $ph))->execute($pm);
    $total += array_sum(array_column($batch, 'ns'));
    $batch  = [];
};

for ($i = 1, $n = count($lineas); $i < $n; $i++) {
    $f  = str_getcsv($lineas[$i]);
    $cc = $normCC((string)($f[$cols['cc_profesional']] ?? ''));
    if (!$cc) continue;

    $sv = isset($cols['servicio']) ? $normServ((string)($f[$cols['servicio']] ?? '')) : '';
    $ns = max(1, (int)($f[$cols['numero_sesiones'] ?? -1] ?? 1));

    if ($tipoPlantilla === 'ppl') {
        // PPL: cada fila = 1 atención (ns siempre 1, regional/sede/fecha/cc_paciente)
        $batch[] = [
            'cc'  => $cc,
            'fa'  => isset($cols['fecha_atencion'])  ? $parseDate((string)($f[$cols['fecha_atencion']]  ?? '')) : null,
            'reg' => isset($cols['regional'])         ? $normStr((string)($f[$cols['regional']]    ?? '')) : null,
            'est' => isset($cols['establecimiento'])  ? $normStr((string)($f[$cols['establecimiento']] ?? '')) : null,
            'cp'  => isset($cols['cc_paciente'])      ? $normCC((string)($f[$cols['cc_paciente']]   ?? '')) : null,
            'sv'  => $sv ?: null,
            'ns'  => 1,
        ];
    } else {
        // Por servicio: nombres/apellidos + cc_paciente + servicio + numero_sesiones
        $batch[] = [
            'cc'  => $cc,
            'np'  => isset($cols['nombres_paciente'])   ? $normStr((string)($f[$cols['nombres_paciente']]   ?? '')) : null,
            'ap'  => isset($cols['apellidos_paciente'])  ? $normStr((string)($f[$cols['apellidos_paciente']]  ?? '')) : null,
            'cp'  => isset($cols['cc_paciente'])         ? $normCC((string)($f[$cols['cc_paciente']]          ?? '')) : null,
            'sv'  => $sv ?: null,
            'ns'  => $ns,
        ];
    }

    if (count($batch) >= 500) $flush();
}
$flush();

// ── Actualizar total_filas (suma de sesiones) ──────────────────────────────
$sumStmt = $pdo->prepare("SELECT COALESCE(SUM(numero_sesiones),0) FROM informe_atenciones_detalle WHERE informe_id = :id");
$sumStmt->execute([':id' => $informeId]);
$totalSesiones = (int)$sumStmt->fetchColumn();
$pdo->prepare("UPDATE informes_ops SET total_filas = :t WHERE id = :id")->execute([':t' => $totalSesiones, ':id' => $informeId]);

Response::json([
    'id'            => $informeId,
    'nombre'        => $nombre,
    'totalFilas'    => $totalSesiones,
    'tipoPlantilla' => $tipoPlantilla,
    'periodoInicio' => $periodoInicio ?: null,
    'periodoFin'    => $periodoFin    ?: null,
], 201);
