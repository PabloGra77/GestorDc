<?php
declare(strict_types=1);

/**
 * Helpers para flujo de aprobacion de solicitudes.
 */
final class FlujoHelpers
{
    /**
     * Carga la solicitud + tipo + datos del usuario actuante.
     * Verifica que el usuario tenga permiso para actuar en el paso actual.
     */
    public static function cargarYAutorizar(PDO $pdo, int $solicitudId, int $usuarioId): array
    {
        $sStmt = $pdo->prepare(
            "SELECT s.*, t.flujo_aprobacion, t.nombre AS tipo_nombre, t.slug AS tipo_slug
             FROM solicitudes s
             INNER JOIN tipos_solicitud t ON t.id = s.tipo_solicitud_id
             WHERE s.id = :id LIMIT 1"
        );
        $sStmt->execute([':id' => $solicitudId]);
        $sol = $sStmt->fetch();
        if (!$sol) Response::error('Solicitud no encontrada', 404);

        $uStmt = $pdo->prepare(
            "SELECT u.id, u.nombre_completo, u.area_id, u.nivel_aprobacion, r.nombre AS rol
             FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id WHERE u.id = :id LIMIT 1"
        );
        $uStmt->execute([':id' => $usuarioId]);
        $user = $uStmt->fetch();
        if (!$user) Response::error('Usuario no encontrado', 404);

        $esAdmin = strtolower(trim($user['rol'] ?? '')) === 'administrador';
        $pasoActual = $sol['paso_actual'] ?? '';
        $nivelUsuario = $user['nivel_aprobacion'] ?? '';

        // Admin puede actuar siempre. Contabilidad ve todas las areas.
        // Otros niveles requieren que su nivel coincida con el paso actual Y que el area coincida.
        $puede = false;
        if ($esAdmin) {
            $puede = true;
        } elseif ($nivelUsuario === $pasoActual) {
            if ($nivelUsuario === 'contabilidad') {
                $puede = true; // contabilidad ve todas las areas
            } elseif ((int)($user['area_id'] ?? 0) === (int)$sol['area_id']) {
                $puede = true;
            }
        }

        if (!$puede) {
            Response::error('No tienes permisos para actuar en este paso', 403);
        }

        return ['sol' => $sol, 'user' => $user];
    }

    public static function registrarMovimiento(
        PDO $pdo, int $solicitudId, string $accion, ?string $paso,
        ?string $estadoResultado, array $user, string $comentario, string $visibilidad = 'interno'
    ): void {
        $mov = $pdo->prepare(
            "INSERT INTO solicitud_movimientos
             (solicitud_id, accion, paso, estado_resultado, usuario_id, usuario_nombre, usuario_rol, comentario, visibilidad)
             VALUES (:s, :a, :p, :er, :u, :un, :ur, :c, :v)"
        );
        $mov->execute([
            ':s'  => $solicitudId,
            ':a'  => $accion,
            ':p'  => $paso,
            ':er' => $estadoResultado,
            ':u'  => (int)$user['id'],
            ':un' => $user['nombre_completo'] ?? null,
            ':ur' => $user['nivel_aprobacion'] ?? ($user['rol'] ?? null),
            ':c'  => $comentario,
            ':v'  => $visibilidad,
        ]);
    }

    public static function siguientePaso(string $flujoJson, ?string $pasoActual): ?array
    {
        $flujo = json_decode($flujoJson ?? '[]', true) ?: [];
        usort($flujo, fn($a, $b) => ($a['orden'] ?? 0) <=> ($b['orden'] ?? 0));
        $idx = -1;
        foreach ($flujo as $i => $p) {
            if (($p['rol'] ?? '') === $pasoActual) { $idx = $i; break; }
        }
        if ($idx < 0) return null;
        return $flujo[$idx + 1] ?? null;
    }

    public static function notificarSolicitante(array $sol, string $asunto, string $texto): void
    {
        $correo = $sol['solicitante_correo'] ?? '';
        if (!$correo) return;
        try {
            Mailer::send([
                'to'      => [$correo],
                'subject' => $asunto,
                'text'    => $texto,
                'html'    => self::emailHtml($asunto, $texto, $sol),
            ]);
        } catch (Throwable $e) {
            error_log('[flujo notif] ' . $e->getMessage());
        }
    }

