<?php
declare(strict_types=1);

/**
 * Rate limiting simple basado en archivos en /tmp.
 * Para Hostinger shared evitamos APCu / Redis.
 */
final class Throttle
{
    public static function hit(string $key, int $limit, int $windowSeconds): void
    {
        $bucket = sys_get_temp_dir() . '/gd_throttle_' . hash('sha256', $key);
        $now = time();
        $entries = [];
        if (is_readable($bucket)) {
            $raw = @file_get_contents($bucket);
            if ($raw) {
                $entries = array_filter(
                    array_map('intval', explode("\n", trim($raw))),
                    fn(int $t) => $t > ($now - $windowSeconds)
                );
            }
        }
        if (count($entries) >= $limit) {
            Response::error('Demasiadas solicitudes, intenta mas tarde', 429);
        }
        $entries[] = $now;
        @file_put_contents($bucket, implode("\n", $entries), LOCK_EX);
    }

    /**
     * IP del cliente para throttling. Usar SIEMPRE REMOTE_ADDR para evitar
     * spoofing via X-Forwarded-For (cualquiera puede mandar ese header).
     */
    public static function clientIp(): string
    {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}
