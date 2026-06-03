<?php
declare(strict_types=1);

/**
 * Configuracion clave/valor persistida en la tabla `configuracion`.
 * Usada para parametros editables desde el panel de administrador (ej. SMTP).
 * Si la tabla aun no existe o la clave no esta, devuelve el default (normalmente
 * el valor del .env), de modo que el sistema nunca se rompe por falta de config.
 */
final class Settings
{
    private static ?array $cache = null;

    private static function loadAll(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }
        self::$cache = [];
        try {
            $pdo = Db::pdo();
            $rows = $pdo->query("SELECT clave, valor FROM configuracion")->fetchAll();
            foreach ($rows as $r) {
                self::$cache[(string)$r['clave']] = $r['valor'];
            }
        } catch (Throwable $e) {
            // La tabla puede no existir todavia: degradar a vacio (se usara el .env).
            error_log('[settings] ' . $e->getMessage());
            self::$cache = [];
        }
        return self::$cache;
    }

    public static function get(string $clave, ?string $default = null): ?string
    {
        $all = self::loadAll();
        $v = $all[$clave] ?? null;
        return ($v === null || $v === '') ? $default : $v;
    }

    public static function set(string $clave, ?string $valor): void
    {
        $pdo = Db::pdo();
        $stmt = $pdo->prepare(
            "INSERT INTO configuracion (clave, valor) VALUES (:k, :v)
             ON DUPLICATE KEY UPDATE valor = :v2"
        );
        $stmt->execute([':k' => $clave, ':v' => $valor, ':v2' => $valor]);
        if (self::$cache !== null) {
            self::$cache[$clave] = $valor;
        }
    }
}
