<?php
declare(strict_types=1);

$jwt = Auth::requireUser();
$body = Request::body();

$tipoId = (int)($body['tipoSolicitudId'] ?? 0);
$datosFormulario = is_array($body['datos'] ?? null) ? $body['datos'] : null;
$documentos = is_array($body['documentos'] ?? null) ? $body['documentos'] : [];
$firmaProfesional = isset($body['firmas']['profesional']) ? (string)$body['firmas']['profesional'] : '';

if ($tipoId <= 0) Response::error('tipoSolicitudId es obligatorio', 400);
if (!$datosFormulario) Response::error('datos del formulario son obligatorios', 400);

$pdo = Db::pdo();

// Cargar tipo + area
$stmt = $pdo->prepare(
    "SELECT t.*, a.nombre AS area_nombre, a.slug AS area_slug, a.activo AS area_activo
     FROM tipos_solicitud t
     INNER JOIN areas a ON a.id = t.area_id
     WHERE t.id = :id LIMIT 1"
);
$stmt->execute([':id' => $tipoId]);
$tipo = $stmt->fetch();
if (!$tipo) Response::error('Tipo de solicitud no encontrado', 404);
if ((int)$tipo['activo'] !== 1) Response::error('Tipo de solicitud inactivo', 400);
if ((int)$tipo['area_activo'] !== 1) Response::error('El area esta inactiva', 400);

// Validar campos requeridos
$campos = json_decode($tipo['campos_plantilla'] ?? '[]', true) ?: [];
$alertas = [];
foreach ($campos as $c) {
    if (!empty($c['required']) && empty($datosFormulario[$c['key']]) && empty($documentos[$c['key']])) {
        $alertas[] = [
            'tipo' => 'campo_vacio',
            'campo' => $c['key'],
            'descripcion' => "Campo obligatorio faltante: {$c['label']}",
            'severidad' => 'alta',
        ];
    }
}

// Incorporar alertas OCR detectadas en el cliente
foreach ($documentos as $key => $info) {
    if (is_array($info) && !empty($info['ocrAlertas']) && is_array($info['ocrAlertas'])) {
        foreach ($info['ocrAlertas'] as $alertaTexto) {
            $alertas[] = [
                'tipo' => 'ocr_mismatch',
                'campo' => $key,
                'descripcion' => (string)$alertaTexto,
                'severidad' => 'media',
            ];
        }
        // Si confianza es muy baja, agregar severidad alta
        if (isset($info['ocrConfianza']) && $info['ocrConfianza'] < 40) {
            $alertas[] = [
                'tipo' => 'documento_ilegible',
                'campo' => $key,
                'descripcion' => "Documento ilegible en {$key}",
                'severidad' => 'alta',
            ];
        }
    }
}

// Tomar usuario del JWT
$usuarioId = (int)($jwt['sub'] ?? 0);
$u = $pdo->prepare("SELECT id, nombre_completo, correo, numero_documento, area_id FROM usuarios WHERE id = :id LIMIT 1");
$u->execute([':id' => $usuarioId]);
$usuario = $u->fetch();

// Reglas especiales del tipo "anticipo"
$esAnticipo = (($tipo['slug'] ?? '') === 'anticipo');
// El area de la solicitud es la del solicitante (para que validen analista/director de SU area)
$areaSolicitud = (int)$tipo['area_id'];
if ($esAnticipo && !empty($usuario['area_id'])) {
    $areaSolicitud = (int)$usuario['area_id'];
}
// Limite: maximo 2 anticipos abiertos (sin legalizar / no rechazados)
if ($esAnticipo) {
    $lim = $pdo->prepare(
        "SELECT COUNT(*) FROM solicitudes
         WHERE solicitante_usuario_id = :u AND tipo_solicitud_id = :t
           AND estado NOT IN ('legalizado','rechazado')"
    );
    $lim->execute([':u' => $usuarioId, ':t' => $tipoId]);
    if ((int)$lim->fetchColumn() >= 2) {
        Response::error('No puedes tener más de 2 anticipos abiertos a la vez. Legaliza (paga con facturas) uno antes de crear otro.', 409);
    }
}

