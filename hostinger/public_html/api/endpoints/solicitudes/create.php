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
$esAnticipo      = (($tipo['slug'] ?? '') === 'anticipo');
$esLegalizacion  = (($tipo['slug'] ?? '') === 'legalizacion');

// El area de la solicitud es la del solicitante
$areaSolicitud = (int)$tipo['area_id'];
if (($esAnticipo || $esLegalizacion) && !empty($usuario['area_id'])) {
    $areaSolicitud = (int)$usuario['area_id'];
}

// Limite: maximo 2 anticipos abiertos
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

// ──────────────────────────────────────────────────────────
// Validaciones específicas de LEGALIZACIONES
// ──────────────────────────────────────────────────────────
if ($esLegalizacion) {
    // 1. Autorizador obligatorio
    $autorizadorId = (int)($datosFormulario['autorizadorId'] ?? 0);
    if ($autorizadorId === 0) {
        Response::error('Debes seleccionar el usuario que autorizó el gasto', 400);
    }
    // Verificar que el autorizador exista y esté activo
    $aStmt = $pdo->prepare("SELECT id FROM usuarios WHERE id = :id AND activo = 1 LIMIT 1");
    $aStmt->execute([':id' => $autorizadorId]);
    if (!$aStmt->fetch()) {
        Response::error('El autorizador seleccionado no existe o está inactivo', 400);
    }

    // 2. Gastos: cada ítem debe tener factura
    $gastos = [];
    if (isset($datosFormulario['gastos']) && is_string($datosFormulario['gastos'])) {
        $gastos = json_decode($datosFormulario['gastos'], true) ?: [];
    } elseif (is_array($datosFormulario['gastos'] ?? null)) {
        $gastos = $datosFormulario['gastos'];
    }
    if (count($gastos) === 0) {
        Response::error('Debes agregar al menos un gasto con su factura', 400);
    }
    foreach ($gastos as $idx => $gasto) {
        if (empty($gasto['_facturaArchivoId']) && empty($gasto['_factura'])) {
            $cat = $gasto['categoria'] ?? "ítem " . ($idx + 1);
            Response::error("El gasto \"$cat\" no tiene factura adjunta. Todos los gastos deben tener factura.", 400);
        }
    }

    // 3. Validar suma de valores vs total declarado
    $totalDeclarado = (float)str_replace(['.', ','], ['', '.'], (string)($datosFormulario['totalGastos'] ?? '0'));
    $sumaGastos = array_reduce($gastos, function ($acc, $g) {
        return $acc + (float)str_replace(['.', ','], ['', '.'], (string)($g['valor'] ?? '0'));
    }, 0.0);
    if ($totalDeclarado > 0 && abs($sumaGastos - $totalDeclarado) > 1) {
        Response::error(
            sprintf(
                'La suma de los gastos ($%s) no coincide con el total declarado ($%s). Verifica los valores.',
                number_format($sumaGastos, 0, ',', '.'),
                number_format($totalDeclarado, 0, ',', '.')
            ),
            400
        );
    }

    // 4. Límite de monto configurado por admin
    $montoMaximo = (float)(Settings::get('legalizacion.monto_maximo', '0') ?? '0');
    if ($montoMaximo > 0 && $sumaGastos > $montoMaximo) {
        Response::error(
            sprintf(
                'El monto total ($%s) supera el límite permitido de $%s por legalización.',
                number_format($sumaGastos, 0, ',', '.'),
                number_format($montoMaximo, 0, ',', '.')
            ),
            400
        );
    }

    // 5. Detectar facturas duplicadas (contra facturas ya legalizadas y aprobadas)
    foreach ($gastos as $gasto) {
        $numFact  = trim((string)($gasto['numeroFactura'] ?? ''));
        $nitProv  = preg_replace('/\D/', '', (string)($gasto['nitProveedor'] ?? ''));
        $hashArch = trim((string)($gasto['_facturaHash'] ?? ''));

        if ($numFact !== '' && $nitProv !== '') {
            $dup = $pdo->prepare(
                "SELECT fl.id, s.numero_radicado
                 FROM facturas_legalizadas fl
                 INNER JOIN solicitudes s ON s.id = fl.solicitud_id
                 WHERE fl.numero_factura = :nf AND fl.nit_proveedor = :nit
                 LIMIT 1"
            );
            $dup->execute([':nf' => $numFact, ':nit' => $nitProv]);
            $dupRow = $dup->fetch();
            if ($dupRow) {
                Response::error(
                    "La factura N° {$numFact} del proveedor NIT {$nitProv} ya fue legalizada " .
                    "anteriormente (radicado {$dupRow['numero_radicado']}). No puedes legalizarla dos veces.",
                    409
                );
            }
        }

        if ($hashArch !== '') {
            $dupH = $pdo->prepare(
                "SELECT fl.id, s.numero_radicado
                 FROM facturas_legalizadas fl
                 INNER JOIN solicitudes s ON s.id = fl.solicitud_id
                 WHERE fl.archivo_hash = :h LIMIT 1"
            );
            $dupH->execute([':h' => $hashArch]);
            $dupHRow = $dupH->fetch();
            if ($dupHRow) {
                Response::error(
                    "Una de las facturas ya fue usada en una legalización anterior " .
                    "(radicado {$dupHRow['numero_radicado']}). No puedes legalizarla dos veces.",
                    409
                );
            }
        }
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
        "Área: {$tipo['area_nombre']}\n" .
        "En revisión por: " . ($primerPaso['label'] ?? 'el primer paso del flujo') . "\n\n" .
        "Te avisaremos por este medio cuando avance."
    );
}
// Para legalizacion: si el primer paso es 'autorizador_visto_bueno', notificar al autorizador
if ($esLegalizacion && ($primerPaso['rol'] ?? '') === 'autorizador_visto_bueno') {
    $autorizadorId = (int)($datosFormulario['autorizadorId'] ?? 0);
    if ($autorizadorId > 0) {
        $aCorStmt = $pdo->prepare("SELECT correo, nombre_completo FROM usuarios WHERE id = :id AND activo = 1 LIMIT 1");
        $aCorStmt->execute([':id' => $autorizadorId]);
        $autorizador = $aCorStmt->fetch();
        if ($autorizador && $autorizador['correo']) {
            try {
                Mailer::send([
                    'to'      => [$autorizador['correo']],
                    'subject' => "Requiere tu visto bueno: legalización {$numero}",
                    'text'    => "Hola {$autorizador['nombre_completo']},\n\n" .
                        "{$usuario['nombre_completo']} creó una solicitud de legalización ({$numero}) " .
                        "en la que indicó que tú autorizaste el gasto.\n\n" .
                        "Ingresa a Payops → Bandeja de validación y da tu visto bueno para que pueda continuar el trámite.",
                    'html'    => FlujoHelpers::emailHtml(
                        "Requiere tu visto bueno",
                        "Hola {$autorizador['nombre_completo']}:\n\n" .
                        "{$usuario['nombre_completo']} creó una solicitud de legalización ({$numero}) " .
                        "en la que indicó que tú autorizaste el gasto.\n\n" .
                        "Ingresa a Payops → Bandeja de validación y da tu visto bueno para que el trámite continúe.",
                        ['numero_radicado' => $numero, 'solicitante_nombre' => $autorizador['nombre_completo']]
                    ),
                ]);
            } catch (Throwable $eM) {
                error_log('[create/legalizacion] notif autorizador: ' . $eM->getMessage());
            }
        }
    }
} else {
    FlujoHelpers::notificarValidadores($pdo, $solNotif, $primerPaso['rol'] ?? null, $areaSolicitud);
}

Response::json([
    'id'             => $solicitudId,
    'numeroRadicado' => $numero,
    'estado'         => 'en_validacion',
    'pasoActual'     => $primerPaso['rol'] ?? null,
    'pasoLabel'      => $primerPaso['label'] ?? null,
    'alertas'        => $alertas,
], 201);
