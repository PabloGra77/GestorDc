<?php
declare(strict_types=1);

// Compara las atenciones declaradas en el formulario de cuenta cobro OPS
// contra lo registrado en informe_atenciones_detalle para el mismo período.
// Llamado antes de enviar la solicitud (sin necesitar solicitud_id).

Auth::requireUser();

$body = Request::body();
$cc       = preg_replace('/[^0-9]/', '', (string)($body['cc'] ?? ''));
$pini     = trim((string)($body['periodoInicio'] ?? ''));
$pfin     = trim((string)($body['periodoFin']    ?? ''));
$tipo     = trim((string)($body['tipo']          ?? 'ppl'));
$atJson   = (string)($body['atencionesJson']         ?? '[]');
$atServJson = (string)($body['atencionesServicioJson'] ?? '[]');

if (!$cc) {
    Response::json(['hayDiscrepancias' => false, 'sinInforme' => true, 'discrepancias' => [], 'totalDeclaradas' => 0, 'totalRegistradas' => 0]);
}

$pdo = Db::pdo();

// Helper: check if any informe records exist for this cc in the period
$piniSql = $pini ?: '1900-01-01';
$pfinSql = $pfin ?: '2999-12-31';

$existeStmt = $pdo->prepare(
    "SELECT COUNT(*) FROM informe_atenciones_detalle d
     JOIN informes_ops i ON i.id = d.informe_id
     WHERE d.cc_profesional = :cc
       AND (i.periodo_inicio IS NULL OR i.periodo_fin IS NULL
            OR (i.periodo_inicio <= :pfin AND i.periodo_fin >= :pini))"
);
$existeStmt->execute([':cc' => $cc, ':pini' => $piniSql, ':pfin' => $pfinSql]);
if ((int)$existeStmt->fetchColumn() === 0) {
    // No hay informe para este período: no hay discrepancias que comparar
    Response::json(['hayDiscrepancias' => false, 'sinInforme' => true, 'discrepancias' => [], 'totalDeclaradas' => 0, 'totalRegistradas' => 0]);
}

$discrepancias     = [];
$totalDeclaradas   = 0;
$totalRegistradas  = 0;

if ($tipo === 'servicio') {
    $filas = json_decode($atServJson, true) ?: [];

    foreach ($filas as $row) {
        $ccPaciente = preg_replace('/[^0-9]/', '', (string)($row['numId'] ?? ''));
        $servicio   = mb_strtoupper(trim((string)($row['servicio'] ?? '')));
        $sesiones   = max(1, (int)($row['sesiones'] ?? 1));
        if (!$ccPaciente || !$servicio) continue;

        $totalDeclaradas += $sesiones;

        $stmt = $pdo->prepare(
            "SELECT COALESCE(SUM(d.numero_sesiones), 0)
             FROM informe_atenciones_detalle d
             JOIN informes_ops i ON i.id = d.informe_id
             WHERE d.cc_profesional = :cc AND d.cc_paciente = :cp AND UPPER(TRIM(d.servicio)) = :sv
               AND (i.periodo_inicio IS NULL OR i.periodo_fin IS NULL
                    OR (i.periodo_inicio <= :pfin AND i.periodo_fin >= :pini))"
        );
        $stmt->execute([':cc' => $cc, ':cp' => $ccPaciente, ':sv' => $servicio, ':pini' => $piniSql, ':pfin' => $pfinSql]);
        $registradas = (int)$stmt->fetchColumn();
        $totalRegistradas += $registradas;

        if ($sesiones !== $registradas) {
            $nombre = trim(($row['nombres'] ?? '') . ' ' . ($row['apellidos'] ?? ''));
            $discrepancias[] = [
                'descripcion' => $servicio . ' — ' . ($nombre ?: 'paciente CC ' . $ccPaciente),
                'declaradas'  => $sesiones,
                'registradas' => $registradas,
                'diferencia'  => $registradas - $sesiones,
            ];
        }
    }
} else {
    // PPL mode: compare by fecha + servicio (si disponible)
    $filas = json_decode($atJson, true) ?: [];

    foreach ($filas as $row) {
        $fecha    = trim((string)($row['fecha'] ?? ''));
        $hc       = (int)($row['hc'] ?? 0);
        $servicio = mb_strtoupper(trim((string)($row['servicio'] ?? '')));
        $sede     = trim((string)($row['sede'] ?? ''));
        if (!$fecha || $hc <= 0) continue;

        $totalDeclaradas += $hc;

        if ($servicio) {
            $stmt = $pdo->prepare(
                "SELECT COUNT(*)
                 FROM informe_atenciones_detalle d
                 JOIN informes_ops i ON i.id = d.informe_id
                 WHERE d.cc_profesional = :cc AND d.fecha_atencion = :fecha
                   AND UPPER(TRIM(COALESCE(d.servicio,''))) = :sv
                   AND (i.periodo_inicio IS NULL OR i.periodo_fin IS NULL
                        OR (i.periodo_inicio <= :pfin AND i.periodo_fin >= :pini))"
            );
            $stmt->execute([':cc' => $cc, ':fecha' => $fecha, ':sv' => $servicio, ':pini' => $piniSql, ':pfin' => $pfinSql]);
        } else {
            $stmt = $pdo->prepare(
                "SELECT COUNT(*)
                 FROM informe_atenciones_detalle d
                 JOIN informes_ops i ON i.id = d.informe_id
                 WHERE d.cc_profesional = :cc AND d.fecha_atencion = :fecha
                   AND (i.periodo_inicio IS NULL OR i.periodo_fin IS NULL
                        OR (i.periodo_inicio <= :pfin AND i.periodo_fin >= :pini))"
            );
            $stmt->execute([':cc' => $cc, ':fecha' => $fecha, ':pini' => $piniSql, ':pfin' => $pfinSql]);
        }
        $registradas = (int)$stmt->fetchColumn();
        $totalRegistradas += $registradas;

        if ($hc !== $registradas) {
            $discrepancias[] = [
                'descripcion' => ($servicio ? $servicio . ' · ' : '') . $fecha . ($sede ? ' en ' . $sede : ''),
                'declaradas'  => $hc,
                'registradas' => $registradas,
                'diferencia'  => $registradas - $hc,
            ];
        }
    }
}

Response::json([
    'hayDiscrepancias'  => count($discrepancias) > 0,
    'sinInforme'        => false,
    'discrepancias'     => $discrepancias,
    'totalDeclaradas'   => $totalDeclaradas,
    'totalRegistradas'  => $totalRegistradas,
]);
