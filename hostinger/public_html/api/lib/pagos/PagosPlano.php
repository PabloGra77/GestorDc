<?php
declare(strict_types=1);

/**
 * Ensamblado del archivo plano de traslado de fondos — Portal de Pagos.
 *
 * El layout está declarado como datos, no como concatenación de texto. Si el
 * banco mueve una posición, se edita una línea de la tabla y la verificación
 * de longitud lo detecta sola.
 *
 * Dos tipos de registro, 170 caracteres cada uno:
 *   RC  encabezado — ordenante, valor total, cantidad de pagos
 *   TR  detalle    — un registro por pago
 */
final class PagosPlano
{
    public const LONGITUD = 170;

    /** Definición del registro de control. [campo, longitud, etiqueta] */
    public const CAMPOS_RC = [
        ['tipo_registro',        2,  'Tipo de registro'],
        ['identificacion',      16,  'Identificación de la empresa'],
        ['cuenta_origen',       24,  'Cuenta de origen'],
        ['tipo_cuenta',          2,  'Tipo de cuenta de origen'],
        ['banco_origen',         6,  'Código de banco del ordenante'],
        ['total_entero',        16,  'Valor total — parte entera'],
        ['total_centavos',       2,  'Valor total — centavos'],
        ['cantidad',             6,  'Cantidad de pagos'],
        ['fecha',                8,  'Fecha de proceso (AAAAMMDD)'],
        ['constante',           30,  'Constante de control'],
        ['tipo_identificacion',  2,  'Tipo de identificación de la empresa'],
        ['relleno',             56,  'Relleno'],
    ];

    /** Definición del registro de detalle. */
    public const CAMPOS_TR = [
        ['tipo_registro',        2,  'Tipo de registro'],
        ['identificacion',      16,  'Identificación del beneficiario'],
        ['producto_destino',    32,  'Producto de destino'],
        ['tipo_producto',        2,  'Tipo de producto'],
        ['codigo_banco',         6,  'Código de la entidad'],
        ['valor_entero',        16,  'Valor — parte entera'],
        ['valor_centavos',       2,  'Valor — centavos'],
        ['tipo_identificacion',  8,  'Tipo de identificación'],
        ['constante',            5,  'Constante de detalle'],
        ['relleno',             81,  'Relleno'],
    ];

    /** Parte un importe en (entero, centavos de dos dígitos). */
    public static function partirImporte(string $valor): array
    {
        return PagosDinero::partir(PagosDinero::desdeTexto($valor) ?? 0);
    }

    /** Rellena por la izquierda y verifica que quepa. */
    private static function pad(string $valor, int $largo, string $etiqueta, string $relleno = '0'): string
    {
        if (strlen($valor) > $largo) {
            throw new RuntimeException(
                "El campo «{$etiqueta}» necesita " . strlen($valor) .
                " posiciones y el formato solo permite {$largo}: {$valor}"
            );
        }
        return str_pad($valor, $largo, $relleno, STR_PAD_LEFT);
    }

    /** El código que realmente va al archivo (DP y TP se fuerzan a 51). */
    public static function bancoEfectivo(array $pago): int
    {
        $tipo = strtoupper((string) $pago['tipo_producto']);
        return in_array($tipo, PagosValidador::MONEDEROS, true)
            ? PagosBancos::DAVIVIENDA
            : (int) PagosTexto::soloDigitos((string) $pago['codigo_banco']);
    }

    public static function registroRC(array $empresa, array $pagos, string $fecha): string
    {
        $total = PagosDinero::sumar(array_column($pagos, 'valor'));
        [$ent, $cts] = PagosDinero::partir($total);

        $linea = 'RC'
            . self::pad(PagosTexto::soloDigitos((string) $empresa['identificacion']), 16, 'Identificación de la empresa')
            . self::pad(PagosTexto::soloDigitos((string) $empresa['cuenta_origen']), 24, 'Cuenta de origen')
            . strtoupper((string) $empresa['tipo_cuenta'])
            . '000051'
            . self::pad($ent, 16, 'Valor total')
            . $cts
            . self::pad((string) count($pagos), 6, 'Cantidad de pagos')
            . date('Ymd', strtotime($fecha))
            . '000000000099990000000000000000'
            . self::pad((string) $empresa['tipo_identificacion'], 2, 'Tipo de identificación')
            . str_repeat('0', 56);

        return self::verificar($linea, 'RC');
    }

