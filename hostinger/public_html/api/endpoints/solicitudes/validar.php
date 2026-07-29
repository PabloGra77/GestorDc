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

// Bloqueo OPS: rechazar si hay discrepancias activas entre lo declarado y el informe
if (($sol['tipo_slug'] ?? '') === 'cuenta-cobro-ops') {
    $datosOps = json_decode((string)($sol['datos_formulario'] ?? '{}'), true) ?: [];
    $ccOps    = preg_replace('/[^0-9]/', '', (string)($datosOps['numeroDocumento'] ?? $datosOps['numero_documento'] ?? ''));
    if ($ccOps !== '') {
        $piniOps = trim((string)($datosOps['periodoInicio'] ?? '')) ?: '1900-01-01';
        $pfinOps = trim((string)($datosOps['periodoFin']    ?? '')) ?: '2999-12-31';
        $tipoPlanOps = trim((string)($datosOps['tipoPlantillaAtenciones'] ?? 'ppl'));
        $infChk = $pdo->prepare(
            "SELECT id FROM informes_ops
             WHERE (periodo_inicio IS NULL OR periodo_fin IS NULL
                    OR (periodo_inicio <= :pfin AND periodo_fin >= :pini))
             ORDER BY subido_en DESC LIMIT 1"
        );
        $infChk->execute([':pini' => $piniOps, ':pfin' => $pfinOps]);
        $infIdOps = (int)($infChk->fetchColumn() ?: 0);
        if ($infIdOps > 0) {
            $hayDiscOps = false;
            if ($tipoPlanOps === 'servicio') {
                $filasOps = json_decode((string)($datosOps['atencionesServicioJson'] ?? '[]'), true) ?: [];
                foreach ($filasOps as $fd) {
                    $ccPac   = preg_replace('/[^0-9]/', '', (string)($fd['numId'] ?? ''));
                    $sv      = mb_strtoupper(trim((string)($fd['servicio'] ?? '')));
                    $sesDecl = max(1, (int)($fd['sesiones'] ?? 1));
                    if (!$ccPac || !$sv) continue;
                    $stOps = $pdo->prepare(
                        "SELECT COALESCE(SUM(d.numero_sesiones),0)
                         FROM informe_atenciones_detalle d
                         WHERE d.informe_id=:inf AND d.cc_profesional=:cc AND d.cc_paciente=:cp AND UPPER(TRIM(d.servicio))=:sv"
                    );
                    $stOps->execute([':inf'=>$infIdOps,':cc'=>$ccOps,':cp'=>$ccPac,':sv'=>$sv]);
                    if ((int)$stOps->fetchColumn() !== $sesDecl) { $hayDiscOps = true; break; }
                }
            } else {
                $filasOps = json_decode((string)($datosOps['atencionesJson'] ?? '[]'), true) ?: [];
                foreach ($filasOps as $fd) {
                    $fecha   = trim((string)($fd['fecha']    ?? ''));
                    $hcDecl  = (int)($fd['hc']      ?? 0);
                    $sv      = mb_strtoupper(trim((string)($fd['servicio'] ?? '')));
                    if (!$fecha || $hcDecl <= 0) continue;
                    if ($sv) {
                        $stOps = $pdo->prepare(
                            "SELECT COUNT(*) FROM informe_atenciones_detalle d
                             WHERE d.informe_id=:inf AND d.cc_profesional=:cc AND d.fecha_atencion=:f AND UPPER(TRIM(COALESCE(d.servicio,'')))=:sv"
                        );
                        $stOps->execute([':inf'=>$infIdOps,':cc'=>$ccOps,':f'=>$fecha,':sv'=>$sv]);
                    } else {
                        $stOps = $pdo->prepare(
                            "SELECT COUNT(*) FROM informe_atenciones_detalle d
                             WHERE d.informe_id=:inf AND d.cc_profesional=:cc AND d.fecha_atencion=:f"
                        );
                        $stOps->execute([':inf'=>$infIdOps,':cc'=>$ccOps,':f'=>$fecha]);
                    }
                    if ((int)$stOps->fetchColumn() !== $hcDecl) { $hayDiscOps = true; break; }
                }
            }
            if ($hayDiscOps) {
                Response::error(
                    'No se puede validar: las atenciones declaradas no coinciden con el informe de atenciones OPS registrado en plataforma. ' .
                    'Corrija el informe y vuelva a intentarlo.',
                    422
                );
            }
        }
    }
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
            // Mensaje de pago personalizable — se guarda en movimientos, la notificación va fuera
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

$accionAudit = ($nuevoEstado === 'en_validacion') ? 'validar' : 'aprobar';
$detalleAudit = "Radicado {$sol['numero_radicado']} · paso: {$sol['paso_actual']}"
    . ($nuevoPaso ? " → {$nuevoPaso}" : ' → Aprobado');
Auditoria::registrar($accionAudit, $detalleAudit, true, (int)$jwt['sub']);

// Notificaciones fuera de transacción para no bloquear la DB mientras SMTP responde
if ($siguiente) {
    FlujoHelpers::notificarSolicitante($sol,
        "Avance de su solicitud {$sol['numero_radicado']}",
        "Su solicitud {$sol['numero_radicado']} avanzo al siguiente paso de validacion: " . ($nuevoPasoLabel ?? $nuevoPaso)
    );
    FlujoHelpers::notificarValidadores($pdo, [
        'numero_radicado'    => $sol['numero_radicado'],
        'tipo_nombre'        => $sol['tipo_nombre'] ?? '',
        'solicitante_nombre' => $sol['solicitante_nombre'] ?? '',
    ], $siguiente['rol'] ?? null, (int)$sol['area_id']);
} else {
    $esLegalizacionFinal = (($sol['tipo_slug'] ?? '') === 'legalizacion');
    $esAnticipoFinal     = (($sol['tipo_slug'] ?? '') === 'anticipo');
    if ($esLegalizacionFinal) {
        $msgPago = str_replace('{radicado}', $sol['numero_radicado'], (string)(Settings::get(
            'legalizacion.mensaje_pago',
            'Tu solicitud de legalización con número de radicado {radicado} fue aprobada. El pago será realizado en el transcurso de los días hábiles.'
        ) ?? ''));
        FlujoHelpers::notificarSolicitante($sol,
            "Legalización {$sol['numero_radicado']} aprobada — pago en proceso",
            $msgPago
        );
    } elseif ($esAnticipoFinal) {
        $datosSolFinal = json_decode($sol['datos_formulario'] ?? '{}', true) ?: [];
        $fechaLegFinal = (string)($datosSolFinal['fechaLegalizacion'] ?? '');
        FlujoHelpers::notificarSolicitante($sol,
            "Anticipo {$sol['numero_radicado']} aprobado - debes legalizar",
            "Tu anticipo {$sol['numero_radicado']} fue APROBADO." .
            ($fechaLegFinal ? " Recuerda que te comprometiste a legalizarlo a mas tardar el {$fechaLegFinal}." : " Recuerda legalizarlo subiendo las facturas/soportes del gasto.") .
            "\n\nIngresa a Payops -> Mis solicitudes -> Legalizar y adjunta las evidencias del gasto."
        );
    } else {
        FlujoHelpers::notificarSolicitante($sol,
            "Solicitud {$sol['numero_radicado']} aprobada",
            "Su solicitud {$sol['numero_radicado']} fue aprobada definitivamente. Comentario: {$comentario}"
        );
    }
}

Response::json([
    'ok' => true,
    'estado' => $nuevoEstado,
    'pasoActual' => $nuevoPaso,
    'pasoLabel' => $nuevoPasoLabel,
]);
