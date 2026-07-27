<?php
declare(strict_types=1);

// Informe estadístico de solicitudes agrupadas por tipo. Solo administradores.
// GET /tipos/{id}/informe?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
Auth::requireAdmin();

$pdo    = Db::pdo();
$tipoId = (int)($params['id'] ?? 0);
if ($tipoId <= 0) { Response::error('ID de tipo inválido', 400); }

$desde = trim((string)($_GET['desde'] ?? ''));
$hasta = trim((string)($_GET['hasta'] ?? ''));
$reFecha = '/^\d{4}-\d{2}-\d{2}$/';

// Cargar datos del tipo
$stTipo = $pdo->prepare(
    "SELECT t.id, t.nombre, t.slug, t.descripcion, t.flujo_aprobacion,
            a.nombre AS area_nombre
     FROM tipos_solicitud t
     INNER JOIN areas a ON a.id = t.area_id
     WHERE t.id = :id LIMIT 1"
);
$stTipo->execute([':id' => $tipoId]);
$tipo = $stTipo->fetch(PDO::FETCH_ASSOC);
if (!$tipo) { Response::error('Tipo de solicitud no encontrado', 404); }

// Filtro de fechas
$dateWhere = '';
$dateArgs  = [':tid' => $tipoId];
if (preg_match($reFecha, $desde)) {
    $dateWhere  .= ' AND s.creado_en >= :desde';
    $dateArgs[':desde'] = $desde . ' 00:00:00';
}
if (preg_match($reFecha, $hasta)) {
    $dateWhere  .= ' AND s.creado_en <= :hasta';
    $dateArgs[':hasta'] = $hasta . ' 23:59:59';
}

// Conteos por estado
$stEstados = $pdo->prepare(
    "SELECT estado, COUNT(*) AS total
     FROM solicitudes
     WHERE tipo_solicitud_id = :tid{$dateWhere}
     GROUP BY estado ORDER BY total DESC"
);
$stEstados->execute($dateArgs);
$porEstado = $stEstados->fetchAll(PDO::FETCH_ASSOC);

// Total general
$totalSolicitudes = array_sum(array_column($porEstado, 'total'));

// Solicitudes con tiempo de resolución (aprobadas o rechazadas)
$stTiempo = $pdo->prepare(
    "SELECT
        AVG(TIMESTAMPDIFF(HOUR, creado_en, aprobado_en)) AS promedio_horas,
        MIN(TIMESTAMPDIFF(HOUR, creado_en, aprobado_en)) AS min_horas,
        MAX(TIMESTAMPDIFF(HOUR, creado_en, aprobado_en)) AS max_horas
     FROM solicitudes
     WHERE tipo_solicitud_id = :tid
       AND aprobado_en IS NOT NULL{$dateWhere}"
);
$stTiempo->execute($dateArgs);
$tiempos = $stTiempo->fetch(PDO::FETCH_ASSOC);

// Solicitudes por mes
$stMes = $pdo->prepare(
    "SELECT DATE_FORMAT(creado_en, '%Y-%m') AS mes, COUNT(*) AS total
     FROM solicitudes
     WHERE tipo_solicitud_id = :tid{$dateWhere}
     GROUP BY mes ORDER BY mes ASC LIMIT 24"
);
$stMes->execute($dateArgs);
$porMes = $stMes->fetchAll(PDO::FETCH_ASSOC);

// Top solicitantes
$stSolic = $pdo->prepare(
    "SELECT solicitante_nombre, COUNT(*) AS total
     FROM solicitudes
     WHERE tipo_solicitud_id = :tid{$dateWhere}
     GROUP BY solicitante_nombre ORDER BY total DESC LIMIT 10"
);
$stSolic->execute($dateArgs);
$topSolicitantes = $stSolic->fetchAll(PDO::FETCH_ASSOC);

// Última y primera solicitud
$stRango = $pdo->prepare(
    "SELECT MIN(creado_en) AS primera, MAX(creado_en) AS ultima
     FROM solicitudes
     WHERE tipo_solicitud_id = :tid{$dateWhere}"
);
$stRango->execute($dateArgs);
$rango = $stRango->fetch(PDO::FETCH_ASSOC);

// Tasa de aprobación (aprobado / (aprobado + rechazado))
$aprobadas  = 0;
$rechazadas = 0;
foreach ($porEstado as $row) {
    if ($row['estado'] === 'aprobado' || $row['estado'] === 'por_legalizar') $aprobadas  += (int)$row['total'];
    if ($row['estado'] === 'rechazado') $rechazadas += (int)$row['total'];
}
$tasaAprobacion = ($aprobadas + $rechazadas) > 0
    ? round($aprobadas / ($aprobadas + $rechazadas) * 100, 1)
    : null;

Response::json([
    'tipo' => [
        'id'          => (int)$tipo['id'],
        'nombre'      => $tipo['nombre'],
        'slug'        => $tipo['slug'],
        'descripcion' => $tipo['descripcion'],
        'areaNombre'  => $tipo['area_nombre'],
        'flujoAprobacion' => json_decode($tipo['flujo_aprobacion'] ?? '[]', true) ?: [],
    ],
    'resumen' => [
        'total'          => (int)$totalSolicitudes,
        'aprobadas'      => $aprobadas,
        'rechazadas'     => $rechazadas,
        'tasaAprobacion' => $tasaAprobacion,
        'promedioHoras'  => $tiempos['promedio_horas'] !== null ? round((float)$tiempos['promedio_horas'], 1) : null,
        'minHoras'       => $tiempos['min_horas'] !== null ? (int)$tiempos['min_horas'] : null,
        'maxHoras'       => $tiempos['max_horas'] !== null ? (int)$tiempos['max_horas'] : null,
        'primera'        => $rango['primera'] ?? null,
        'ultima'         => $rango['ultima']  ?? null,
    ],
    'porEstado'       => $porEstado,
    'porMes'          => $porMes,
    'topSolicitantes' => $topSolicitantes,
    'filtros' => [
        'desde' => $desde ?: null,
        'hasta' => $hasta ?: null,
    ],
]);
