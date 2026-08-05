<?php
declare(strict_types=1);

/**
 * Catálogo de entidades financieras — Portal de Pagos.
 *
 * La distinción entre oficial y manual es deliberada: la app siempre debe
 * poder decir si un código fue verificado contra la tabla que publica
 * Davivienda o si lo digitó una persona.
 */
final class PagosBancos
{
    /** Código de Davivienda. Obligatorio para Daviplata y Tarjeta prepago. */
    public const DAVIVIENDA = 51;
    public const MAX_LEN = 4;

    private static ?array $cache = null;

    /** @return array<int,array{codigo:int,nombre:string,oficial:bool}> */
    public static function todos(bool $soloActivos = true): array
    {
        if (self::$cache === null) {
            $filas = PagosDb::todos(
                'SELECT codigo, nombre, oficial, activo FROM pagos_bancos ORDER BY nombre'
            );
            self::$cache = [];
            foreach ($filas as $f) {
                self::$cache[(int) $f['codigo']] = [
                    'codigo'  => (int) $f['codigo'],
                    'nombre'  => $f['nombre'],
                    'oficial' => (bool) $f['oficial'],
                    'activo'  => (bool) $f['activo'],
                ];
            }
        }
        return $soloActivos
            ? array_filter(self::$cache, fn($b) => $b['activo'])
            : self::$cache;
    }

    public static function limpiarCache(): void
    {
        self::$cache = null;
    }

    public static function existe(int $codigo): bool
    {
        return isset(self::todos()[$codigo]);
    }

    public static function esOficial(int $codigo): bool
    {
        return self::todos()[$codigo]['oficial'] ?? false;
    }

    public static function esManual(int $codigo): bool
    {
        $b = self::todos()[$codigo] ?? null;
        return $b !== null && !$b['oficial'];
    }

    public static function nombre(int $codigo): string
    {
        return self::todos()[$codigo]['nombre'] ?? '';
    }

    /** Valida el formato del código, independiente del catálogo. */
    public static function formatoValido(string $codigo): bool
    {
        $c = PagosTexto::soloDigitos($codigo);
        return $c !== '' && (int) $c > 0 && strlen(ltrim($c, '0')) <= self::MAX_LEN;
    }

    /**
     * Registra una entidad que no está en la tabla oficial.
     * @return array{ok:bool, mensaje:string, codigo?:int}
     */
    public static function registrarManual(string $codigo, string $nombre): array
    {
        if (!self::formatoValido($codigo)) {
            return ['ok' => false, 'mensaje' =>
                'El código debe ser numérico, mayor a cero y de máximo ' . self::MAX_LEN . ' dígitos.'];
        }
        $cod = (int) PagosTexto::soloDigitos($codigo);
        $nom = PagosTexto::nombre($nombre, 120);

        if (self::existe($cod)) {
            return ['ok' => false, 'mensaje' =>
                "El código {$cod} ya existe en el catálogo (" . self::nombre($cod) . ').'];
        }
        if ($nom === '') {
            $nom = "Entidad {$cod} (registrada manualmente)";
        }

        PagosDb::ejecutar(
            'INSERT INTO pagos_bancos (codigo, nombre, oficial, activo, creado_por) VALUES (?, ?, 0, 1, ?)',
            [$cod, $nom, PagosAuth::id()]
        );
        self::limpiarCache();
        PagosAudit::registrar('banco.manual_creado', 'banco', (string) $cod, ['nombre' => $nom]);

        return ['ok' => true, 'mensaje' => "Entidad {$cod} — {$nom} registrada.", 'codigo' => $cod];
    }

    public static function cambiarEstado(int $codigo, bool $activo): void
    {
        PagosDb::ejecutar('UPDATE pagos_bancos SET activo = ? WHERE codigo = ?', [$activo ? 1 : 0, $codigo]);
        self::limpiarCache();
        PagosAudit::registrar($activo ? 'banco.activado' : 'banco.desactivado', 'banco', (string) $codigo);
    }

    public static function eliminarManual(int $codigo): array
    {
        if (self::esOficial($codigo)) {
            return ['ok' => false, 'mensaje' => 'Las entidades de la tabla oficial no se eliminan; desactívelas.'];
        }
        $enUso = (int) PagosDb::valor(
            'SELECT COUNT(*) FROM pagos_lote_detalle WHERE codigo_banco = ?', [(string) $codigo]);
        if ($enUso > 0) {
            return ['ok' => false, 'mensaje' =>
                "No se puede eliminar: {$enUso} pagos ya usan este código. Desactívelo."];
        }
        PagosDb::ejecutar('DELETE FROM pagos_bancos WHERE codigo = ? AND oficial = 0', [$codigo]);
        self::limpiarCache();
        PagosAudit::registrar('banco.manual_eliminado', 'banco', (string) $codigo);
        return ['ok' => true, 'mensaje' => "Entidad {$codigo} eliminada."];
    }
}
