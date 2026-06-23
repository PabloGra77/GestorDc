<?php
declare(strict_types=1);

final class Logger
{
    private const LOG_LEVELS = [
        'DEBUG' => 0,
        'INFO' => 1,
        'WARNING' => 2,
        'ERROR' => 3,
        'CRITICAL' => 4,
    ];

    public static function info(string $message, array $context = []): void
    {
        self::log('INFO', $message, $context);
    }

    public static function warning(string $message, array $context = []): void
    {
        self::log('WARNING', $message, $context);
    }

    public static function error(string $message, array $context = []): void
    {
        self::log('ERROR', $message, $context);
    }

    private static function log(string $level, string $message, array $context): void
    {
        $logEntry = [
            'timestamp' => date('c'),
            'level' => $level,
            'message' => $message,
            'context' => $context,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_id' => null,
        ];

        try {
            $token = Jwt::bearer();
            if ($token) {
                $payload = Jwt::verify($token);
                if ($payload && isset($payload['sub'])) {
                    $logEntry['user_id'] = (int)$payload['sub'];
                }
            }
        } catch (Throwable $e) {
            // Ignorar errores al obtener user_id
        }

        $logEntry['context'] = self::sanitizeContext($logEntry['context']);
        $logLine = '[gestordc] ' . json_encode($logEntry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        
        error_log($logLine);
    }

    private static function sanitizeContext(array $context): array
    {
        $sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'apikey', 'auth', 'authorization'];
        foreach ($context as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), $sensitiveKeys, true)) {
                $context[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $context[$key] = self::sanitizeContext($value);
            }
        }
        return $context;
    }
}