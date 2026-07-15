<?php
declare(strict_types=1);

/**
 * Registra eventos de auditoría en la tabla auditoria_logs.
 * Silencia errores para no interrumpir el flujo principal.
 */
final class Auditoria
{
    public static function registrar(
        string  $accion,
        string  $detalle   = '',
        bool    $exitoso   = true,
        ?int    $usuarioId = null,
        ?string $correo    = null,
        ?string $nombre    = null
    ): void {
        try {
            $ip        = self::clientIp();
            $userAgent = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);

            // Si no se pasan datos del usuario, intentar obtenerlos del JWT
            if ($usuarioId === null) {
                try {
                    $token = Jwt::bearer();
                    if ($token) {
                        $payload = Jwt::verify($token);
                        if ($payload) {
                            $usuarioId = isset($payload['sub']) ? (int)$payload['sub'] : null;
                            $correo    = $correo  ?? ($payload['correo']  ?? null);
                        }
                    }
                } catch (Throwable) { /* sin JWT = ok */ }
            }

            // Buscar nombre del usuario si tenemos ID pero no nombre
            if ($usuarioId && !$nombre) {
                try {
                    $pdo  = Db::pdo();
                    $stmt = $pdo->prepare('SELECT nombre_completo, correo FROM usuarios WHERE id = ? LIMIT 1');
                    $stmt->execute([$usuarioId]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($row) {
                        $nombre = $nombre ?? $row['nombre_completo'];
                        $correo = $correo ?? $row['correo'];
                    }
                } catch (Throwable) { /* ok */ }
            }

            $pdo  = Db::pdo();
            $stmt = $pdo->prepare(
                'INSERT INTO auditoria_logs (usuario_id, correo, nombre_completo, accion, detalle, ip, user_agent, exitoso)
                 VALUES (:uid, :correo, :nombre, :accion, :detalle, :ip, :ua, :exitoso)'
            );
            $stmt->execute([
                ':uid'     => $usuarioId,
                ':correo'  => $correo,
                ':nombre'  => $nombre,
                ':accion'  => $accion,
                ':detalle' => $detalle ?: null,
                ':ip'      => $ip,
                ':ua'      => $userAgent ?: null,
                ':exitoso' => $exitoso ? 1 : 0,
            ]);
        } catch (Throwable $e) {
            error_log('[auditoria] ' . $e->getMessage());
        }
    }

    private static function clientIp(): string
    {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $key) {
            $val = $_SERVER[$key] ?? '';
            if ($val !== '') {
                return trim(explode(',', $val)[0]);
            }
        }
        return 'unknown';
    }
}
