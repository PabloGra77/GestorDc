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
            "SELECT s.*, t.flujo_aprobacion, t.nombre AS tipo_nombre
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
            ]);
        } catch (Throwable $e) {
            error_log('[flujo notif] ' . $e->getMessage());
        }
    }
}
