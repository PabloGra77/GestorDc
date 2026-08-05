<?php
declare(strict_types=1);

/**
 * Reglas de negocio del lote de pagos — Portal de Pagos.
 *
 * Devuelve SIEMPRE un informe completo. Nunca lanza excepciones por datos
 * inválidos ni se detiene en el primer error: el analista debe poder corregir
 * todo de una vez en la previsualización.
 *
 * Cada hallazgo apunta a una fila y a un campo concretos, para que la interfaz
 * pueda marcar la celda exacta.
 */
final class PagosValidador
{
    public const ERROR = 'error';
    public const AVISO = 'aviso';

    public const TIPOS_ID = [
        '01' => 'Cédula de ciudadanía',
        '02' => 'Cédula de extranjería',
        '03' => 'NIT',
        '04' => 'Tarjeta de identidad',
        '05' => 'Pasaporte',
        '06' => 'Trj. seguro social extranjero',
        '07' => 'Sociedad extranjera sin NIT en Colombia',
        '08' => 'Fideicomiso',
        '09' => 'NIT menores',
        '10' => 'RIF Venezuela',
        '11' => 'NIT extranjería',
        '12' => 'NIT persona natural',
        '13' => 'Registro civil de nacimiento',
        '99' => 'NIT desasociado',
    ];

    public const TIPOS_PRODUCTO = [
        'CA' => 'Cuenta de ahorros',
        'CC' => 'Cuenta corriente',
        'DP' => 'Daviplata',
        'TP' => 'Tarjeta prepago',
    ];

    /** Productos que obligan banco Davivienda y no admiten decimales. */
    public const MONEDEROS = ['DP', 'TP'];

    /** Longitud exacta obligatoria del producto destino. */
    public const LONGITUD_EXACTA = ['DP' => 10, 'TP' => 16];

    public const MAX_LEN_IDENTIFICACION = 11;
    public const MAX_LEN_CODIGO_BANCO   = 4;
    public const MAX_VALOR              = '9999999999999.99';

    private int $maxLenCuenta;

    public function __construct(int $maxLenCuenta = 17)
    {
        $this->maxLenCuenta = $maxLenCuenta;
    }

    private static function hallazgo(string $severidad, string $codigo, string $mensaje,
                                     ?int $fila = null, string $campo = ''): array
    {
        return compact('severidad', 'codigo', 'mensaje', 'fila', 'campo');
    }

    // -----------------------------------------------------------------
    // Empresa ordenante
    // -----------------------------------------------------------------
    public function validarEmpresa(array $empresa): array
    {
        $h = [];
        $ident  = PagosTexto::limpiar($empresa['identificacion'] ?? '');
        $cuenta = PagosTexto::limpiar($empresa['cuenta_origen'] ?? '');

        if ($ident === '' || !ctype_digit($ident)) {
            $h[] = self::hallazgo(self::ERROR, 'EMP001',
                'La identificación de la empresa debe contener solo dígitos.', null, 'identificacion');
        } elseif (strlen($ident) > self::MAX_LEN_IDENTIFICACION) {
            $h[] = self::hallazgo(self::ERROR, 'EMP002',
                'La identificación de la empresa supera ' . self::MAX_LEN_IDENTIFICACION . ' dígitos.',
                null, 'identificacion');
        }

        if ($cuenta === '' || !ctype_digit($cuenta)) {
            $h[] = self::hallazgo(self::ERROR, 'EMP003',
                'La cuenta de origen debe contener solo dígitos.', null, 'cuenta_origen');
        } elseif (strlen($cuenta) > 24) {
            $h[] = self::hallazgo(self::ERROR, 'EMP004',
                'La cuenta de origen supera 24 dígitos.', null, 'cuenta_origen');
        }

        if (!in_array($empresa['tipo_cuenta'] ?? '', ['CA', 'CC'], true)) {
            $h[] = self::hallazgo(self::ERROR, 'EMP005',
                'La cuenta de origen debe ser de ahorros (CA) o corriente (CC).', null, 'tipo_cuenta');
        }
        if (!isset(self::TIPOS_ID[$empresa['tipo_identificacion'] ?? ''])) {
            $h[] = self::hallazgo(self::ERROR, 'EMP006',
                'El tipo de identificación de la empresa no es válido.', null, 'tipo_identificacion');
        }
        return $h;
    }

