<?php
declare(strict_types=1);

Throttle::hit('rad-verify:' . Throttle::clientIp(), 20, 60);

$numero = Request::query('numero');
$referencia = Request::query('referencia');
$numeroN = $numero ? strtoupper(trim($numero)) : '';
$refN = $referencia ? strtoupper(trim($referencia)) : '';

if ($numeroN === '' && $refN === '') {
    Response::error('Debes enviar numero o referencia para verificar', 400);
}

$pdo = Db::pdo();

// 1) Primero buscar en SOLICITUDES (sistema nuevo)
if ($numeroN !== '') {
    $stmt = $pdo->prepare(
        "SELECT s.*, t.nombre AS tipo_nombre, t.flujo_aprobacion, a.nombre AS area_nombre
         FROM solicitudes s
         INNER JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
         INNER JOIN areas a ON a.id = s.area_id
         WHERE s.numero_radicado = :n LIMIT 1"
    );
    $stmt->execute([':n' => $numeroN]);
    $sol = $stmt->fetch();
    if ($sol) {
        // Movimientos publicos solamente
        $mov = $pdo->prepare(
            "SELECT * FROM solicitud_movimientos
             WHERE solicitud_id = :s AND visibilidad = 'publico'
             ORDER BY creado_en ASC"
        );
        $mov->execute([':s' => $sol['id']]);
        $movimientos = $mov->fetchAll();

        $flujo = json_decode($sol['flujo_aprobacion'] ?? '[]', true) ?: [];
        usort($flujo, fn($a, $b) => ($a['orden'] ?? 0) <=> ($b['orden'] ?? 0));

        // Mapa de paso => estado para el trazado visual
        $pasosVistosCompletos = [];
        foreach ($movimientos as $m) {
            if (in_array($m['accion'], ['validada', 'aprobada'], true) && $m['paso']) {
                $pasosVistosCompletos[$m['paso']] = true;
            }
        }

        $trazado = array_map(function ($p) use ($sol, $pasosVistosCompletos) {
            $estado = 'pendiente';
            if (!empty($pasosVistosCompletos[$p['rol'] ?? ''])) {
                $estado = 'completado';
            } elseif (($sol['paso_actual'] ?? '') === ($p['rol'] ?? '') && $sol['estado'] === 'en_validacion') {
                $estado = 'en_curso';
            }
            return [
                'rol' => $p['rol'] ?? '',
                'label' => $p['label'] ?? '',
                'orden' => (int)($p['orden'] ?? 0),
                'estado' => $estado,
            ];
        }, $flujo);

        Response::json([
            'existe' => true,
            'tipo' => 'solicitud',
            'solicitud' => [
                'id'             => (int)$sol['id'],
                'numeroRadicado' => $sol['numero_radicado'],
                'tipoNombre'     => $sol['tipo_nombre'],
                'areaNombre'     => $sol['area_nombre'],
                'estado'         => $sol['estado'],
                'pasoActual'     => $sol['paso_actual'],
                'creadoEn'       => $sol['creado_en'],
                'aprobadoEn'     => $sol['aprobado_en'],
                'trazado'        => $trazado,
                'movimientosPublicos' => array_map(fn($m) => [
                    'accion'         => $m['accion'],
                    'paso'           => $m['paso'],
                    'estadoResultado' => $m['estado_resultado'],
                    'comentario'     => $m['comentario'],
                    'creadoEn'       => $m['creado_en'],
                ], $movimientos),
            ],
        ]);
    }
}

// 2) Fallback al sistema viejo de radicados
$where = [];
$params = [];
if ($numeroN !== '') { $where[] = "numero = :n"; $params[':n'] = $numeroN; }
if ($refN !== '')   { $where[] = "referencia = :r"; $params[':r'] = $refN; }
$sql = "SELECT * FROM radicados WHERE " . implode(' OR ', $where) . " ORDER BY id DESC LIMIT 1";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$row = $stmt->fetch();

if (!$row) Response::json(['existe' => false]);
Response::json(['existe' => true, 'tipo' => 'radicado', 'radicado' => Shapes::radicado($row)]);
