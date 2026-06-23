<?php
declare(strict_types=1);

final class Response
{
    public static function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $status = 500, array $details = []): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        
        $response = [
            'status' => $status,
            'error' => self::reason($status),
            'message' => $message,
            'timestamp' => date('c'),
        ];
        
        if (!empty($details)) {
            $response['details'] = $details;
        }
        
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    private static function reason(int $status): string
    {
        return match ($status) {
            400 => 'Bad Request',
            401 => 'Unauthorized',
            403 => 'Forbidden',
            404 => 'Not Found',
            405 => 'Method Not Allowed',
            413 => 'Payload Too Large',
            415 => 'Unsupported Media Type',
            429 => 'Too Many Requests',
            500 => 'Internal Server Error',
            default => 'Error',
        };
    }
}

final class Request
{
    public const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

    public static function body(): array
    {
        $cl = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
        if ($cl > self::MAX_BODY_BYTES) {
            http_response_code(413);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'Payload Too Large', 'message' => 'Cuerpo de la peticion excede el limite permitido']);
            exit;
        }
        
        $raw = file_get_contents('php://input', false, null, 0, self::MAX_BODY_BYTES + 1);
        if (!$raw) return [];
        
        if (strlen($raw) > self::MAX_BODY_BYTES) {
            http_response_code(413);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'Payload Too Large', 'message' => 'Cuerpo de la peticion excede el limite permitido']);
            exit;
        }
        
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    public static function query(string $name): ?string
    {
        return isset($_GET[$name]) ? (string)$_GET[$name] : null;
    }
}