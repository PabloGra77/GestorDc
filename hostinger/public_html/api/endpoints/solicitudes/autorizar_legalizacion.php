<?php
declare(strict_types=1);

/**
 * POST /solicitudes/{id}/autorizar-legalizacion
 *
 * El usuario que fue designado como "autorizador" en una solicitud de
 * legalización da su visto bueno. Solo puede actuar el usuario cuyo ID
 * coincide con datos_formulario.autorizadorId.
 * Avanza el paso 'autorizador_visto_bueno' al siguiente paso del flujo.
 */
require_once __DIR__ . '/_flujo.php';

$jwt = Auth::requireUser();
$id  = (int)($params['id'] ?? 0);
$body = Request::body();
$comentario = trim((string)($body['comentario'] ?? '')) ?: 'Visto bueno del autorizador';
$firma = isset($body['firma']) ? (string)$body['firma'] : '';

if ($firma === '' || strpos($firma, 'data:image') !== 0) {
    Response::error('Se requiere la firma del autorizador para confirmar el visto bueno', 400);
}
if (strlen($firma) > 300_000) {
    Response::error('La firma excede el tamaño máximo permitido (300 KB)', 413);
}

$pdo = Db::pdo();

$stmt = $pdo->prepare(
    "SELECT s.*, t.flujo_aprobacion, t.nombre AS tipo_nombre, t.slug AS tipo_slug
     FROM solicitudes s
     INNER JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
     WHERE s.id = :id LIMIT 1"
);
$stmt->execute([':id' => $id]);
$sol = $stmt->fetch();
if (!$sol) Response::error('Solicitud no encontrada', 404);

if (($sol['paso_actual'] ?? '') !== 'autorizador_visto_bueno') {
    Response::error('Esta solicitud no está en el paso de visto bueno del autorizador', 400);
}

$datos = json_decode($sol['datos_formulario'] ?? '{}', true) ?: [];
$autorizadorId = (int)($datos['autorizadorId'] ?? 0);
if ($autorizadorId === 0 || $autorizadorId !== (int)$jwt['sub']) {
    Response::error('Solo el autorizador designado puede dar el visto bueno', 403);
}

$uStmt = $pdo->prepare("SELECT id, nombre_completo, nivel_aprobacion FROM usuarios WHERE id = :id LIMIT 1");
$uStmt->execute([':id' => (int)$jwt['sub']]);
$user = $uStmt->fetch();
if (!$user) Response::error('Usuario no encontrado', 404);

// autorizador_visto_bueno was prepended dynamically in create.php and is NOT stored
// in tipos_solicitud.flujo_aprobacion — rebuild the effective flujo before searching.
$flujoEfectivo = json_decode($sol['flujo_aprobacion'] ?? '[]', true) ?: [];
usort($flujoEfectivo, fn($a, $b) => ($a['orden'] ?? 0) <=> ($b['orden'] ?? 0));
if (($flujoEfectivo[0]['rol'] ?? '') !== 'autorizador_visto_bueno') {
    foreach ($flujoEfectivo as &$_fp) { $_fp['orden'] = (int)($_fp['orden'] ?? 0) + 1; }
    unset($_fp);
    array_unshift($flujoEfectivo, ['rol' => 'autorizador_visto_bueno', 'label' => 'Visto bueno del autorizador', 'orden' => 1]);
}
$siguiente = FlujoHelpers::siguientePaso(json_encode($flujoEfectivo), 'autorizador_visto_bueno');

$firmasActuales = json_decode($sol['firmas'] ?? 'null', true) ?: [];
$firmasActuales['autorizador_visto_bueno'] = $firma;
$firmasJson = json_encode($firmasActuales, JSON_UNESCAPED_UNICODE);

$pdo->beginTransaction();
try {
    if ($siguiente) {
        $upd = $pdo->prepare(
            "UPDATE solicitudes SET paso_actual = :pa, paso_orden = :po, firmas = :firmas
             WHERE id = :id AND paso_actual = 'autorizador_visto_bueno'"
        );
        $upd->execute([':pa' => $siguiente['rol'], ':po' => (int)($siguiente['orden'] ?? 2), ':firmas' => $firmasJson, ':id' => $id]);
        if ($upd->rowCount() === 0) {
            $pdo->rollBack();
            Response::error('La solicitud ya fue actualizada por otro usuario', 409);
        }
        FlujoHelpers::registrarMovimiento(
            $pdo, $id, 'visto_bueno', 'autorizador_visto_bueno', 'en_validacion',
            ['id' => $user['id'], 'nombre_completo' => $user['nombre_completo'], 'nivel_aprobacion' => 'autorizador'],
            $comentario, 'publico'
        );
        $nuevoEstado  = 'en_validacion';
        $nuevoPaso    = $siguiente['rol'];
        $nuevoPasoLbl = $siguiente['label'] ?? $siguiente['rol'];
    } else {
        // No hay más pasos → aprobar directamente
        $upd = $pdo->prepare(
            "UPDATE solicitudes SET estado = 'aprobado', paso_actual = NULL, aprobado_en = UTC_TIMESTAMP(), firmas = :firmas
             WHERE id = :id AND paso_actual = 'autorizador_visto_bueno'"
        );
        $upd->execute([':firmas' => $firmasJson, ':id' => $id]);
        FlujoHelpers::registrarMovimiento(
            $pdo, $id, 'aprobada', 'autorizador_visto_bueno', 'aprobado',
            ['id' => $user['id'], 'nombre_completo' => $user['nombre_completo'], 'nivel_aprobacion' => 'autorizador'],
            $comentario, 'publico'
        );
        $nuevoEstado  = 'aprobado';
        $nuevoPaso    = null;
        $nuevoPasoLbl = null;
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[autorizar_legalizacion] ' . $e->getMessage());
    Response::error('No se pudo registrar el visto bueno', 500);
}

// Notificar al solicitante que avanzó
FlujoHelpers::notificarSolicitante($sol,
    "Visto bueno recibido: {$sol['numero_radicado']}",
    "El autorizador {$user['nombre_completo']} confirmó tu solicitud de legalización " .
    "{$sol['numero_radicado']}.\n\nAhora pasa al siguiente paso de validación."
);

// Notificar al siguiente validador
if ($siguiente) {
    FlujoHelpers::notificarValidadores($pdo, [
        'numero_radicado'    => $sol['numero_radicado'],
        'tipo_nombre'        => $sol['tipo_nombre'] ?? 'Legalización',
        'solicitante_nombre' => $sol['solicitante_nombre'] ?? '',
    ], $siguiente['rol'] ?? null, (int)$sol['area_id']);
}

Response::json(['ok' => true, 'estado' => $nuevoEstado, 'pasoActual' => $nuevoPaso, 'pasoLabel' => $nuevoPasoLbl]);
