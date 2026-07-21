<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

$admin = Auth::requireAdmin();
$uid   = (int)($admin['jwt']['sub'] ?? 0);

// Campos de texto
$nombre       = trim((string)($_POST['nombre'] ?? ''));
$periodoInicio = trim((string)($_POST['periodoInicio'] ?? ''));
$periodoFin    = trim((string)($_POST['periodoFin'] ?? ''));

if (!$nombre) {
    Response::error('El nombre del informe es obligatorio', 400);
}

// Archivo CSV
if (empty($_FILES['archivo']) || ($_FILES['archivo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    Response::error('Debes adjuntar el archivo CSV del informe', 400);
}

$tmpPath = $_FILES['archivo']['tmp_name'];
if (!is_uploaded_file($tmpPath)) {
    Response::error('Error al recibir el archivo', 400);
}

// Leer el CSV
$contenido = file_get_contents($tmpPath);
if ($contenido === false) {
    Response::error('No se pudo leer el archivo', 500);
}

// Eliminar BOM UTF-8 si existe
$contenido = ltrim($contenido, "\xEF\xBB\xBF");

// Normalizar saltos de línea y dividir en líneas
$lineas = preg_split('/\r\n|\r|\n/', $contenido);
$lineas = array_values(array_filter(array_map('trim', $lineas), fn($l) => $l !== ''));

if (count($lineas) < 2) {
    Response::error('El archivo está vacío o solo tiene encabezado', 400);
}

// Parsear encabezado (primera fila)
$encabezado = array_map(fn($h) => mb_strtolower(trim(str_replace(['"', "'"], '', $h))), str_getcsv($lineas[0]));

// Mapear columnas requeridas (acepta variantes de nombre)
$alias = [
    'cc_profesional'  => ['cc_profesional', 'cc profesional', 'cedula profesional', 'cedula_profesional', 'cc', 'numero_cc', 'numero cc'],
    'fecha_atencion'  => ['fecha_atencion', 'fecha atencion', 'fecha', 'dia', 'fecha_de_atencion', 'fecha de la atencion'],
    'regional'        => ['regional'],
    'establecimiento' => ['establecimiento', 'sede', 'ips', 'institucion'],
    'cc_paciente'     => ['cc_paciente', 'cc paciente', 'cedula paciente', 'cedula_paciente', 'id_paciente', 'documento_paciente'],
];

$cols = [];
foreach ($alias as $campo => $nombres) {
    foreach ($nombres as $n) {
        $idx = array_search($n, $encabezado, true);
        if ($idx !== false) {
            $cols[$campo] = (int)$idx;
            break;
        }
    }
}

$requeridos = ['cc_profesional'];
foreach ($requeridos as $req) {
    if (!isset($cols[$req])) {
        Response::error("No se encontró la columna requerida '{$req}' en el encabezado. Columnas detectadas: " . implode(', ', $encabezado), 400);
    }
}

// Función para normalizar CC (solo dígitos)
$normCC = fn(string $v): string => preg_replace('/[^0-9]/', '', $v);

// Función para parsear fechas en varios formatos
$parseDate = function(string $v): ?string {
    $v = trim($v);
    if (!$v) return null;
    foreach (['Y-m-d', 'd/m/Y', 'm/d/Y', 'd-m-Y', 'Y/m/d'] as $fmt) {
        $dt = DateTime::createFromFormat($fmt, $v);
        if ($dt !== false) return $dt->format('Y-m-d');
    }
    // Intentar strtotime como último recurso
    $ts = strtotime($v);
    if ($ts !== false) return date('Y-m-d', $ts);
    return null;
};

$pdo = Db::pdo();

// Insertar registro padre
$stmt = $pdo->prepare(
    "INSERT INTO informes_ops (nombre, periodo_inicio, periodo_fin, total_filas, subido_por_id)
     VALUES (:nom, :pi, :pf, 0, :uid)"
);
$stmt->execute([
    ':nom' => $nombre,
    ':pi'  => $periodoInicio ?: null,
    ':pf'  => $periodoFin   ?: null,
    ':uid' => $uid ?: null,
]);
$informeId = (int)$pdo->lastInsertId();

// Insertar filas en lotes de 500
$total = 0;
$batch = [];
$insSQL = "INSERT INTO informe_atenciones_detalle (informe_id, cc_profesional, fecha_atencion, regional, establecimiento, cc_paciente) VALUES ";

$flush = function() use (&$batch, &$total, $pdo, $insSQL, $informeId) {
    if (!$batch) return;
    $placeholders = [];
    $params = [];
    foreach ($batch as $i => $row) {
        $placeholders[] = "(:inf{$i}, :cc{$i}, :fa{$i}, :reg{$i}, :est{$i}, :cp{$i})";
        $params[":inf{$i}"]  = $informeId;
        $params[":cc{$i}"]   = $row['cc'];
        $params[":fa{$i}"]   = $row['fa'];
        $params[":reg{$i}"]  = $row['regional'];
        $params[":est{$i}"]  = $row['est'];
        $params[":cp{$i}"]   = $row['cp'];
    }
    $pdo->prepare($insSQL . implode(', ', $placeholders))->execute($params);
    $total += count($batch);
    $batch = [];
};

for ($i = 1; $i < count($lineas); $i++) {
    $fila = str_getcsv($lineas[$i]);
    $cc = isset($cols['cc_profesional']) ? $normCC((string)($fila[$cols['cc_profesional']] ?? '')) : '';
    if (!$cc) continue; // saltar filas sin CC

    $batch[] = [
        'cc'      => $cc,
        'fa'      => isset($cols['fecha_atencion']) ? $parseDate((string)($fila[$cols['fecha_atencion']] ?? '')) : null,
        'regional' => isset($cols['regional']) ? mb_substr(trim((string)($fila[$cols['regional']] ?? '')), 0, 200) : null,
        'est'     => isset($cols['establecimiento']) ? mb_substr(trim((string)($fila[$cols['establecimiento']] ?? '')), 0, 200) : null,
        'cp'      => isset($cols['cc_paciente']) ? $normCC((string)($fila[$cols['cc_paciente']] ?? '')) : null,
    ];

    if (count($batch) >= 500) $flush();
}
$flush();

// Actualizar total_filas
$pdo->prepare("UPDATE informes_ops SET total_filas = :t WHERE id = :id")->execute([':t' => $total, ':id' => $informeId]);

Response::json([
    'id'          => $informeId,
    'nombre'      => $nombre,
    'totalFilas'  => $total,
    'periodoInicio' => $periodoInicio ?: null,
    'periodoFin'    => $periodoFin   ?: null,
], 201);
