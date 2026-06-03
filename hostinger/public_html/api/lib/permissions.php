<?php
declare(strict_types=1);

/**
 * Catalogo de permisos por modulo. Espejo de
 * services/api/src/modules/roles/roles-permissions.catalog.ts
 */
final class Permissions
{
    public const CATALOG = [
        'inicio'             => ['realizarSolicitudes', 'verificarRadicados'],
        'panelAdministrador' => ['crearUsuarios', 'crearRoles'],
    ];

    public static function normalize($input): array
    {
        if (!is_array($input)) return [];
        $out = [];
        foreach (self::CATALOG as $modulo => $disponibles) {
            $solicitados = $input[$modulo] ?? [];
            if (!is_array($solicitados)) continue;
            $permitidos = array_values(array_unique(array_intersect($solicitados, $disponibles)));
            if (!empty($permitidos)) {
                $out[$modulo] = $permitidos;
            }
        }
        return $out;
    }
}
