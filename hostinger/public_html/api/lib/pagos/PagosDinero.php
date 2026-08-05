<?php
declare(strict_types=1);

/**
 * Aritmética monetaria exacta sin depender de BCMath — Portal de Pagos.
 *
 * Todo importe se maneja internamente como un ENTERO de centavos. Los enteros
 * de PHP en 64 bits llegan hasta 9.223.372.036.854.775.807, es decir más de
 * 92 billones de pesos: sobra para cualquier lote, y la suma es exacta por
 * definición.
 *
 * Nunca se usa float. Un float no puede representar 0,10 exactamente, y en un
 * lote de 400 pagos el error acumulado hace que el total del registro RC no
 * cuadre contra la suma de los TR — el portal rechaza el lote completo.
 */
final class PagosDinero
{
    /** Tope que admite el campo de 16 posiciones más 2 de centavos. */
    public const MAX_CENTAVOS = 999999999999999;

    /**
     * Convierte una cadena decimal ya normalizada ("1234.56") a centavos.
     * Devuelve null si no es un número válido.
     */
    public static function aCentavos(?string $valor): ?int
    {
        $v = trim((string) $valor);
        if ($v === '' || !preg_match('/^(-?)(\d+)(?:\.(\d+))?$/', $v, $m)) {
            return null;
        }
        $signo    = $m[1] === '-' ? -1 : 1;
        $entero   = $m[2];
        $decimal  = str_pad(substr($m[3] ?? '', 0, 2), 2, '0');

        if (strlen(ltrim($entero, '0')) > 15) {
            return null; // desborda el campo del archivo
        }
        return $signo * ((int) $entero * 100 + (int) $decimal);
    }

    /** Igual que aCentavos, pero aceptando cualquier formato de escritura. */
    public static function desdeTexto(?string $valor): ?int
    {
        return self::aCentavos(PagosTexto::aDecimal($valor));
    }

    /** Centavos a cadena decimal: 123456 -> "1234.56" */
    public static function aDecimal(int $centavos): string
    {
        $signo = $centavos < 0 ? '-' : '';
        $abs   = abs($centavos);
        return $signo . intdiv($abs, 100) . '.' . str_pad((string) ($abs % 100), 2, '0', STR_PAD_LEFT);
    }

    /** Parte para el archivo plano: ["1234", "56"] */
    public static function partir(int $centavos): array
    {
        $abs = abs($centavos);
        return [(string) intdiv($abs, 100), str_pad((string) ($abs % 100), 2, '0', STR_PAD_LEFT)];
    }

    /** Suma exacta de una lista de importes en texto. Ignora los inválidos. */
    public static function sumar(array $valores): int
    {
        $total = 0;
        foreach ($valores as $v) {
            $total += self::desdeTexto((string) $v) ?? 0;
        }
        return $total;
    }

    /** True si el importe tiene centavos distintos de cero. */
    public static function tieneDecimales(int $centavos): bool
    {
        return $centavos % 100 !== 0;
    }

    /** Cuántos decimales traía el texto original (para rechazar más de dos). */
    public static function decimalesEscritos(?string $decimalNormalizado): int
    {
        $v = (string) $decimalNormalizado;
        $p = strpos($v, '.');
        return $p === false ? 0 : strlen(substr($v, $p + 1));
    }

    /** Formato colombiano para pantalla. */
    public static function formato(int $centavos): string
    {
        return '$' . number_format($centavos / 100, 2, ',', '.');
    }
}
