<?php
declare(strict_types=1);

/**
 * Adaptador de acceso a datos del módulo Portal de Pagos: mismos métodos
 * estáticos que usaba el paquete original (Database::*), pero sobre la
 * conexión PDO ya configurada de PayOPS (Db::pdo()) — sin credenciales ni
 * tabla de configuración propias.
 */
final class PagosDb
{
    public static function conexion(): PDO
    {
        return Db::pdo();
    }

    /** @return array<int,array<string,mixed>> */
    public static function todos(string $sql, array $params = []): array
    {
        $st = self::conexion()->prepare($sql);
        $st->execute($params);
        return $st->fetchAll();
    }

    public static function uno(string $sql, array $params = []): ?array
    {
        $st = self::conexion()->prepare($sql);
        $st->execute($params);
        $fila = $st->fetch();
        return $fila === false ? null : $fila;
    }

    public static function valor(string $sql, array $params = []): mixed
    {
        $st = self::conexion()->prepare($sql);
        $st->execute($params);
        $v = $st->fetchColumn();
        return $v === false ? null : $v;
    }

    public static function ejecutar(string $sql, array $params = []): int
    {
        $st = self::conexion()->prepare($sql);
        $st->execute($params);
        return $st->rowCount();
    }

    public static function insertar(string $sql, array $params = []): int
    {
        self::ejecutar($sql, $params);
        return (int) self::conexion()->lastInsertId();
    }

    public static function transaccion(callable $fn): mixed
    {
        $pdo = self::conexion();
        $pdo->beginTransaction();
        try {
            $r = $fn($pdo);
            $pdo->commit();
            return $r;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
