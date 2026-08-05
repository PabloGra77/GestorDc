<?php
declare(strict_types=1);

/**
 * Cargue masivo desde Excel (.xlsx) o CSV — Portal de Pagos.
 *
 * Lee XLSX con ZipArchive + SimpleXML, que vienen en PHP de fábrica. No usa
 * PhpSpreadsheet a propósito: no siempre hay Composer disponible, y esta
 * plantilla es una tabla plana que no necesita una librería completa.
 *
 * Toda celda se limpia con PagosTexto::limpiar() y las anomalías se REPORTAN.
 * Los espacios invisibles son la causa más común de rechazo del archivo.
 */
final class PagosImportador
{
    /** Encabezados aceptados por campo. Se comparan normalizados. */
    private const ALIAS = [
        'identificacion' => [
            'identificacion', 'identificación', 'cedula', 'cédula', 'documento',
            'nit', 'numero de identificacion', 'no identificacion', 'id',
            'numero documento', 'documento beneficiario',
        ],
        'tipo_identificacion' => [
            'tipo identificacion', 'tipo de identificacion', 'tipo documento',
            'tipo de documento', 'tipo id', 'tipoid', 'tipo doc',
        ],
        'producto_destino' => [
            'producto destino', 'producto de destino', 'cuenta', 'cuenta destino',
            'numero de cuenta', 'no cuenta', 'cuenta beneficiario', 'producto',
            'numero cuenta', 'cuenta bancaria',
        ],
        'tipo_producto' => [
            'tipo producto', 'tipo de producto', 'tipo cuenta', 'tipo de cuenta',
        ],
        'codigo_banco' => [
            'codigo banco', 'codigo del banco', 'banco', 'cod banco', 'entidad',
            'codigo entidad', 'entidad financiera',
        ],
        'valor' => [
            'valor', 'valor del traslado', 'valor traslado', 'monto', 'importe',
            'valor a trasladar', 'pago', 'valor pago', 'neto', 'neto a pagar',
        ],
        'beneficiario' => [
            'beneficiario', 'nombre', 'nombre beneficiario', 'titular',
            'nombre completo', 'empleado', 'tercero',
        ],
    ];

    private const OBLIGATORIAS = [
        'identificacion', 'tipo_identificacion', 'producto_destino',
        'tipo_producto', 'codigo_banco', 'valor',
    ];

    public const MAX_FILAS = 5000;

    /** Normaliza un encabezado: sin tildes, minúsculas, sin signos. */
    private static function normalizar(string $texto): string
    {
        $t = PagosTexto::limpiar($texto);
        $t = mb_strtolower($t, 'UTF-8');
        $t = strtr($t, [
            'á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n',
        ]);
        $t = preg_replace('/[^a-z0-9 ]+/u', ' ', $t) ?? $t;
        return trim(preg_replace('/\s+/', ' ', $t) ?? $t);
    }

    /** @return array<int,string> índice de columna => campo canónico */
    private static function mapearEncabezados(array $fila): array
    {
        $inverso = [];
        foreach (self::ALIAS as $campo => $alias) {
            foreach ($alias as $a) {
                $inverso[self::normalizar($a)] = $campo;
            }
        }
        $mapa = [];
        foreach ($fila as $i => $celda) {
            $clave = self::normalizar((string) $celda);
            if ($clave !== '' && isset($inverso[$clave]) && !in_array($inverso[$clave], $mapa, true)) {
                $mapa[$i] = $inverso[$clave];
            }
        }
        return $mapa;
    }

    // =================================================================
    // Lectura de archivos
    // =================================================================

