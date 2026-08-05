<?php
declare(strict_types=1);

/**
 * Normalización de texto proveniente de Excel — Portal de Pagos.
 *
 * Este archivo existe por una razón concreta: la causa número uno de rechazo
 * del archivo en el portal no son errores de digitación, son caracteres que
 * NO SE VEN en la celda de Excel.
 *
 *   - Espacio duro (U+00A0), que aparece al copiar desde páginas web o PDF
 *   - Espacio de ancho cero (U+200B) y marcas de dirección (U+200E/200F)
 *   - BOM (U+FEFF) al inicio de la primera celda de un CSV
 *   - Tabuladores y saltos de línea dentro de la misma celda
 *   - Guiones y puntos de miles en cédulas: "1.020.304-5"
 *   - Notación científica: Excel convierte una cuenta de 16 dígitos a
 *     "5,5001E+15" y ahí ya se perdió el dato original
 *
 * Todo lo que se limpia se REPORTA. Corregir en silencio es peor que fallar:
 * el analista debe enterarse de que su plantilla trae basura.
 */
final class PagosTexto
{
    /** Caracteres invisibles o de espaciado no estándar. */
    private const INVISIBLES = [
        "\xC2\xA0",     // U+00A0 espacio duro
        "\xE2\x80\x80", "\xE2\x80\x81", "\xE2\x80\x82", "\xE2\x80\x83",
        "\xE2\x80\x84", "\xE2\x80\x85", "\xE2\x80\x86", "\xE2\x80\x87",
        "\xE2\x80\x88", "\xE2\x80\x89", "\xE2\x80\x8A", // espacios tipográficos
        "\xE2\x80\x8B", // U+200B ancho cero
        "\xE2\x80\x8C", "\xE2\x80\x8D", // ZWNJ / ZWJ
        "\xE2\x80\x8E", "\xE2\x80\x8F", // marcas de dirección
        "\xE2\x81\xA0", // word joiner
        "\xEF\xBB\xBF", // BOM
        "\xC2\xAD",     // guion suave
    ];

    /**
     * Normaliza cualquier celda: quita invisibles, colapsa espacios y recorta.
     */
    public static function limpiar(?string $valor): string
    {
        $v = (string) $valor;
        $v = str_replace(self::INVISIBLES, ' ', $v);
        $v = str_replace(["\r", "\n", "\t", "\v", "\f"], ' ', $v);
        $v = preg_replace('/\s+/u', ' ', $v) ?? $v;
        return trim($v);
    }

    /**
     * Deja solo dígitos, conservando ceros a la izquierda.
     * Sirve para identificaciones, cuentas y códigos de banco.
     */
    public static function soloDigitos(?string $valor): string
    {
        $v = self::limpiar($valor);
        if ($v === '') {
            return '';
        }
        // Excel guardó el número como float: "550009900242406.0"
        if (preg_match('/^(\d+)\.0+$/', $v, $m)) {
            $v = $m[1];
        }
        // Notación científica: el dato original ya está perdido, se marca aparte
        if (self::esNotacionCientifica($v)) {
            return '';
        }
        return preg_replace('/\D+/u', '', $v) ?? '';
    }

    /** Excel destruyó el número al convertirlo a float. */
    public static function esNotacionCientifica(?string $valor): bool
    {
        return (bool) preg_match('/^[\d.,]+\s*[eE]\s*[+\-]?\d+$/', self::limpiar($valor));
    }

    /** Describe qué se tuvo que limpiar, para reportárselo al usuario. */
    public static function anomalias(?string $original, string $limpio): array
    {
        $o = (string) $original;
        $notas = [];

        if ($o !== '' && $o !== trim($o)) {
            $notas[] = 'espacios al inicio o al final';
        }
        foreach (self::INVISIBLES as $inv) {
            if (str_contains($o, $inv)) {
                $notas[] = 'caracteres invisibles (espacio duro o de ancho cero)';
                break;
            }
        }
        if (preg_match('/[\r\n\t]/', $o)) {
            $notas[] = 'saltos de línea o tabuladores dentro de la celda';
        }
        if (preg_match('/\S\s+\S/', trim($o)) && !str_contains($limpio, ' ')) {
            $notas[] = 'espacios intermedios';
        }
        if (preg_match('/[.\-\/]/', $o) && ctype_digit($limpio) && $limpio !== '') {
            $notas[] = 'puntos o guiones de separación';
        }
        return array_values(array_unique($notas));
    }

    /**
     * Convierte un importe escrito en cualquier formato a decimal con punto.
     * Acepta "1.234.567,89", "1,234,567.89", "$ 250.000" y "250000".
     */
    public static function aDecimal(?string $valor): ?string
    {
        $v = self::limpiar($valor);
        if ($v === '') {
            return null;
        }
        $v = str_replace(['$', 'COP', ' '], '', $v);
        $negativo = str_starts_with($v, '-') || (str_starts_with($v, '(') && str_ends_with($v, ')'));
        $v = trim($v, '()-');

        if (str_contains($v, ',') && str_contains($v, '.')) {
            // El separador decimal es el que aparece de último
            $v = strrpos($v, ',') > strrpos($v, '.')
                ? str_replace('.', '', str_replace(',', '.', $v))
                : str_replace(',', '', $v);
        } elseif (str_contains($v, ',')) {
            // "1,50" es decimal;  "1,234,567" es separador de miles
            $v = preg_match('/,\d{3}(?:\D|$)/', $v) && substr_count($v, ',') >= 1
                 && !preg_match('/,\d{1,2}$/', $v)
                ? str_replace(',', '', $v)
                : str_replace(',', '.', $v);
        }
        if (!preg_match('/^\d+(\.\d+)?$/', $v)) {
            return null;
        }
        return ($negativo ? '-' : '') . $v;
    }

    /** Nombres propios: colapsa espacios y limita longitud. */
    public static function nombre(?string $valor, int $max = 160): string
    {
        return mb_substr(self::limpiar($valor), 0, $max);
    }

    /** Genera una referencia corta y legible para un lote. */
    public static function referencia(): string
    {
        $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1
        $s = '';
        for ($i = 0; $i < 6; $i++) {
            $s .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
        }
        return date('ym') . '-' . $s;
    }
}
