<?php
declare(strict_types=1);

/**
 * Restriccion de dominio para usuarios internos de la plataforma.
 * Los correos de "solicitantes externos" (ej. ops_solicitud) NO usan esto.
 */
final class DomainPolicy
{
    public const ALLOWED_DOMAIN  = '@ipsgoleman.com.co';
    private const ALLOWED_DOMAINS = [
        '@ipsgoleman.com.co',
        '@gmail.com',
        '@hotmail.com',
        '@outlook.com',
        '@live.com',
        '@yahoo.com',
    ];

    public static function valid(string $correo): bool
    {
        $correo = strtolower(trim($correo));
        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) return false;
        foreach (self::ALLOWED_DOMAINS as $domain) {
            if (str_ends_with($correo, $domain)) return true;
        }
        return false;
    }

    public static function requireValid(string $correo, string $field = 'correo'): void
    {
        if (!self::valid($correo)) {
            Response::error(
                "El {$field} debe ser de un dominio permitido (institucional, Gmail, Hotmail u Outlook).",
                400
            );
        }
    }
}
