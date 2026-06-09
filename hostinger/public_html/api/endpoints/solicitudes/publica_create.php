<?php
declare(strict_types=1);

// Endpoint PUBLICO (sin auth) para crear solicitudes desde la pagina /radicacion-cuenta-cobro-ops
// Rate limit agresivo para evitar abuso.
Throttle::hit('sol-pub:' . Throttle::clientIp(), 5, 60);
Throttle::hit('sol-pub-hour:' . Throttle::clientIp(), 25, 3600);

$body = Request::body();
$tipoId = (int)($body['tipoSolicitudId'] ?? 0);
$datos = is_array($body['datos'] ?? null) ? $body['datos'] : null;
$documentos = is_array($body['documentos'] ?? null) ? $body['documentos'] : [];
$firmaProfesional = isset($body['firmas']['profesional']) ? (string)$body['firmas']['profesional'] : '';

// Validar firma: tamano y formato data:image
if ($firmaProfesional !== '') {
    if (!preg_match('#^data:image/(png|jpe?g);base64,#', $firmaProfesional)) {
        Response::error('Firma con formato invalido', 400);
    }
    if (strlen($firmaProfesional) > 300000) { // ~225 KB de imagen
        Response::error('Firma demasiado grande', 413);
    }
}

// Datos del solicitante externo (obligatorios)
$solNombre = trim((string)($body['solicitante']['nombre'] ?? ''));
$solCorreo = strtolower(trim((string)($body['solicitante']['correo'] ?? '')));
// Aceptar alfanumerico (CC/CE/pasaporte) limitado: 4-20 chars
$solCC = trim((string)($body['solicitante']['cc'] ?? ''));
$solCC = preg_replace('/[^A-Za-z0-9-]/', '', $solCC) ?? '';
$solCC = substr($solCC, 0, 20);

if ($tipoId <= 0 || !$datos) Response::error('tipoSolicitudId y datos son obligatorios', 400);
if ($solNombre === '' || strlen($solNombre) > 200) {
    Response::error('Nombre del solicitante invalido', 400);
}
if ($solCorreo === '' || strlen($solCorreo) > 150) {
    Response::error('Correo invalido', 400);
}
if (strlen($solCC) < 4) {
    Response::error('Documento del solicitante invalido', 400);
}
if (!filter_var($solCorreo, FILTER_VALIDATE_EMAIL)) {
    Response::error('Correo invalido', 400);
}

$pdo = Db::pdo();

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

$campos = json_decode($tipo['campos_plantilla'] ?? '[]', true) ?: [];
$keysPermitidas = array_flip(array_map(fn($c) => (string)($c['key'] ?? ''), $campos));
// Permitir tambien las claves auxiliares de tipo *__letras (autogeneradas)
foreach (array_keys($keysPermitidas) as $k) {
    $keysPermitidas[$k . '__letras'] = true;
}

// Filtrar datos contra plantilla: solo conservar keys conocidas, valores string <= 5000 chars
$datosLimpios = [];
foreach ($datos as $k => $v) {
    if (!isset($keysPermitidas[$k])) continue;
    if (is_scalar($v)) {
        $datosLimpios[$k] = mb_substr((string)$v, 0, 5000);
    }
}
$datos = $datosLimpios;

// Filtrar documentos contra plantilla
$docsLimpios = [];
foreach ($documentos as $k => $info) {
    if (!isset($keysPermitidas[$k])) continue;
    if (!is_array($info)) continue;
    $entry = [];
    if (isset($info['nombre'])) {
        $entry['nombre'] = mb_substr((string)$info['nombre'], 0, 200);
    }
    if (isset($info['ocrTexto'])) {
        $entry['ocrTexto'] = mb_substr((string)$info['ocrTexto'], 0, 5000);
    }
    if (isset($info['ocrConfianza'])) {
        $entry['ocrConfianza'] = (float)$info['ocrConfianza'];
    }
    if (isset($info['ocrAlertas']) && is_array($info['ocrAlertas'])) {
        $entry['ocrAlertas'] = array_slice(array_map(fn($a) => mb_substr((string)$a, 0, 500), $info['ocrAlertas']), 0, 10);
    }
    $docsLimpios[$k] = $entry;
}
$documentos = $docsLimpios;

