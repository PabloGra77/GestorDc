<?php
declare(strict_types=1);

require_once __DIR__ . '/_flujo.php';

$jwt = Auth::requireUser();
$id = (int)($params['id'] ?? 0);
$body = Request::body();
$comentario = trim((string)($body['comentario'] ?? '')) ?: 'Validacion correcta';
$firma = isset($body['firma']) ? (string)$body['firma'] : '';

$pdo = Db::pdo();
['sol' => $sol, 'user' => $user] = FlujoHelpers::cargarYAutorizar($pdo, $id, (int)$jwt['sub']);

if ($sol['estado'] !== 'en_validacion') {
    Response::error('La solicitud no esta en validacion', 400);
}

if ($firma === '' || strpos($firma, 'data:image') !== 0) {
    Response::error('Se requiere la firma del validador', 400);
}

$siguiente = FlujoHelpers::siguientePaso($sol['flujo_aprobacion'] ?? '[]', $sol['paso_actual']);

// Asignar firma al rol actual (analista/coordinador/contabilidad)
$firmasActuales = json_decode($sol['firmas'] ?? 'null', true) ?: [];
$firmasActuales[$sol['paso_actual']] = $firma;
$firmasJson = json_encode($firmasActuales, JSON_UNESCAPED_UNICODE);

$pdo->beginTransaction();
try {
    if ($siguiente) {
        // Avanzar al siguiente paso. Guard contra race condition:
        // solo actualizar si el paso_actual sigue siendo el esperado.
        $upd = $pdo->prepare(
            "UPDATE solicitudes
             SET paso_actual = :pa, paso_orden = :po, firmas = :firmas
             WHERE id = :id AND estado = 'en_validacion' AND paso_actual = :pa_prev"
        );
        $upd->execute([
            ':pa' => $siguiente['rol'],
            ':po' => (int)($siguiente['orden'] ?? 0),
            ':firmas' => $firmasJson,
            ':id' => $id,
            ':pa_prev' => $sol['paso_actual'],
        ]);
        if ($upd->rowCount() === 0) {
            $pdo->rollBack();
            Response::error('La solicitud ya fue actualizada por otro validador', 409);
        }
        FlujoHelpers::registrarMovimiento(
            $pdo, $id, 'validada', $sol['paso_actual'],
            'en_validacion', $user, $comentario, 'publico'
        );
        FlujoHelpers::notificarSolicitante($sol,
            "Avance de su solicitud {$sol['numero_radicado']}",
            "Su solicitud {$sol['numero_radicado']} avanzo al siguiente paso de validacion: " . ($siguiente['label'] ?? $siguiente['rol'])
        );
        $nuevoEstado = 'en_validacion';
        $nuevoPaso = $siguiente['rol'];
        $nuevoPasoLabel = $siguiente['label'] ?? $siguiente['rol'];
    } else {
        // No hay siguiente paso = aprobada. Guard contra race.
        $upd = $pdo->prepare(
            "UPDATE solicitudes
             SET estado = 'aprobado', paso_actual = NULL, aprobado_en = UTC_TIMESTAMP(), firmas = :firmas
             WHERE id = :id AND estado = 'en_validacion' AND paso_actual = :pa_prev"
        );
        $upd->execute([':id' => $id, ':pa_prev' => $sol['paso_actual'], ':firmas' => $firmasJson]);
        if ($upd->rowCount() === 0) {
            $pdo->rollBack();
            Response::error('La solicitud ya fue actualizada por otro validador', 409);
        }
        FlujoHelpers::registrarMovimiento(
            $pdo, $id, 'aprobada', $sol['paso_actual'],
            'aprobado', $user, $comentario, 'publico'
        );
        FlujoHelpers::notificarSolicitante($sol,
            "Solicitud {$sol['numero_radicado']} aprobada",
            "Su solicitud {$sol['numero_radicado']} fue aprobada definitivamente. Comentario: {$comentario}"
        );
        $nuevoEstado = 'aprobado';
        $nuevoPaso = null;
        $nuevoPasoLabel = null;
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[validar] ' . $e->getMessage());
    Response::error('No se pudo validar la solicitud', 500);
}

// Si avanzó, avisar al validador del siguiente paso
if ($siguiente) {
    FlujoHelpers::notificarValidadores($pdo, [
        'numero_radicado'    => $sol['numero_radicado'],
        'tipo_nombre'        => $sol['tipo_nombre'] ?? '',
        'solicitante_nombre' => $sol['solicitante_nombre'] ?? '',
    ], $siguiente['rol'] ?? null, (int)$sol['area_id']);
}

Response::json([
    'ok' => true,
    'estado' => $nuevoEstado,
    'pasoActual' => $nuevoPaso,
    'pasoLabel' => $nuevoPasoLabel,
]);