    /**
     * @return array{ok:bool, mensaje?:string, filas?:array<int,array<int,string>>}
     */
    public static function leerArchivo(string $ruta, string $nombreOriginal): array
    {
        $ext = strtolower(pathinfo($nombreOriginal, PATHINFO_EXTENSION));

        if ($ext === 'csv' || $ext === 'txt') {
            return self::leerCsv($ruta);
        }
        if ($ext === 'xlsx' || $ext === 'xlsm') {
            return self::leerXlsx($ruta);
        }
        if ($ext === 'xls') {
            return ['ok' => false, 'mensaje' =>
                'El formato .xls (Excel 97-2003) no es compatible. Abra el archivo en Excel '
                . 'y guárdelo como .xlsx o .csv.'];
        }
        return ['ok' => false, 'mensaje' => 'Formato no admitido. Use .xlsx o .csv.'];
    }

    private static function leerCsv(string $ruta): array
    {
        $contenido = file_get_contents($ruta);
        if ($contenido === false) {
            return ['ok' => false, 'mensaje' => 'No se pudo leer el archivo.'];
        }
        // Excel en español guarda CSV en Windows-1252
        if (!mb_check_encoding($contenido, 'UTF-8')) {
            $contenido = mb_convert_encoding($contenido, 'UTF-8', 'Windows-1252');
        }
        $contenido = preg_replace('/^\xEF\xBB\xBF/', '', $contenido) ?? $contenido;

        // Detecta el separador de la primera línea
        $primera = strtok($contenido, "\n") ?: '';
        $sep = ';';
        foreach ([';' => substr_count($primera, ';'), ',' => substr_count($primera, ','),
                  "\t" => substr_count($primera, "\t")] as $s => $n) {
            if ($n > substr_count($primera, $sep)) {
                $sep = $s;
            }
        }

        $filas = [];
        $fh = fopen('php://memory', 'r+');
        fwrite($fh, $contenido);
        rewind($fh);
        while (($fila = fgetcsv($fh, 0, $sep, '"', '\\')) !== false) {
            $filas[] = array_map(static fn($c) => (string) $c, $fila);
            if (count($filas) > self::MAX_FILAS + 1) {
                break;
            }
        }
        fclose($fh);

        return ['ok' => true, 'filas' => $filas];
    }

    /**
     * Lector XLSX mínimo: descomprime el paquete OOXML y arma la matriz.
     * Solo lee la primera hoja, que es lo que necesita la plantilla.
     */
    private static function leerXlsx(string $ruta): array
    {
        if (!class_exists('ZipArchive')) {
            return ['ok' => false, 'mensaje' =>
                'El servidor no tiene la extensión ZIP de PHP. Suba el archivo en formato .csv.'];
        }
        $zip = new ZipArchive();
        if ($zip->open($ruta) !== true) {
            return ['ok' => false, 'mensaje' => 'El archivo está dañado o no es un Excel válido.'];
        }

        // Cadenas compartidas
        $compartidas = [];
        if (($xml = $zip->getFromName('xl/sharedStrings.xml')) !== false) {
            $sx = @simplexml_load_string($xml);
            if ($sx !== false) {
                foreach ($sx->si as $si) {
                    $texto = '';
                    if (isset($si->t)) {
                        $texto = (string) $si->t;
                    } else {
                        foreach ($si->r as $r) {   // texto con formato mixto
                            $texto .= (string) $r->t;
                        }
                    }
                    $compartidas[] = $texto;
                }
            }
        }

        // Primera hoja según el orden declarado en el libro
        $rutaHoja = 'xl/worksheets/sheet1.xml';
        if (($wb = $zip->getFromName('xl/workbook.xml')) !== false) {
            $sx = @simplexml_load_string($wb);
            if ($sx !== false && isset($sx->sheets->sheet[0])) {
                $rid = (string) $sx->sheets->sheet[0]->attributes('r', true)->id;
                $rels = @simplexml_load_string((string) $zip->getFromName('xl/_rels/workbook.xml.rels'));
                if ($rels !== false) {
                    foreach ($rels->Relationship as $rel) {
                        if ((string) $rel['Id'] === $rid) {
                            $rutaHoja = 'xl/' . ltrim((string) $rel['Target'], '/');
                        }
                    }
                }
            }
        }

        $hoja = $zip->getFromName($rutaHoja);
        $zip->close();
        if ($hoja === false) {
            return ['ok' => false, 'mensaje' => 'No se encontró ninguna hoja de cálculo en el archivo.'];
        }

        $sx = @simplexml_load_string($hoja);
        if ($sx === false) {
            return ['ok' => false, 'mensaje' => 'No se pudo interpretar la hoja de cálculo.'];
        }

        $filas = [];
        foreach ($sx->sheetData->row as $row) {
            $fila = [];
            foreach ($row->c as $c) {
                $ref  = (string) $c['r'];
                $col  = self::columnaAIndice(preg_replace('/\d+/', '', $ref) ?: 'A');
                $tipo = (string) $c['t'];

                if ($tipo === 's') {
                    $valor = $compartidas[(int) $c->v] ?? '';
                } elseif ($tipo === 'inlineStr') {
                    $valor = (string) ($c->is->t ?? '');
                    if ($valor === '' && isset($c->is->r)) {
                        foreach ($c->is->r as $r) {
                            $valor .= (string) $r->t;
                        }
                    }
                } else {
                    $valor = (string) ($c->v ?? '');
                }
                $fila[$col] = $valor;
            }
            if ($fila) {
                $filas[] = $fila + array_fill(0, max(array_keys($fila)) + 1, '');
                ksort($filas[count($filas) - 1]);
            }
            if (count($filas) > self::MAX_FILAS + 1) {
                break;
            }
        }

        return ['ok' => true, 'filas' => $filas];
    }