// Tope de tamano total post-filtro
if (strlen(json_encode($datos)) > 80000 || strlen(json_encode($documentos)) > 200000) {
    Response::error('Payload demasiado grande', 413);
}

$alertas = [];
foreach ($campos as $c) {
    if (!empty($c['required']) && empty($datos[$c['key']]) && empty($documentos[$c['key']])) {
        $alertas[] = [
            'tipo' => 'campo_vacio',
            'campo' => $c['key'],
            'descripcion' => "Campo obligatorio faltante: {$c['label']}",
            'severidad' => 'alta',
        ];
    }
}

// Alertas OCR del cliente
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

$flujo = json_decode($tipo['flujo_aprobacion'] ?? '[]', true) ?: [];
usort($flujo, fn($a, $b) => ($a['orden'] ?? 0) <=> ($b['orden'] ?? 0));
$primerPaso = $flujo[0] ?? null;

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
         (:num, :tid, :aid, NULL, :unom, :ucor, :udoc, :dat, :doc, :firmas, :ale,
          'en_validacion', :pa, :po)"
    );
    $ins->execute([
        ':num' => $numero,
        ':tid' => $tipoId,
        ':aid' => (int)$tipo['area_id'],
        ':unom' => $solNombre,
        ':ucor' => $solCorreo,
        ':udoc' => $solCC,
        ':dat' => json_encode($datos, JSON_UNESCAPED_UNICODE),
        ':doc' => json_encode($documentos, JSON_UNESCAPED_UNICODE),
        ':firmas' => $firmasJson,
        ':ale' => json_encode($alertas, JSON_UNESCAPED_UNICODE),
        ':pa'  => $primerPaso['rol'] ?? null,
        ':po'  => $primerPaso['orden'] ?? 1,
    ]);
    $solId = (int)$pdo->lastInsertId();

    $mov = $pdo->prepare(
        "INSERT INTO solicitud_movimientos
         (solicitud_id, accion, paso, estado_resultado, usuario_nombre, comentario, visibilidad)
         VALUES (:s, 'creada', :pa, 'en_validacion', :un, :c, 'publico')"
    );
    $mov->execute([
        ':s' => $solId,
        ':pa' => $primerPaso['rol'] ?? null,
        ':un' => $solNombre,
        ':c' => 'Solicitud publica creada. Pendiente de ' . ($primerPaso['label'] ?? 'validacion'),
    ]);

    // Confirmacion al solicitante
    try {
        require_once __DIR__ . '/_flujo.php';
        FlujoHelpers::notificarSolicitante(
            ['solicitante_correo' => $solCorreo, 'numero_radicado' => $numero, 'solicitante_nombre' => $solNombre],
            "Solicitud {$numero} recibida",
            "Recibimos tu solicitud correctamente y ya entró al flujo de validación.\n\n" .
            "Tipo de solicitud: {$tipo['nombre']}\n" .
            "Área responsable: {$tipo['area_nombre']}\n\n" .
            "Guarda tu número de radicado. Puedes consultar el estado en cualquier momento ingresando tu radicado y número de documento en la opción “Consultar estado” del portal.\n\n" .
            "Te avisaremos por este medio cuando haya novedades."
        );
        FlujoHelpers::notificarValidadores(
            $pdo,
            [
                'numero_radicado'    => $numero,
                'tipo_nombre'        => $tipo['nombre'] ?? '',
                'area_nombre'        => $tipo['area_nombre'] ?? '',
                'solicitante_nombre' => $solNombre,
            ],
            $primerPaso['rol'] ?? null,
            (int)$tipo['area_id']
        );
    } catch (Throwable $e) {
        error_log('[publica_create email] ' . $e->getMessage());
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[publica_create] ' . $e->getMessage());
    Response::error('No se pudo crear la solicitud', 500);
}

Response::json([
    'id' => $solId,
    'numeroRadicado' => $numero,
    'estado' => 'en_validacion',
    'alertas' => $alertas,
], 201);
