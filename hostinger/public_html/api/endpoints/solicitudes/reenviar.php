<?php
declare(strict_types=1);

$jwt = Auth::requireUser();
$usuarioId = (int)($jwt['sub'] ?? 0);
$id = (int)($params['id'] ?? 0);
$body = Request::body();

$pdo = Db::pdo();

// Cargar solicitud
$sStmt = $pdo->prepare(
    "SELECT s.*, t.flujo_aprobacion, t.nombre AS tipo_nombre, t.slug AS tipo_slug
     FROM solicitudes s
     INNER JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
     WHERE s.id = :id LIMIT 1"
);
$sStmt->execute([':id' => $id]);
$sol = $sStmt->fetch();
if (!$sol) Response::error('Solicitud no encontrada', 404);

// Solo el solicitante original puede reenviar
if ((int)$sol['solicitante_usuario_id'] !== $usuarioId) {
    Response::error('Solo el solicitante puede reenviar la solicitud', 403);
}

if ($sol['estado'] !== 'devuelto') {
    Response::error('Solo se puede reenviar una solicitud que fue devuelta', 400);
}

// Cargar usuario
$uStmt = $pdo->prepare(
    "SELECT u.id, u.nombre_completo, u.area_id, u.nivel_aprobacion, r.nombre AS rol
     FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id WHERE u.id = :id LIMIT 1"
);
$uStmt->execute([':id' => $usuarioId]);
$user = $uStmt->fetch();

// Determinar primer paso del flujo
$flujo = json_decode($sol['flujo_aprobacion'] ?? '[]', true) ?: [];
usort($flujo, fn($a, $b) => ($a['orden'] ?? 0) <=> ($b['orden'] ?? 0));
$primerPaso = $flujo[0] ?? null;

// Opcional: agregar nuevos documentos al campo documentos
$docActuales = json_decode($sol['documentos'] ?? '[]', true) ?: [];
$docsNuevos = $body['documentos'] ?? [];
if (is_array($docsNuevos) && !empty($docsNuevos)) {
    foreach ($docsNuevos as $key => $val) {
        $docActuales[$key] = $val;
    }
}
$documentosJson = json_encode($docActuales, JSON_UNESCAPED_UNICODE);

// Comentario de reenvío (opcional)
$comentario = trim((string)($body['comentario'] ?? 'Solicitud reenviada por el solicitante con correcciones.'));

$pdo->beginTransaction();
try {
    $upd = $pdo->prepare(
        "UPDATE solicitudes
         SET estado = 'en_validacion',
             paso_actual = :pa,
             paso_orden = :po,
             documentos = :doc,
             actualizado_en = NOW()
         WHERE id = :id AND estado = 'devuelto'"
    );
    $upd->execute([
        ':pa'  => $primerPaso['rol'] ?? null,
        ':po'  => (int)($primerPaso['orden'] ?? 0),
        ':doc' => $documentosJson,
        ':id'  => $id,
    ]);
    if ($upd->rowCount() === 0) {
        $pdo->rollBack();
        Response::error('No se pudo reenviar. La solicitud ya fue actualizada.', 409);
    }

    // Cargar datos de usuario actualizados para usar nombre_completo
    $user['nombre_completo'] = $user['nombre_completo'] ?? 'Solicitante';

    FlujoHelpers::registrarMovimiento(
        $pdo, $id, 'reenviada', $primerPaso['rol'] ?? null,
        'en_validacion', $user, $comentario, 'publico'
    );

    // Notificar validadores del primer paso
    FlujoHelpers::notificarValidadores($pdo, $sol, $primerPaso['rol'] ?? null, (int)$sol['area_id']);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[reenviar] ' . $e->getMessage());
    Response::error('No se pudo reenviar la solicitud', 500);
}

Response::json(['ok' => true, 'estado' => 'en_validacion', 'pasoActual' => $primerPaso['rol'] ?? null]);