// Determinar primer paso del flujo
$flujo = json_decode($tipo['flujo_aprobacion'] ?? '[]', true) ?: [];
usort($flujo, fn($a, $b) => ($a['orden'] ?? 0) <=> ($b['orden'] ?? 0));
$primerPaso = $flujo[0] ?? null;

// Generar numero de radicado
require_once __DIR__ . '/../radicados/_helpers.php';
$numero = RadicadoHelpers::generarNumero($pdo, (string)($tipo['area_nombre'] ?? ''));

$pdo->beginTransaction();
try {
    $firmasJson = $firmaProfesional
        ? json_encode(['profesional' => $firmaProfesional], JSON_UNESCAPED_UNICODE)
        : null;
    $ins = $pdo->prepare(
        "INSERT INTO solicitudes
         (numero_radicado, tipo_solicitud_id, area_id, solicitante_usuario_id,
          solicitante_nombre, solicitante_correo, solicitante_documento,
          datos_formulario, documentos, firmas, alertas, estado, paso_actual, paso_orden)
         VALUES
         (:num, :tid, :aid, :uid, :unom, :ucor, :udoc,
          :dat, :doc, :firmas, :ale, 'en_validacion', :pa, :po)"
    );
    $ins->execute([
        ':num'  => $numero,
        ':tid'  => $tipoId,
        ':aid'  => $areaSolicitud,
        ':uid'  => $usuario ? (int)$usuario['id'] : null,
        ':unom' => $usuario['nombre_completo'] ?? null,
        ':ucor' => $usuario['correo'] ?? null,
        ':udoc' => $usuario['numero_documento'] ?? null,
        ':dat'  => json_encode($datosFormulario, JSON_UNESCAPED_UNICODE),
        ':doc'  => json_encode($documentos, JSON_UNESCAPED_UNICODE),
        ':firmas' => $firmasJson,
        ':ale'  => json_encode($alertas, JSON_UNESCAPED_UNICODE),
        ':pa'   => $primerPaso['rol'] ?? null,
        ':po'   => $primerPaso['orden'] ?? 1,
    ]);
    $solicitudId = (int)$pdo->lastInsertId();

    // Registrar primer movimiento (creacion)
    $mov = $pdo->prepare(
        "INSERT INTO solicitud_movimientos
         (solicitud_id, accion, paso, estado_resultado, usuario_id, usuario_nombre, comentario, visibilidad)
         VALUES (:s, 'creada', :pa, 'en_validacion', :u, :un, :c, 'publico')"
    );
    $mov->execute([
        ':s'  => $solicitudId,
        ':pa' => $primerPaso['rol'] ?? null,
        ':u'  => $usuario ? (int)$usuario['id'] : null,
        ':un' => $usuario['nombre_completo'] ?? null,
        ':c'  => 'Solicitud creada. Pendiente de validacion por ' . ($primerPaso['label'] ?? 'el siguiente paso'),
    ]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[solicitudes/create] ' . $e->getMessage());
    Response::error('No se pudo crear la solicitud', 500);
}

// Notificaciones (no bloquean la respuesta si fallan)
require_once __DIR__ . '/_flujo.php';
$solNotif = [
    'numero_radicado'    => $numero,
    'tipo_nombre'        => $tipo['nombre'] ?? '',
    'area_nombre'        => $tipo['area_nombre'] ?? '',
    'solicitante_nombre' => $usuario['nombre_completo'] ?? '',
    'solicitante_correo' => $usuario['correo'] ?? '',
];
if (!empty($usuario['correo'])) {
    FlujoHelpers::notificarSolicitante(
        $solNotif,
        "Solicitud {$numero} creada",
        "Tu solicitud fue creada correctamente y entró al flujo de validación.\n\n" .
        "Tipo: {$tipo['nombre']}\n" .
        "Área: {$tipo['area_nombre']}\n\n" .
        "Te avisaremos por este medio cuando avance."
    );
}
FlujoHelpers::notificarValidadores($pdo, $solNotif, $primerPaso['rol'] ?? null, $areaSolicitud);

Response::json([
    'id'             => $solicitudId,
    'numeroRadicado' => $numero,
    'estado'         => 'en_validacion',
    'pasoActual'     => $primerPaso['rol'] ?? null,
    'pasoLabel'      => $primerPaso['label'] ?? null,
    'alertas'        => $alertas,
], 201);
