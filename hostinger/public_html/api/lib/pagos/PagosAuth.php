<?php
declare(strict_types=1);

/**
 * Autorización del módulo Portal de Pagos.
 *
 * NO reimplementa sesión ni login: reutiliza el JWT existente de PayOPS
 * (Auth::requireUser(), lib/jwt.php) tal cual. Lo único propio de este
 * archivo es la resolución de permisos granulares del módulo `pagos`
 * (roles.permisos + usuarios.permisos, igual mecanismo que ya usa el resto
 * de la app) y, a propósito, **sin** el atajo "fail-open" que tiene
 * `tienePermiso()` en el frontend: este módulo mueve dinero, así que la
 * ausencia de permisos configurados nunca se traduce en acceso.
 */
final class PagosAuth
{
    private static ?array $payload = null;
    private static ?array $usuario = null;

    /** Verifica el JWT (una sola vez por request) y carga el usuario + rol. */
    private static function cargar(): void
    {
        if (self::$usuario !== null) {
            return;
        }
        self::$payload = Auth::requireUser();
        $pdo = Db::pdo();
        $stmt = $pdo->prepare(
            'SELECT u.id, u.nombre_completo, u.correo, u.permisos AS permisos_usuario,
                    r.nombre AS rol, r.permisos AS permisos_rol
               FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
              WHERE u.id = :id LIMIT 1'
        );
        $stmt->execute([':id' => (int) (self::$payload['sub'] ?? 0)]);
        $usuario = $stmt->fetch();
        if (!$usuario) {
            Response::error('Usuario no encontrado', 401);
        }
        self::$usuario = $usuario;
    }

    public static function id(): int
    {
        self::cargar();
        return (int) self::$usuario['id'];
    }

    public static function esAdmin(): bool
    {
        self::cargar();
        return strtolower(trim((string) self::$usuario['rol'])) === 'administrador';
    }

    /** Unión de los permisos del módulo `pagos` del rol y del propio usuario. */
    private static function permisosPagos(): array
    {
        self::cargar();
        $delRol     = self::extraerModulo(self::$usuario['permisos_rol'] ?? null);
        $delUsuario = self::extraerModulo(self::$usuario['permisos_usuario'] ?? null);
        return array_values(array_unique(array_merge($delRol, $delUsuario)));
    }

    private static function extraerModulo(?string $json): array
    {
        if (!$json) {
            return [];
        }
        $data = json_decode($json, true);
        if (!is_array($data) || !isset($data['pagos']) || !is_array($data['pagos'])) {
            return [];
        }
        return array_values(array_filter($data['pagos'], 'is_string'));
    }

    public static function puede(string $permiso): bool
    {
        return self::esAdmin() || in_array($permiso, self::permisosPagos(), true);
    }

    /** True si tiene al menos uno de los permisos dados (o es admin). */
    public static function puedeAlguno(array $permisos): bool
    {
        if (self::esAdmin()) {
            return true;
        }
        $propios = self::permisosPagos();
        return (bool) array_intersect($permisos, $propios);
    }

    /** Corta la ejecución con 403 si el usuario no tiene el permiso. */
    public static function requerir(string $permiso): void
    {
        if (!self::puede($permiso)) {
            Response::error('No tiene permiso para esta acción del Portal de Pagos', 403);
        }
    }

    /** Corta la ejecución con 403 si no tiene ninguno de los permisos dados. */
    public static function requerirAlguno(array $permisos): void
    {
        if (!self::puedeAlguno($permisos)) {
            Response::error('No tiene permiso para esta acción del Portal de Pagos', 403);
        }
    }
}