    /** "AB" => 27 */
    private static function columnaAIndice(string $letras): int
    {
        $n = 0;
        foreach (str_split(strtoupper($letras)) as $ch) {
            $n = $n * 26 + (ord($ch) - 64);
        }
        return $n - 1;
    }

    // =================================================================
    // Interpretación
    // =================================================================

    /**
     * Convierte la matriz en pagos normalizados + hallazgos de limpieza.
     *
     * @return array{ok:bool, mensaje?:string, pagos:array, hallazgos:array,
     *               columnas:array, filas_leidas:int, celdas_limpiadas:int}
     */
    public static function interpretar(array $filas): array
    {
        $vacio = ['pagos' => [], 'hallazgos' => [], 'columnas' => [],
                  'filas_leidas' => 0, 'celdas_limpiadas' => 0];

        // Busca el encabezado en las primeras 10 filas: muchas plantillas
        // traen un título o un logo arriba de la tabla.
        $mapa = [];
        $filaEncabezado = -1;
        foreach (array_slice($filas, 0, 10, true) as $i => $fila) {
            $m = self::mapearEncabezados($fila);
            if (count(array_intersect(self::OBLIGATORIAS, $m)) >= 4) {
                $mapa = $m;
                $filaEncabezado = $i;
                break;
            }
        }

        if ($filaEncabezado === -1) {
            return array_merge($vacio, ['ok' => false, 'mensaje' =>
                'No se reconoció la fila de encabezados. Descargue la plantilla y respete '
                . 'los nombres de las columnas.']);
        }

        $faltantes = array_diff(self::OBLIGATORIAS, $mapa);
        if ($faltantes) {
            $legibles = implode(', ', array_map(
                static fn($c) => str_replace('_', ' ', $c), $faltantes));
            return array_merge($vacio, ['ok' => false, 'mensaje' =>
                'Faltan columnas obligatorias en la plantilla: ' . $legibles . '.']);
        }

        $pagos = [];
        $hallazgos = [];
        $limpiadas = 0;
        $leidas = 0;

        foreach (array_slice($filas, $filaEncabezado + 1, null, true) as $iFila => $fila) {
            $filaExcel = $iFila + 1;

            // Fila totalmente vacía en los campos obligatorios: se ignora
            $tieneAlgo = false;
            foreach ($mapa as $col => $campo) {
                if (in_array($campo, self::OBLIGATORIAS, true)
                    && PagosTexto::limpiar((string) ($fila[$col] ?? '')) !== '') {
                    $tieneAlgo = true;
                    break;
                }
            }
            if (!$tieneAlgo) {
                continue;
            }

            $leidas++;
            $orden = count($pagos) + 1;
            $p = ['fila_origen' => $filaExcel, 'banco_manual' => 0];

            foreach ($mapa as $col => $campo) {
                $bruto  = (string) ($fila[$col] ?? '');
                $limpio = PagosTexto::limpiar($bruto);

                // --- Aquí se atrapa el problema de los espacios en celdas ---
                $notas = PagosTexto::anomalias($bruto, $limpio);
                if ($notas) {
                    $limpiadas++;
                    $hallazgos[] = [
                        'severidad' => PagosValidador::AVISO,
                        'codigo'    => 'IMP050',
                        'mensaje'   => 'Se corrigió automáticamente: ' . implode(', ', $notas) . '.',
                        'fila'      => $orden,
                        'campo'     => $campo,
                    ];
                }

                if (PagosTexto::esNotacionCientifica($bruto)) {
                    $hallazgos[] = [
                        'severidad' => PagosValidador::ERROR,
                        'codigo'    => 'IMP051',
                        'mensaje'   => 'Excel convirtió este número a notación científica («' . $limpio
                            . '») y el dato original se perdió. En la plantilla, dé formato de '
                            . 'Texto a la columna antes de pegar los datos.',
                        'fila'      => $orden,
                        'campo'     => $campo,
                    ];
                }

                $p[$campo] = match ($campo) {
                    'identificacion', 'producto_destino' => PagosTexto::soloDigitos($bruto),
                    'tipo_identificacion' => str_pad(PagosTexto::soloDigitos($bruto), 2, '0', STR_PAD_LEFT),
                    'tipo_producto'       => strtoupper($limpio),
                    'codigo_banco'        => PagosTexto::soloDigitos($bruto),
                    'valor'               => PagosTexto::aDecimal($bruto) ?? $limpio,
                    default               => PagosTexto::nombre($limpio),
                };
            }

            foreach (['beneficiario' => ''] as $k => $def) {
                $p[$k] ??= $def;
            }
            $pagos[] = $p;

            if (count($pagos) >= self::MAX_FILAS) {
                $hallazgos[] = [
                    'severidad' => PagosValidador::AVISO, 'codigo' => 'IMP060',
                    'mensaje' => 'El archivo supera ' . self::MAX_FILAS
                        . ' filas. Se cargaron las primeras ' . self::MAX_FILAS . '.',
                    'fila' => null, 'campo' => '',
                ];
                break;
            }
        }

        return [
            'ok' => true,
            'pagos' => $pagos,
            'hallazgos' => $hallazgos,
            'columnas' => array_values($mapa),
            'filas_leidas' => $leidas,
            'celdas_limpiadas' => $limpiadas,
        ];
    }

    /** Plantilla CSV descargable. */
    public static function plantillaCsv(): string
    {
        $filas = [
            ['Identificación', 'Tipo de identificación', 'Producto de destino',
             'Tipo de producto', 'Código del banco', 'Valor del traslado', 'Beneficiario'],
            ['1020304050', '01', '012345678901', 'CA', '51', '250000', 'NOMBRE APELLIDO'],
            ['1020304051', '01', '3101234567', 'DP', '51', '120000', 'NOMBRE APELLIDO'],
            ['900123456',  '03', '045678901234', 'CC', '7', '1850000', 'RAZON SOCIAL S.A.S.'],
        ];
        $salida = "\xEF\xBB\xBF"; // BOM para que Excel abra en UTF-8
        foreach ($filas as $f) {
            $salida .= implode(';', array_map(
                static fn($c) => '"' . str_replace('"', '""', $c) . '"', $f)) . "\r\n";
        }
        return $salida;
    }
}
