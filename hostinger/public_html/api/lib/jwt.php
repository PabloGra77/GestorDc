<?php
declare(strict_types=1);

final class Jwt
{
    public static function sign(array $payload): string
    {
        $secret = Config::get('JWT_ACCESS_SECRET');
        if (!$secret) {
            throw new RuntimeException('JWT_ACCESS_SECRET no configurado');
        }
        
        // Agregar expiración por defecto (1 hora) si no existe
        if (!isset($payload['exp'])) {
            $payload['exp'] = time() + 3600;
        }
        
        // Agregar timestamp de emisión
        if (!isset($payload['iat'])) {
            $payload['iat'] = time();
        }
        
        $header = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $body = self::b64(json_encode($payload, JSON_UNESCAPED_UNICODE));
        $signing = $header . '.' . $body;
        $sig = self::b64(hash_hmac('sha256', $signing, $secret, true));
        return $signing . '.' . $sig;
    }

    public static function verify(string $token): ?array
    {
        $secret = Config::get('JWT_ACCESS_SECRET');
        if (!$secret) return null;
        
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$h, $p, $s] = $parts;

        // Validar algoritmo declarado en el header (defensa contra alg confusion)
        $header = json_decode(self::b64dec($h), true);
        if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256' || ($header['typ'] ?? '') !== 'JWT') {
            return null;
        }

        $expected = self::b64(hash_hmac('sha256', $h . '.' . $p, $secret, true));
        if (!hash_equals($expected, $s)) return null;
        
        $payload = json_decode(self::b64dec($p), true);
        if (!is_array($payload)) return null;
        
        // Verificar expiración
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null;
        }
        
        return $payload;
    }

    public static function bearer(): ?string
    {
        $header = null;
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $header = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            // Algunos servidores (LiteSpeed/Hostinger) lo exponen con prefijo REDIRECT_
            $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (function_exists('apache_request_headers')) {
            $h = apache_request_headers();
            $header = $h['Authorization'] ?? ($h['authorization'] ?? null);
        }
        if (!$header && function_exists('getallheaders')) {
            $h = getallheaders();
            foreach ($h as $k => $v) {
                if (strcasecmp($k, 'Authorization') === 0) { $header = $v; break; }
            }
        }
        if (!$header || !preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            return null;
        }
        return trim($m[1]);
    }

    private static function b64(string $bin): string
    {
        return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    }

    private static function b64dec(string $s): string
    {
        $pad = strlen($s) % 4;
        if ($pad) $s .= str_repeat('=', 4 - $pad);
        return (string)base64_decode(strtr($s, '-_', '+/'));
    }
}

final class Auth
{
    public static function requireUser(): array
    {
        // Preferir cookie HttpOnly; caer en Authorization header para compatibilidad
        $token = Jwt::bearer() ?? (isset($_COOKIE['payops_token']) ? trim($_COOKIE['payops_token']) : null);
        if (!$token) {
            Response::error('No autenticado', 401);
        }
        $payload = Jwt::verify($token);
        if (!$payload || !isset($payload['sub'])) {
            Response::error('Token invalido o expirado', 401);
        }
        return $payload;
    }

    public static function requireAdmin(): array
    {
        $payload = self::requireUser();
        $pdo = Db::pdo();
        $stmt = $pdo->prepare(
            "SELECT u.id, u.nombre_completo, u.correo, r.nombre AS rol
             FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
             WHERE u.id = :id LIMIT 1"
        );
        $stmt->execute([':id' => (int)$payload['sub']]);
        $user = $stmt->fetch();
        if (!$user) Response::error('Usuario no encontrado', 401);
        if (strtolower(trim($user['rol'] ?? '')) !== 'administrador') {
            Response::error('Se requiere rol administrador', 403);
        }
        return ['jwt' => $payload, 'user' => $user];
    }
}