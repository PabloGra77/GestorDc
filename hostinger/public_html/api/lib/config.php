<?php
declare(strict_types=1);

final class Config
{
    private static array $values = [];
    private static bool $loaded = false;

    public static function load(string $path): void
    {
        if (self::$loaded) {
            return;
        }
        if (!is_readable($path)) {
            throw new RuntimeException('No se encuentra archivo .env');
        }
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new RuntimeException('No se puede abrir .env');
        }
        while (($line = fgets($handle)) !== false) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            $eq = strpos($line, '=');
            if ($eq === false) {
                continue;
            }
            $key = trim(substr($line, 0, $eq));
            $val = trim(substr($line, $eq + 1));
            // quitar comillas envolventes
            if (strlen($val) >= 2 && ($val[0] === '"' || $val[0] === "'") && $val[strlen($val)-1] === $val[0]) {
                $val = substr($val, 1, -1);
            }
            self::$values[$key] = $val;
        }
        fclose($handle);
        self::$loaded = true;

        // Validacion de secretos en produccion: el sistema rehusa arrancar
        // si las credenciales se quedaron con valores de plantilla.
        $jwt = self::$values['JWT_ACCESS_SECRET'] ?? '';
        if (strlen($jwt) < 48 || stripos($jwt, 'cambiar') !== false) {
            throw new RuntimeException('JWT_ACCESS_SECRET no configurado o muy debil');
        }
        foreach (['DB_NAME', 'DB_USER'] as $req) {
            if (empty(self::$values[$req])) {
                throw new RuntimeException("Falta {$req} en .env");
            }
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        return self::$values[$key] ?? $default;
    }

    public static function getInt(string $key, int $default): int
    {
        $v = self::get($key);
        return ($v !== null && $v !== '') ? (int)$v : $default;
    }

    public static function getBool(string $key, bool $default = false): bool
    {
        $v = self::get($key);
        if ($v === null) return $default;
        return in_array(strtolower($v), ['1', 'true', 'yes', 'on'], true);
    }
}
