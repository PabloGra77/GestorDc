<?php
declare(strict_types=1);

// Informe dinámico de solicitudes en CSV. Solo administradores.
// Parámetros (GET):
//   tipo      = id de tipo_solicitud (0 / vacío = todos)
//   desde     = YYYY-MM-DD (opcional)
//   hasta     = YYYY-MM-DD (opcional)
//   estado    = en_validacion|aprobado|rechazado|devuelto|borrador (opcional)
//   columnas  = lista separada por coma; columnas fijas o "dato:KEY" para datos del formulario
Auth::requireAdmin();

$pdo = Db::pdo();

$tipoId      = (int)($_GET['tipo'] ?? 0);
$desde       = trim((string)($_GET['desde'] ?? ''));
$hasta       = trim((string)($_GET['hasta'] ?? ''));
$estado      = trim((string)($_GET['estado'] ?? ''));
$solicitante = trim((string)($_GET['solicitante'] ?? ''));
$columnasRaw = trim((string)($_GET['columnas'] ?? ''));

$reFecha = '/^\d{4}-\d{2}-\d{2}$/';
$wheres = [];
$args = [];
if ($tipoId > 0) { $wheres[] = 's.tipo_solicitud_id = :tid'; $args[':tid'] = $tipoId; }
if (preg_match($reFecha, $desde)) { $wheres[] = 's.creado_en >= :desde'; $args[':desde'] = $desde . ' 00:00:00'; }
if (preg_match($reFecha, $hasta)) { $wheres[] = 's.creado_en <= :hasta'; $args[':hasta'] = $hasta . ' 23:59:59'; }
$estadosValidos = ['en_validacion', 'aprobado', 'rechazado', 'devuelto', 'borrador'];
if (in_array($estado, $estadosValidos, true)) { $wheres[] = 's.estado = :estado'; $args[':estado'] = $estado; }
if ($solicitante !== '') { $wheres[] = 's.solicitante_nombre LIKE :sol'; $args[':sol'] = '%' . $solicitante . '%'; }
$whereSql = $wheres ? ('WHERE ' . implode(' AND ', $wheres)) : '';

$stmt = $pdo->prepare(
    "SELECT s.numero_radicado, s.creado_en, s.actualizado_en, s.aprobado_en, s.estado, s.paso_actual,
            s.solicitante_nombre, s.solicitante_correo, s.solicitante_documento,
            s.datos_formulario, s.documentos, s.alertas, s.firmas,
            t.nombre AS tipo, a.nombre AS area
     FROM solicitudes s
     INNER JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
     INNER JOIN areas a ON a.id = s.area_id
     {$whereSql}
     ORDER BY s.creado_en DESC"
);
$stmt->execute($args);
$rows = $stmt->fetchAll();

$FIJAS = [
    'radicado'        => 'Radicado',
    'fecha'           => 'Fecha de creación',
    'aprobado'        => 'Fecha de aprobación',
    'actualizado'     => 'Última actualización',
    'tipo'            => 'Tipo de solicitud',
    'area'            => 'Área',
    'estado'          => 'Estado',
    'paso'            => 'Paso actual',
    'solicitante'     => 'Nombre del profesional',
    'documento'       => 'Documento',
    'correo'          => 'Correo',
    'monto_total'     => 'Monto total solicitado',
    'monto_legalizado'=> 'Monto legalizado',
    'num_items'       => 'N° ítems/gastos',
    'desglose_items'  => 'Desglose de ítems',
    'firmado'         => 'Firmado por el solicitante',
    'alertas'         => 'Alertas IA',
    'adjuntos'        => 'Adjuntos cargados',
];

$cols = array_values(array_filter(array_map('trim', explode(',', $columnasRaw))));
if (!$cols) { $cols = ['radicado', 'fecha', 'tipo', 'area', 'estado', 'solicitante']; }

// Etiquetas legibles de los datos/adjuntos del formulario (si hay un tipo específico)
$labels = [];
if ($tipoId > 0) {
    $t = $pdo->prepare("SELECT campos_plantilla FROM tipos_solicitud WHERE id = :id LIMIT 1");
    $t->execute([':id' => $tipoId]);
    $cp = json_decode((string)$t->fetchColumn(), true) ?: [];
    foreach ($cp as $c) {
        if (!empty($c['key'])) { $labels[$c['key']] = $c['label'] ?? $c['key']; }
    }
}

$etiquetaCol = static function (string $col) use ($FIJAS, $labels): string {
    if (isset($FIJAS[$col])) return $FIJAS[$col];
    if (strncmp($col, 'dato:', 5) === 0) { $k = substr($col, 5); return $labels[$k] ?? $k; }
    if (strncmp($col, 'doc:', 4) === 0)  { $k = substr($col, 4); return '¿Adjuntó ' . ($labels[$k] ?? $k) . '?'; }
    return $col;
};

$nombreDoc = static function ($info): string {
    if (is_array($info)) { return (string)($info['nombre'] ?? $info['filename'] ?? $info['name'] ?? 'archivo'); }
    return is_string($info) ? $info : '';
};

$fmtPesos = static function (float $v): string {
    return '$ ' . number_format($v, 0, ',', '.');
};

$extraerItems = static function (array $datos, string ...$campos): array {
    foreach ($campos as $c) {
        if (empty($datos[$c])) continue;
        $arr = is_string($datos[$c]) ? json_decode($datos[$c], true) : $datos[$c];
        if (is_array($arr) && count($arr) > 0) return $arr;
    }
    return [];
};