    // -----------------------------------------------------------------
    // Un pago
    // -----------------------------------------------------------------
    /**
     * @param array $p    Pago ya normalizado (claves del formulario)
     * @param int   $fila Número de fila visible en la previsualización (1..N)
     */
    public function validarPago(array $p, int $fila): array
    {
        $h = [];
        $err = function (string $codigo, string $mensaje, string $campo) use (&$h, $fila): void {
            $h[] = self::hallazgo(self::ERROR, $codigo, $mensaje, $fila, $campo);
        };
        $avi = function (string $codigo, string $mensaje, string $campo) use (&$h, $fila): void {
            $h[] = self::hallazgo(self::AVISO, $codigo, $mensaje, $fila, $campo);
        };

        $ident    = (string) ($p['identificacion'] ?? '');
        $tipoId   = (string) ($p['tipo_identificacion'] ?? '');
        $producto = (string) ($p['producto_destino'] ?? '');
        $tipoProd = strtoupper((string) ($p['tipo_producto'] ?? ''));
        $banco    = (string) ($p['codigo_banco'] ?? '');
        $valorRaw = (string) ($p['valor'] ?? '');
        $manual   = !empty($p['banco_manual']);

        // --- Identificación
        if ($ident === '') {
            $err('PAG001', 'La identificación está vacía.', 'identificacion');
        } elseif (!ctype_digit($ident)) {
            $err('PAG002', 'La identificación contiene caracteres que no son dígitos.', 'identificacion');
        } elseif (strlen($ident) > self::MAX_LEN_IDENTIFICACION) {
            $err('PAG003', 'La identificación tiene ' . strlen($ident) . ' dígitos y el máximo es '
                . self::MAX_LEN_IDENTIFICACION . '.', 'identificacion');
        } elseif (ltrim($ident, '0') === '') {
            $err('PAG004', 'La identificación no puede ser cero.', 'identificacion');
        }

        // --- Tipo de identificación
        if (!isset(self::TIPOS_ID[$tipoId])) {
            $err('PAG005', 'Tipo de identificación no válido según la tabla del banco.', 'tipo_identificacion');
        }

        // --- Tipo de producto
        if (!isset(self::TIPOS_PRODUCTO[$tipoProd])) {
            $err('PAG006', 'Tipo de producto no válido. Use CA, CC, DP o TP.', 'tipo_producto');
            $tipoProd = '';
        }

        // --- Producto destino
        if ($producto === '') {
            $err('PAG010', 'El producto de destino está vacío.', 'producto_destino');
        } elseif (!ctype_digit($producto)) {
            $err('PAG011', 'El producto de destino contiene caracteres que no son dígitos.', 'producto_destino');
        } elseif ($tipoProd !== '') {
            $exacta = self::LONGITUD_EXACTA[$tipoProd] ?? null;
            $largo  = strlen($producto);
            if ($exacta !== null && $largo !== $exacta) {
                $err('PAG012', self::TIPOS_PRODUCTO[$tipoProd] . " debe tener exactamente {$exacta} dígitos (tiene {$largo}).",
                    'producto_destino');
            } elseif ($exacta === null && $largo > $this->maxLenCuenta) {
                $err('PAG013', "El número de cuenta tiene {$largo} dígitos y el máximo es {$this->maxLenCuenta}.",
                    'producto_destino');
            }
        }

        // --- Código de banco
        $esMonedero = in_array($tipoProd, self::MONEDEROS, true);
        if ($esMonedero) {
            if ($banco !== '' && (int) $banco !== PagosBancos::DAVIVIENDA) {
                $avi('PAG020', self::TIPOS_PRODUCTO[$tipoProd] . ' siempre se envía con código '
                    . PagosBancos::DAVIVIENDA . ' (Davivienda). Se ignorará el código ' . $banco . '.', 'codigo_banco');
            }
        } elseif ($banco === '' || !ctype_digit($banco) || (int) $banco <= 0
                  || strlen(ltrim($banco, '0')) > self::MAX_LEN_CODIGO_BANCO) {
            $err('PAG021', 'El código de banco debe ser numérico, mayor a cero y de máximo '
                . self::MAX_LEN_CODIGO_BANCO . ' dígitos.', 'codigo_banco');
        } elseif (PagosBancos::esOficial((int) $banco)) {
            // verificado contra la tabla publicada por Davivienda
        } elseif ($manual || PagosBancos::esManual((int) $banco)) {
            $avi('PAG022', 'El código ' . (int) $banco . ' no está en la tabla oficial de Davivienda '
                . 'y fue registrado manualmente. Verifíquelo antes de enviar el archivo.', 'codigo_banco');
        } else {
            $err('PAG023', 'El código de banco ' . (int) $banco . ' no existe en la tabla de entidades. '
                . 'Si la entidad es nueva, un administrador debe registrarla.', 'codigo_banco');
        }

        // --- Valor (aritmética exacta en centavos, sin BCMath)
        $valorTexto = PagosTexto::aDecimal($valorRaw);
        $centavos   = $valorTexto === null ? null : PagosDinero::aCentavos($valorTexto);
        if ($centavos === null) {
            $err('PAG030', 'El valor no es un número válido.', 'valor');
        } elseif ($centavos <= 0) {
            $err('PAG031', 'El valor del traslado debe ser mayor a cero.', 'valor');
        } elseif ($centavos > PagosDinero::MAX_CENTAVOS) {
            $err('PAG032', 'El valor excede el máximo que admite el formato.', 'valor');
        } elseif (PagosDinero::decimalesEscritos($valorTexto) > 2) {
            $err('PAG033', 'El valor no puede tener más de dos decimales.', 'valor');
        } elseif ($esMonedero && PagosDinero::tieneDecimales($centavos)) {
            $err('PAG034', 'No se permiten traslados con decimales a '
                . self::TIPOS_PRODUCTO[$tipoProd] . '.', 'valor');
        }

        // --- Control interno: el nombre no viaja al archivo, pero facilita
        // trazabilidad, revisión y conciliación humana del lote.
        $beneficiario = PagosTexto::limpiar((string) ($p['beneficiario'] ?? ''));
        if ($beneficiario === '') {
            $avi('PAG040', 'Se recomienda registrar el nombre del beneficiario para facilitar la revisión del pago.',
                'beneficiario');
        } elseif (mb_strlen($beneficiario) > 160) {
            $err('PAG041', 'El nombre del beneficiario supera 160 caracteres.', 'beneficiario');
        }

        return $h;
    }

