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

    /**
     * Cifra un secreto (ej. password SMTP) antes de persistirlo en BD.
     * Clave derivada de JWT_ACCESS_SECRET, que ya esta validado al boot
     * (config.php rechaza secretos cortos o por defecto).
     */
    public static function encryptSecret(string $plain): string
    {
        $key = hash('sha256', Config::get('JWT_ACCESS_SECRET') . '|settings-secret', true);
        $iv = random_bytes(16);
        $cipher = openssl_encrypt($plain, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
        return 'enc:' . base64_encode($iv . $cipher);
    }

    /**
     * Descifra un valor guardado con encryptSecret(). Si el valor no tiene
     * el prefijo 'enc:' (texto plano historico o fallback de .env), se
     * devuelve sin cambios para no romper configuraciones existentes.
     */
    public static function decryptSecret(?string $stored): ?string
    {
        if ($stored === null || $stored === '' || !str_starts_with($stored, 'enc:')) {
            return $stored;
        }
        $raw = base64_decode(substr($stored, 4));
        if ($raw === false || strlen($raw) < 17) {
            return null;
        }
        $key = hash('sha256', Config::get('JWT_ACCESS_SECRET') . '|settings-secret', true);
        $iv = substr($raw, 0, 16);
        $cipher = substr($raw, 16);
        $plain = openssl_decrypt($cipher, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
        return $plain === false ? null : $plain;
    }
}
