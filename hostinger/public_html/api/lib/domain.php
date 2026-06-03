<?php
declare(strict_types=1);

/**
 * Restriccion de dominio para usuarios internos de la plataforma.
 * Los correos de "solicitantes externos" (ej. ops_solicitud) NO usan esto.
 */
final class DomainPolicy
{
    public const ALLOWED_DOMAIN = '@ipsgoleman.com.co';

    public static function valid(string $correo): bool
    {
        $correo = strtolower(trim($correo));
        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) return false;
        return str_ends_with($correo, self::ALLOWED_DOMAIN);
    }

    public static function requireValid(string $correo, string $field = 'correo'): void
    {
        if (!self::valid($correo)) {
            Response::error(
                "El {$field} debe pertenecer al dominio " . self::ALLOWED_DOMAIN,
                400
            );
        }
    }
}
