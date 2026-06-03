<?php
declare(strict_types=1);

// Reporte CSV: ?tipo=nuevos|bloqueados|solicitudes
// nuevos: usuarios creados en los ultimos 30 dias
// bloqueados: usuarios con activo=0 (incluye pendientes de aprobacion)
// solicitudes: usuarios con solicitudes pendientes en bandeja

Auth::requireAdmin();

$tipo = strtolower(trim((string)($_GET['tipo'] ?? 'nuevos')));
$tiposValidos = ['nuevos', 'bloqueados', 'solicitudes'];
if (!in_array($tipo, $tiposValidos, true)) {
    Response::error('Tipo de reporte invalido', 400);
}

$pdo = Db::pdo();

if ($tipo === 'nuevos') {
    $stmt = $pdo->prepare(
        "SELECT u.id, u.nombre_completo, u.correo, r.nombre AS rol, a.nombre AS area,
                u.activo, u.must_change_password, u.creado_en
         FROM usuarios u
         INNER JOIN roles r ON r.id = u.rol_id
         LEFT JOIN areas a ON a.id = u.area_id
         WHERE u.creado_en >= (UTC_TIMESTAMP() - INTERVAL 30 DAY)
         ORDER BY u.creado_en DESC"
    );
    $stmt->execute();
    $rows = $stmt->fetchAll();
    $headers = ['ID', 'Nombre completo', 'Correo', 'Rol', 'Area', 'Activo', 'Cambio inicial pendiente', 'Creado en'];
    $mapFn = fn($r) => [
        $r['id'],
        $r['nombre_completo'],
        $r['correo'],
        $r['rol'],
        $r['area'] ?? '',
        (int)$r['activo'] === 1 ? 'Si' : 'No',
        (int)$r['must_change_password'] === 1 ? 'Si' : 'No',
        $r['creado_en'],
    ];
    $filename = 'usuarios_nuevos_' . date('Ymd') . '.csv';
} elseif ($tipo === 'bloqueados') {
    $stmt = $pdo->prepare(
        "SELECT u.id, u.nombre_completo, u.correo, r.nombre AS rol, a.nombre AS area,
                u.activo, u.must_change_password, u.creado_en
         FROM usuarios u
         INNER JOIN roles r ON r.id = u.rol_id
         LEFT JOIN areas a ON a.id = u.area_id
         WHERE u.activo = 0
         ORDER BY u.creado_en DESC"
    );
    $stmt->execute();
    $rows = $stmt->fetchAll();
    $headers = ['ID', 'Nombre completo', 'Correo', 'Rol', 'Area', 'Cambio inicial pendiente', 'Creado en', 'Estado'];
    $mapFn = fn($r) => [
        $r['id'],
        $r['nombre_completo'],
        $r['correo'],
        $r['rol'],
        $r['area'] ?? '',
        (int)$r['must_change_password'] === 1 ? 'Si' : 'No',
        $r['creado_en'],
        'Bloqueado',
    ];
    $filename = 'usuarios_bloqueados_' . date('Ymd') . '.csv';
} else {
    // solicitudes: usuarios solicitantes con solicitudes activas
    $stmt = $pdo->prepare(
        "SELECT s.id, s.numero_radicado, s.solicitante_nombre, s.solicitante_correo,
                s.solicitante_documento, s.estado, s.paso_actual, t.nombre AS tipo,
                a.nombre AS area, s.creado_en
         FROM solicitudes s
         INNER JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
         INNER JOIN areas a ON a.id = s.area_id
         WHERE s.estado IN ('en_validacion', 'borrador', 'devuelto')
         ORDER BY s.creado_en DESC"
    );
    $stmt->execute();
    $rows = $stmt->fetchAll();
    $headers = ['ID', 'Radicado', 'Solicitante', 'Correo', 'Documento', 'Estado', 'Paso actual', 'Tipo', 'Area', 'Creado en'];
    $mapFn = fn($r) => [
        $r['id'],
        $r['numero_radicado'],
        $r['solicitante_nombre'] ?? '',
        $r['solicitante_correo'] ?? '',
        $r['solicitante_documento'] ?? '',
        $r['estado'],
        $r['paso_actual'] ?? '',
        $r['tipo'],
        $r['area'],
        $r['creado_en'],
    ];
    $filename = 'solicitudes_pendientes_' . date('Ymd') . '.csv';
}

// CSV output
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate');

$out = fopen('php://output', 'w');
// BOM UTF-8 para Excel
fwrite($out, "\xEF\xBB\xBF");
fputcsv($out, $headers, ';');
foreach ($rows as $r) {
    fputcsv($out, $mapFn($r), ';');
}
fclose($out);
exit;
