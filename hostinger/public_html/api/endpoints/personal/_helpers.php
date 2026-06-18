<?php
declare(strict_types=1);

final class PersonalHelpers
{
    public const ROLES_VALIDOS = ['profesional', 'analista', 'coordinador', 'director', 'gerente', 'administrador'];

    // Normaliza el rol entrante (acentos/may a slug en minuscula)
    public static function normalizarRol(string $rol): string
    {
        $r = strtolower(trim($rol));
        $r = strtr($r, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ñ'=>'n']);
        // sinonimos
        if ($r === 'admin') $r = 'administrador';
        if ($r === 'profecional') $r = 'profesional';
        return $r;
    }

    // El nivel de aprobacion que se asigna al usuario segun su rol
    public static function nivelDeRol(string $rolSlug): ?string
    {
        return in_array($rolSlug, ['analista', 'coordinador', 'director'], true) ? $rolSlug : null;
    }

    // Limpia un numero de documento (alfanumerico, 4-20)
    public static function limpiarDocumento(string $cc): string
    {
        $cc = preg_replace('/[^A-Za-z0-9]/', '', trim($cc)) ?? '';
        return substr($cc, 0, 20);
    }

    // Devuelve el id del rol por nombre (case-insensitive). null si no existe.
    public static function rolIdPorSlug(PDO $pdo, string $rolSlug): ?int
    {
        $st = $pdo->prepare("SELECT id FROM roles WHERE LOWER(nombre) = :n AND activo = 1 LIMIT 1");
        $st->execute([':n' => $rolSlug]);
        $row = $st->fetch();
        return $row ? (int)$row['id'] : null;
    }

    // Resuelve el area por nombre aproximado (case-insensitive, contiene). null si vacio.
    public static function areaIdPorNombre(PDO $pdo, ?string $area): ?int
    {
        $a = trim((string)$area);
        if ($a === '') return null;
        $st = $pdo->prepare("SELECT id FROM areas WHERE LOWER(nombre) = LOWER(:n) LIMIT 1");
        $st->execute([':n' => $a]);
        $row = $st->fetch();
        if ($row) return (int)$row['id'];
        // intento por coincidencia parcial
        $st2 = $pdo->prepare("SELECT id FROM areas WHERE LOWER(nombre) LIKE LOWER(:n) ORDER BY LENGTH(nombre) ASC LIMIT 1");
        $st2->execute([':n' => '%' . $a . '%']);
        $row2 = $st2->fetch();
        return $row2 ? (int)$row2['id'] : null;
    }
}