    /**
     * Avisa por correo a los validadores cuyo turno es el paso indicado.
     * Contabilidad ve todas las áreas; los demás niveles solo su área.
     */
    public static function notificarValidadores(PDO $pdo, array $sol, ?string $paso, int $areaId): void
    {
        if (!$paso) return;
        try {
            $stmt = $pdo->prepare(
                "SELECT u.correo, u.nombre_completo
                 FROM usuarios u
                 WHERE u.activo = 1 AND u.nivel_aprobacion = :paso
                   AND (:paso2 = 'contabilidad' OR u.area_id = :area)"
            );
            $stmt->execute([':paso' => $paso, ':paso2' => $paso, ':area' => $areaId]);
            $rows = $stmt->fetchAll();
        } catch (Throwable $e) {
            error_log('[notif validadores] ' . $e->getMessage());
            return;
        }
        $radic = (string)($sol['numero_radicado'] ?? '');
        $tipoNom = (string)($sol['tipo_nombre'] ?? 'una solicitud');
        $areaNom = (string)($sol['area_nombre'] ?? '');
        $solic = (string)($sol['solicitante_nombre'] ?? '');
        foreach ($rows as $r) {
            $correo = $r['correo'] ?? '';
            if (!$correo) continue;
            $texto = "Tienes una solicitud pendiente de validación en Payops.\n\n"
                . "Radicado: {$radic}\n"
                . "Tipo: {$tipoNom}\n"
                . ($areaNom ? "Área: {$areaNom}\n" : '')
                . ($solic ? "Solicitante: {$solic}\n" : '')
                . "\nIngresa a Payops → Radicaciones → Bandeja de validación para revisarla.";
            try {
                Mailer::send([
                    'to'      => [$correo],
                    'subject' => "Solicitud por validar: {$radic}",
                    'text'    => $texto,
                    'html'    => self::emailHtml('Tienes una solicitud por validar', $texto, [
                        'numero_radicado'   => $radic,
                        'solicitante_nombre' => $r['nombre_completo'] ?? '',
                    ]),
                ]);
            } catch (Throwable $e) {
                error_log('[notif validador] ' . $e->getMessage());
            }
        }
    }

    /**
     * Envoltorio HTML con identidad Payops · Goleman IPS para los correos.
     * Convierte el texto plano (con saltos de línea) en párrafos seguros.
     */
    public static function emailHtml(string $asunto, string $texto, array $sol): string
    {
        $radicado = htmlspecialchars((string)($sol['numero_radicado'] ?? ''), ENT_QUOTES, 'UTF-8');
        $nombre   = trim((string)($sol['solicitante_nombre'] ?? ''));
        $saludo   = $nombre !== '' ? 'Hola, ' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . ':' : 'Hola:';
        $tituloSeguro = htmlspecialchars($asunto, ENT_QUOTES, 'UTF-8');

        // Párrafos: separa por líneas en blanco y respeta saltos simples
        $cuerpo = '';
        foreach (preg_split('/\n{2,}/', trim($texto)) ?: [] as $par) {
            $par = nl2br(htmlspecialchars($par, ENT_QUOTES, 'UTF-8'));
            $cuerpo .= '<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.65;">' . $par . '</p>';
        }

        $chip = '';
        if ($radicado !== '') {
            $chip = '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">'
                . '<tr><td style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:4px solid #D4AF37;border-radius:8px;padding:14px 18px;">'
                . '<span style="display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#94A3B8;font-weight:700;">Número de radicado</span>'
                . '<span style="display:block;font-size:22px;font-weight:800;color:#0F172A;font-family:Consolas,Menlo,monospace;margin-top:2px;">' . $radicado . '</span>'
                . '</td></tr></table>';
        }

        return '<!doctype html><html lang="es"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
            . '<body style="margin:0;padding:0;background:#EEF2F7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;padding:24px 12px;">'
            . '<tr><td align="center">'
            . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(8,11,29,.10);">'
            // Encabezado
            . '<tr><td style="background:#070B1D;padding:22px 28px;">'
            . '<span style="color:#FFFFFF;font-size:20px;font-weight:800;letter-spacing:.5px;">Payops</span>'
            . '<span style="color:#D4AF37;font-size:13px;font-weight:600;"> · Goleman IPS</span>'
            . '</td></tr>'
            // Cuerpo
            . '<tr><td style="padding:28px 28px 8px;">'
            . '<h1 style="margin:0 0 6px;font-size:19px;color:#0F172A;">' . $tituloSeguro . '</h1>'
            . '<p style="margin:0 0 16px;color:#0F172A;font-size:15px;font-weight:600;">' . $saludo . '</p>'
            . $chip
            . $cuerpo
            . '</td></tr>'
            // Pie
            . '<tr><td style="padding:18px 28px 26px;border-top:1px solid #EEF2F7;">'
            . '<p style="margin:0;color:#94A3B8;font-size:12px;line-height:1.6;">Este es un mensaje automático de Payops, la plataforma documental de Goleman IPS. Por favor no respondas a este correo.</p>'
            . '</td></tr>'
            . '</table>'
            . '<p style="color:#B6C0CE;font-size:11px;margin:16px 0 0;">© ' . date('Y') . ' Goleman IPS · Servicio Integral SAS</p>'
            . '</td></tr></table></body></html>';
    }
}