    // -----------------------------------------------------------------
    // Reglas del lote completo
    // -----------------------------------------------------------------
    public function validarLote(array $empresa, array $pagos): array
    {
        $h = $this->validarEmpresa($empresa);

        if (!$pagos) {
            $h[] = self::hallazgo(self::ERROR, 'LOT001', 'El lote no tiene pagos.');
            return $h;
        }

        foreach (array_values($pagos) as $i => $p) {
            $h = array_merge($h, $this->validarPago($p, $i + 1));
        }

        // Cuentas repetidas dentro del mismo lote
        $conteo = [];
        foreach ($pagos as $p) {
            $c = (string) ($p['producto_destino'] ?? '');
            if ($c !== '') {
                $conteo[$c] = ($conteo[$c] ?? 0) + 1;
            }
        }
        $origen = PagosTexto::limpiar($empresa['cuenta_origen'] ?? '');
        foreach (array_values($pagos) as $i => $p) {
            $c = (string) ($p['producto_destino'] ?? '');
            if ($c !== '' && ($conteo[$c] ?? 0) > 1) {
                $h[] = self::hallazgo(self::AVISO, 'LOT010',
                    "El producto destino {$c} aparece {$conteo[$c]} veces en el lote.",
                    $i + 1, 'producto_destino');
            }
            if ($c !== '' && $c === $origen) {
                $h[] = self::hallazgo(self::ERROR, 'LOT011',
                    'El destino es la misma cuenta de origen del lote. Por seguridad este pago no puede generarse.',
                    $i + 1, 'producto_destino');
            }
        }

        // Posible pago duplicado exacto. No se bloquea porque puede existir un
        // caso legítimo, pero se deja visible para revisión antes de generar.
        $firmas = [];
        foreach (array_values($pagos) as $i => $p) {
            $firma = implode('|', [
                (string) ($p['identificacion'] ?? ''),
                (string) ($p['producto_destino'] ?? ''),
                strtoupper((string) ($p['tipo_producto'] ?? '')),
                (string) ($p['codigo_banco'] ?? ''),
                (string) (PagosTexto::aDecimal((string) ($p['valor'] ?? '')) ?? ''),
            ]);
            if ($firma === '||||') {
                continue;
            }
            if (isset($firmas[$firma])) {
                $h[] = self::hallazgo(self::AVISO, 'LOT012',
                    'Este pago coincide en documento, producto, entidad y valor con la fila '
                    . $firmas[$firma] . '. Confirme que no sea un duplicado accidental.',
                    $i + 1, 'producto_destino');
            } else {
                $firmas[$firma] = $i + 1;
            }
        }

        return $h;
    }

    // -----------------------------------------------------------------
    // Utilidades sobre el informe
    // -----------------------------------------------------------------
    public static function errores(array $hallazgos): array
    {
        return array_values(array_filter($hallazgos, fn($x) => $x['severidad'] === self::ERROR));
    }

    public static function avisos(array $hallazgos): array
    {
        return array_values(array_filter($hallazgos, fn($x) => $x['severidad'] === self::AVISO));
    }

    public static function esValido(array $hallazgos): bool
    {
        return self::errores($hallazgos) === [];
    }

    /** Agrupa por "fila:campo" para que la interfaz marque cada celda. */
    public static function porCelda(array $hallazgos): array
    {
        $mapa = [];
        foreach ($hallazgos as $x) {
            if ($x['fila'] === null || $x['campo'] === '') {
                continue;
            }
            $clave = $x['fila'] . ':' . $x['campo'];
            $mapa[$clave][] = ['severidad' => $x['severidad'], 'mensaje' => $x['mensaje'], 'codigo' => $x['codigo']];
        }
        return $mapa;
    }
}
