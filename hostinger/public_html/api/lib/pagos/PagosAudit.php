<?php
declare(strict_types=1);

/**
 * Bitácora de acciones del Portal de Pagos, sobre la tabla de auditoría
 * genérica que ya usa el resto de PayOPS (`auditoria_logs`) — no crea una
 * tabla propia. `accion` siempre va prefijado `pagos.` para poder filtrar.
 */
final class PagosAudit
{
    public static function registrar(string $accion, ?string $entidad = null,
                                     ?string $entidadId = null, array $detalle = []): void
    {
        try {
            $detalleCompleto = $detalle;
            if ($entidad !== null) {
                $detalleCompleto['entidad'] = $entidad;
            }
            if ($entidadId !== null) {
                $detalleCompleto['entidad_id'] = $entidadId;
            }
            Db::pdo()->prepare(
                'INSERT INTO auditoria_logs (usuario_id, accion, detalle, ip, exitoso)
                 VALUES (:usuario_id, :accion, :detalle, :ip, 1)'
            )->execute([
                ':usuario_id' => PagosAuth::id(),
                ':accion'     => 'pagos.' . $accion,
                ':detalle'    => $detalleCompleto ? json_encode($detalleCompleto, JSON_UNESCAPED_UNICODE) : null,
                ':ip'         => self::ip(),
            ]);
        } catch (Throwable $e) {
            // La auditoría nunca debe tumbar la operación del usuario.
            error_log('pagos.auditoria: ' . $e->getMessage());
        }
    }

    private static function ip(): string
    {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $k) {
            if (!empty($_SERVER[$k])) {
                return substr(trim(explode(',', $_SERVER[$k])[0]), 0, 45);
            }
        }
        return '';
    }
}
