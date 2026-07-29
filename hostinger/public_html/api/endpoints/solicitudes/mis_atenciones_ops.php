<?php
declare(strict_types=1);

// Devuelve las atenciones del profesional registradas en el informe para un período.
// Usado para pre-cargar el formulario de cuenta cobro OPS (Paso 2).

Auth::requireUser();

$cc   = preg_replace('/[^0-9]/', '', (string)($_GET['cc'] ?? ''));
$pini = trim((string)($_GET['periodoInicio'] ?? ''));
$pfin = trim((string)($_GET['periodoFin']    ?? ''));

if (!$cc) {
    Response::json(['encontrado' => false, 'atencionesPpl' => [], 'atencionesServicio' => []]);
}

$pdo     = Db::pdo();
$piniSql = $pini ?: '1900-01-01';
$pfinSql = $pfin ?: '2999-12-31';

$params = [':cc' => $cc, ':pini' => $piniSql, ':pfin' => $pfinSql];

$whereJoin = "FROM informe_atenciones_detalle d
              JOIN informes_ops i ON i.id = d.informe_id
              WHERE d.cc_profesional = :cc
                AND (i.periodo_inicio IS NULL OR i.periodo_fin IS NULL
                     OR (i.periodo_inicio <= :pfin AND i.periodo_fin >= :pini))";

// Verificar que existan registros
$chk = $pdo->prepare("SELECT COUNT(*) $whereJoin");
$chk->execute($params);
if ((int)$chk->fetchColumn() === 0) {
    Response::json(['encontrado' => false, 'atencionesPpl' => [], 'atencionesServicio' => []]);
}

// Modo PPL: agrupar por fecha + servicio (COUNT = HC atendidas ese día para ese servicio)
$pplQ = $pdo->prepare(
    "SELECT d.fecha_atencion,
            UPPER(TRIM(COALESCE(d.servicio, ''))) AS servicio,
            COUNT(*) AS hc
     $whereJoin
     GROUP BY d.fecha_atencion, UPPER(TRIM(COALESCE(d.servicio, '')))
     ORDER BY d.fecha_atencion, servicio"
);
$pplQ->execute($params);
$atencionesPpl = array_map(fn($r) => [
    'fecha'    => (string)$r['fecha_atencion'],
    'servicio' => (string)$r['servicio'],
    'hc'       => (int)$r['hc'],
], $pplQ->fetchAll());

// Modo Servicio: agrupar por paciente + servicio
$svQ = $pdo->prepare(
    "SELECT d.cc_paciente,
            MAX(d.nombres_paciente)   AS nombres,
            MAX(d.apellidos_paciente) AS apellidos,
            UPPER(TRIM(COALESCE(d.servicio, ''))) AS servicio,
            SUM(COALESCE(d.numero_sesiones, 1))   AS sesiones
     $whereJoin
     GROUP BY d.cc_paciente, UPPER(TRIM(COALESCE(d.servicio, '')))
     ORDER BY d.apellidos_paciente, servicio"
);
$svQ->execute($params);
$atencionesServicio = array_map(fn($r) => [
    'ccPaciente' => (string)$r['cc_paciente'],
    'nombres'    => (string)($r['nombres']    ?? ''),
    'apellidos'  => (string)($r['apellidos']  ?? ''),
    'servicio'   => (string)$r['servicio'],
    'sesiones'   => max(1, (int)$r['sesiones']),
], $svQ->fetchAll());

Response::json([
    'encontrado'         => true,
    'atencionesPpl'      => $atencionesPpl,
    'atencionesServicio' => $atencionesServicio,
]);
