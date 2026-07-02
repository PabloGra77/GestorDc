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
if (strlen($firma) > 300_000) {
    Response::error('La firma excede el tamaño máximo permitido (300 KB)', 413);
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
        // No hay siguiente paso = aprobada definitivamente.
        $esAnticipo     = (($sol['tipo_slug'] ?? '') === 'anticipo');
        $esLegalizacion = (($sol['tipo_slug'] ?? '') === 'legalizacion');
        $estadoFinal    = $esAnticipo ? 'por_legalizar' : 'aprobado';
        $upd = $pdo->prepare(
            "UPDATE solicitudes
             SET estado = :ef, paso_actual = NULL, aprobado_en = UTC_TIMESTAMP(), firmas = :firmas
             WHERE id = :id AND estado = 'en_validacion' AND paso_actual = :pa_prev"
        );
        $upd->execute([':ef' => $estadoFinal, ':id' => $id, ':pa_prev' => $sol['paso_actual'], ':firmas' => $firmasJson]);
        if ($upd->rowCount() === 0) {
            $pdo->rollBack();
            Response::error('La solicitud ya fue actualizada por otro validador', 409);
        }
        FlujoHelpers::registrarMovimiento(
            $pdo, $id, 'aprobada', $sol['paso_actual'],
            $estadoFinal, $user, $comentario, 'publico'
        );

        if ($esLegalizacion) {
            // Registrar facturas para detección de duplicados futuros
            $datosSol = json_decode($sol['datos_formulario'] ?? '{}', true) ?: [];
            $gastos   = [];
            if (isset($datosSol['gastos']) && is_string($datosSol['gastos'])) {
                $gastos = json_decode($datosSol['gastos'], true) ?: [];
            } elseif (is_array($datosSol['gastos'] ?? null)) {
                $gastos = $datosSol['gastos'];
            }
            $insF = $pdo->prepare(
                "INSERT INTO facturas_legalizadas
                 (solicitud_id, numero_factura, nit_proveedor, nombre_proveedor, fecha_factura, valor_factura, archivo_hash, categoria)
                 VALUES (:sid, :nf, :nit, :np, :fd, :vf, :ha, :cat)"
            );
            foreach ($gastos as $gasto) {
                $fechaFact = null;
                if (!empty($gasto['fechaFactura'])) {
                    $parsed = strtotime((string)$gasto['fechaFactura']);
                    $fechaFact = $parsed ? date('Y-m-d', $parsed) : null;
                }
                $insF->execute([
                    ':sid' => $id,
                    ':nf'  => mb_substr(trim((string)($gasto['numeroFactura'] ?? '')), 0, 120) ?: null,
                    ':nit' => preg_replace('/\D/', '', (string)($gasto['nitProveedor'] ?? '')) ?: null,
                    ':np'  => mb_substr(trim((string)($gasto['nombreProveedor'] ?? '')), 0, 200) ?: null,
                    ':fd'  => $fechaFact,
                    ':vf'  => (float)str_replace(['.', ','], ['', '.'], (string)($gasto['valor'] ?? '0')),
                    ':ha'  => mb_substr(trim((string)($gasto['_facturaHash'] ?? '')), 0, 64) ?: null,
                    ':cat' => mb_substr(trim((string)($gasto['categoria'] ?? '')), 0, 80) ?: null,
                ]);
            }
            // Mensaje de pago personalizable
            $mensajePlantilla = Settings::get(
                'legalizacion.mensaje_pago',
                'Tu solicitud de legalización con número de radicado {radicado} fue aprobada. El pago será realizado en el transcurso de los días hábiles.'
            ) ?? '';
            $mensajeFinal = str_replace('{radicado}', $sol['numero_radicado'], $mensajePlantilla);
            FlujoHelpers::registrarMovimiento(
                $pdo, $id, 'mensaje_pago', null, 'aprobado',
                ['id' => 0, 'nombre_completo' => 'Sistema Payops', 'nivel_aprobacion' => 'sistema'],
                $mensajeFinal, 'publico'
            );
            FlujoHelpers::notificarSolicitante($sol,
                "Legalización {$sol['numero_radicado']} aprobada — pago en proceso",
                $mensajeFinal
            );
        } elseif ($esAnticipo) {
            $datosSol = json_decode($sol['datos_formulario'] ?? '{}', true) ?: [];
            $fechaLeg = (string)($datosSol['fechaLegalizacion'] ?? '');
            FlujoHelpers::notificarSolicitante($sol,
                "Anticipo {$sol['numero_radicado']} aprobado - debes legalizar",
                "Tu anticipo {$sol['numero_radicado']} fue APROBADO." .
                ($fechaLeg ? " Recuerda que te comprometiste a legalizarlo a mas tardar el {$fechaLeg}." : " Recuerda legalizarlo subiendo las facturas/soportes del gasto.") .
                "\n\nIngresa a Payops -> Mis solicitudes -> Legalizar y adjunta las evidencias del gasto."
            );
        } else {
            FlujoHelpers::notificarSolicitante($sol,
                "Solicitud {$sol['numero_radicado']} aprobada",
                "Su solicitud {$sol['numero_radicado']} fue aprobada definitivamente. Comentario: {$comentario}"
            );
        }
        $nuevoEstado    = $estadoFinal;
        $nuevoPaso      = null;
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