    public static function registroTR(array $pago): string
    {
        [$ent, $cts] = self::partirImporte((string) $pago['valor']);

        $linea = 'TR'
            . self::pad(PagosTexto::soloDigitos((string) $pago['identificacion']), 16, 'Identificación')
            . self::pad(PagosTexto::soloDigitos((string) $pago['producto_destino']), 32, 'Producto de destino')
            . strtoupper((string) $pago['tipo_producto'])
            . self::pad((string) self::bancoEfectivo($pago), 6, 'Código de la entidad')
            . self::pad($ent, 16, 'Valor')
            . $cts
            . self::pad((string) $pago['tipo_identificacion'], 8, 'Tipo de identificación')
            . '19999'
            . str_repeat('0', 81);

        return self::verificar($linea, 'TR');
    }

    private static function verificar(string $linea, string $tipo): string
    {
        if (strlen($linea) !== self::LONGITUD) {
            throw new RuntimeException(
                "El registro {$tipo} quedó de " . strlen($linea) .
                ' caracteres y debe ser de ' . self::LONGITUD . '.'
            );
        }
        return $linea;
    }

    /** @return string[] */
    public static function lineas(array $empresa, array $pagos, string $fecha): array
    {
        $out = [self::registroRC($empresa, $pagos, $fecha)];
        foreach ($pagos as $p) {
            $out[] = self::registroTR($p);
        }
        return $out;
    }

    /** Contenido completo. El portal espera fin de línea CRLF. */
    public static function generar(array $empresa, array $pagos, string $fecha): string
    {
        return implode("\r\n", self::lineas($empresa, $pagos, $fecha)) . "\r\n";
    }

    /**
     * CSV legible (no es el archivo plano) para validación y cruce: una fila por
     * pago, con el banco realmente enrutado (Daviplata/prepago se fuerzan a
     * Davivienda) en vez del código crudo que se digitó.
     */
    public static function generarCsv(array $empresa, array $pagos, string $fecha): string
    {
        $filas = [[
            'Fila', 'Identificación', 'Tipo ID', 'Producto destino', 'Tipo producto',
            'Código banco', 'Banco', 'Valor', 'Beneficiario',
        ]];
        foreach ($pagos as $i => $p) {
            $bancoCod = self::bancoEfectivo($p);
            $filas[] = [
                (string) ($i + 1),
                PagosTexto::soloDigitos((string) $p['identificacion']),
                (string) $p['tipo_identificacion'],
                PagosTexto::soloDigitos((string) $p['producto_destino']),
                strtoupper((string) $p['tipo_producto']),
                (string) $bancoCod,
                PagosBancos::nombre($bancoCod),
                PagosDinero::aDecimal(PagosDinero::desdeTexto((string) $p['valor']) ?? 0),
                (string) $p['beneficiario'],
            ];
        }

        $salida = "\xEF\xBB\xBF"; // BOM para que Excel abra en UTF-8
        foreach ($filas as $f) {
            $salida .= implode(';', array_map(
                static fn($c) => '"' . str_replace('"', '""', $c) . '"', $f)) . "\r\n";
        }
        return $salida;
    }

    /**
     * Descompone una línea en sus campos, con posición inicial y final.
     * Alimenta el inspector de registro de la interfaz.
     */
    public static function inspeccionar(string $linea): array
    {
        $def = str_starts_with($linea, 'RC') ? self::CAMPOS_RC : self::CAMPOS_TR;
        $out = [];
        $pos = 1;
        foreach ($def as [$campo, $largo, $etiqueta]) {
            $out[] = [
                'campo'    => $campo,
                'etiqueta' => $etiqueta,
                'inicio'   => $pos,
                'fin'      => $pos + $largo - 1,
                'largo'    => $largo,
                'valor'    => substr($linea, $pos - 1, $largo),
            ];
            $pos += $largo;
        }
        return $out;
    }
}