$valorCol = static function (string $col, array $r, array $datos, array $documentos, array $alertas, array $firmas) use ($nombreDoc, $fmtPesos, $extraerItems): string {
    switch ($col) {
        case 'radicado':    return (string)$r['numero_radicado'];
        case 'fecha':       return (string)$r['creado_en'];
        case 'aprobado':    return (string)($r['aprobado_en'] ?? '');
        case 'actualizado': return (string)($r['actualizado_en'] ?? '');
        case 'tipo':        return (string)$r['tipo'];
        case 'area':        return (string)$r['area'];
        case 'estado':      return (string)$r['estado'];
        case 'paso':        return (string)($r['paso_actual'] ?? '');
        case 'solicitante': return (string)($r['solicitante_nombre'] ?? '');
        case 'documento':   return (string)($r['solicitante_documento'] ?? '');
        case 'correo':      return (string)($r['solicitante_correo'] ?? '');
        case 'firmado':     return !empty($firmas['profesional']) ? 'Sí' : 'No';
        case 'alertas':     return (string)count($alertas);
        case 'adjuntos':
            $nombres = [];
            foreach ($documentos as $info) { $n = $nombreDoc($info); if ($n !== '') $nombres[] = $n; }
            return implode(' | ', $nombres);

        case 'monto_total':
            // Viáticos: totalGeneral
            if (isset($datos['totalGeneral']) && (float)$datos['totalGeneral'] > 0)
                return $fmtPesos((float)$datos['totalGeneral']);
            // Anticipo / CuentaCobro / formulario genérico: valorPesos
            if (isset($datos['valorPesos']) && (float)$datos['valorPesos'] > 0)
                return $fmtPesos((float)$datos['valorPesos']);
            // Suma de ítems (items = anticipo, gastos = legalizacion)
            $its = $extraerItems($datos, 'items', 'gastos');
            if ($its) {
                $sum = array_sum(array_map(fn($it) => (float)($it['valor'] ?? $it['monto'] ?? 0), $its));
                if ($sum > 0) return $fmtPesos($sum);
            }
            return '';

        case 'monto_legalizado':
            // Almacenado por el endpoint /legalizar en documentos.__legalizacion._resumen
            $leg = $documentos['__legalizacion'] ?? [];
            $ml  = (float)(($leg['_resumen'] ?? [])['montoLegalizado'] ?? 0);
            return $ml > 0 ? $fmtPesos($ml) : '';

        case 'num_items':
            $its = $extraerItems($datos, 'items', 'gastos');
            return $its ? (string)count($its) : '0';

        case 'desglose_items':
            // Viáticos: mostrar subtotales por categoría
            $partes = [];
            if (isset($datos['totalTransporte']) && (float)$datos['totalTransporte'] > 0)
                $partes[] = 'Transporte: ' . $fmtPesos((float)$datos['totalTransporte']);
            if (isset($datos['totalHospedaje']) && (float)$datos['totalHospedaje'] > 0)
                $partes[] = 'Hospedaje: ' . $fmtPesos((float)$datos['totalHospedaje']);
            if (isset($datos['totalComidas']) && (float)$datos['totalComidas'] > 0)
                $partes[] = 'Comidas: ' . $fmtPesos((float)$datos['totalComidas']);
            if ($partes) return implode(' | ', $partes);
            // Anticipo / legalizacion: lista de ítems con valor
            $its = $extraerItems($datos, 'items', 'gastos');
            foreach ($its as $it) {
                $c = trim((string)($it['concepto'] ?? $it['nombre'] ?? ''));
                $v = (float)($it['valor'] ?? $it['monto'] ?? 0);
                $desc = trim((string)($it['descripcion'] ?? ''));
                $txt = $c;
                if ($desc) $txt .= ' (' . $desc . ')';
                if ($v > 0) $txt .= ': ' . $fmtPesos($v);
                if ($txt) $partes[] = $txt;
            }
            return implode(' | ', $partes);
    }
    if (strncmp($col, 'dato:', 5) === 0) {
        $k = substr($col, 5);
        $v = $datos[$k] ?? '';
        if (is_array($v)) { $v = json_encode($v, JSON_UNESCAPED_UNICODE); }
        return (string)$v;
    }
    if (strncmp($col, 'doc:', 4) === 0) {
        $k = substr($col, 4);
        if (!array_key_exists($k, $documentos) || $documentos[$k] === null || $documentos[$k] === '') return 'No';
        $n = $nombreDoc($documentos[$k]);
        return $n !== '' ? ('Sí — ' . $n) : 'Sí';
    }
    return '';
};

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="informe_solicitudes_' . date('Ymd_His') . '.csv"');
header('Cache-Control: no-store, no-cache, must-revalidate');

$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF"); // BOM UTF-8 para Excel
fputcsv($out, array_map($etiquetaCol, $cols), ';', '"', '\\');
foreach ($rows as $r) {
    $datos = json_decode((string)($r['datos_formulario'] ?? ''), true) ?: [];
    $documentos = json_decode((string)($r['documentos'] ?? ''), true);
    if (!is_array($documentos)) $documentos = [];
    $alertas = json_decode((string)($r['alertas'] ?? ''), true);
    if (!is_array($alertas)) $alertas = [];
    $firmas = json_decode((string)($r['firmas'] ?? ''), true);
    if (!is_array($firmas)) $firmas = [];
    $linea = [];
    foreach ($cols as $c) { $linea[] = $valorCol($c, $r, $datos, $documentos, $alertas, $firmas); }
    fputcsv($out, $linea, ';', '"', '\\');
}
fclose($out);
exit;
