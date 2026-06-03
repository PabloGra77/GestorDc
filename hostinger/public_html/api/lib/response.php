<?php
declare(strict_types=1);

final class Response
{
    public static function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $status = 400, ?string $code = null): void
    {
        self::json([
            'statusCode' => $status,
            'message'    => $message,
            'error'      => $code ?? self::reason($status),
        ], $status);
    }

    private static function reason(int $status): string
    {
        return match ($status) {
            400 => 'Bad Request',
            401 => 'Unauthorized',
            403 => 'Forbidden',
            404 => 'Not Found',
            409 => 'Conflict',
            500 => 'Internal Server Error',
            default => 'Error',
        };
    }
}

final class Request
{
    /** Limite del JSON body en bytes (2 MB). */
    public const MAX_BODY_BYTES = 2 * 1024 * 1024;

    public static function body(): array
    {
        $cl = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
        if ($cl > self::MAX_BODY_BYTES) {
            Response::error('Cuerpo de la peticion excede el limite permitido', 413);
        }
        $raw = file_get_contents('php://input', false, null, 0, self::MAX_BODY_BYTES + 1);
        if (!$raw) return [];
        if (strlen($raw) > self::MAX_BODY_BYTES) {
            Response::error('Cuerpo de la peticion excede el limite permitido', 413);
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    public static function query(string $name): ?string
    {
        return isset($_GET[$name]) ? (string)$_GET[$name] : null;
    }
}
