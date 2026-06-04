<?php
declare(strict_types=1);

/**
 * Verificación forense básica de documentos (facturas, soportes) en PHP puro.
 * No requiere librerías externas. Señales heurísticas, NO prueba legal de fraude.
 *
 * - PDF: metadatos (Producer/Creator), fechas de creación vs modificación,
 *   guardados incrementales, JavaScript embebido, anotaciones.
 * - Imagen: EXIF (software de edición, fechas, cámara) + Error Level Analysis (ELA) con GD.
 */
final class Forense
{
    /** Software de edición que NO debería producir una factura/soporte oficial. */
    private const EDITORES = [
        'photoshop', 'gimp', 'illustrator', 'coreldraw', 'canva', 'paint',
        'pixlr', 'inkscape', 'affinity', 'snapseed', 'lightroom', 'picsart',
    ];

    public static function analizar(string $bytes, string $nombre = 'documento'): array
    {
        $hallazgos = [];
        $metadatos = [];
        $tipo = 'desconocido';

        if (strncmp($bytes, '%PDF', 4) === 0) {
            $tipo = 'pdf';
            self::analizarPdf($bytes, $hallazgos, $metadatos);
        } elseif (self::esImagen($bytes)) {
            $tipo = 'imagen';
            self::analizarImagen($bytes, $hallazgos, $metadatos);
        } else {
            $hallazgos[] = ['severidad' => 'media', 'texto' => 'El archivo no es un PDF ni una imagen reconocible; no se pudo analizar su autenticidad.'];
        }

        // Puntaje y nivel de riesgo
        $puntaje = 0;
        foreach ($hallazgos as $h) {
            $puntaje += $h['severidad'] === 'alta' ? 3 : ($h['severidad'] === 'media' ? 1 : 0);
        }
        $nivel = $puntaje >= 3 ? 'alto' : ($puntaje >= 1 ? 'medio' : 'bajo');

        return [
            'tipo' => $tipo,
            'nivelRiesgo' => $nivel,
            'puntaje' => $puntaje,
            'hallazgos' => $hallazgos,
            'metadatos' => $metadatos,
            'nota' => 'Análisis heurístico de señales; no constituye prueba forense legal. Ante riesgo medio/alto, revisar manualmente.',
        ];
    }

    private static function esImagen(string $b): bool
    {
        return strncmp($b, "\xFF\xD8\xFF", 3) === 0          // JPEG
            || strncmp($b, "\x89PNG", 4) === 0               // PNG
            || strncmp($b, 'GIF8', 4) === 0;                 // GIF
    }

    // ---------------------------------------------------------------- PDF
    private static function analizarPdf(string $bytes, array &$hallazgos, array &$metadatos): void
    {
        // Producer / Creator
        $producer = self::pdfCampo($bytes, 'Producer');
        $creator  = self::pdfCampo($bytes, 'Creator');
        if ($producer !== null) $metadatos['producer'] = $producer;
        if ($creator !== null)  $metadatos['creator'] = $creator;

        foreach (['producer' => $producer, 'creator' => $creator] as $info) {
            if ($info === null) continue;
            $low = mb_strtolower($info, 'UTF-8');
            foreach (self::EDITORES as $ed) {
                if (strpos($low, $ed) !== false) {
                    $hallazgos[] = ['severidad' => 'alta', 'texto' => "El PDF fue generado o editado con software de edición de imágenes/diseño ($info); una factura legítima no suele crearse así."];
                    break;
                }
            }
        }

        // Fechas
        $creacion = self::pdfFecha($bytes, 'CreationDate');
        $modif    = self::pdfFecha($bytes, 'ModDate');
        if ($creacion) $metadatos['creacion'] = gmdate('Y-m-d H:i', $creacion);
        if ($modif)    $metadatos['modificacion'] = gmdate('Y-m-d H:i', $modif);
        if ($creacion && $modif && $modif > $creacion + 60) {
            $hallazgos[] = ['severidad' => 'media', 'texto' => 'El PDF fue modificado después de su creación (la fecha de modificación es posterior a la de creación).'];
        }

        // Guardados incrementales (varias secciones %%EOF) → edición posterior
        $eofs = substr_count($bytes, '%%EOF');
        $metadatos['guardadosEOF'] = $eofs;
        if ($eofs > 1) {
            $hallazgos[] = ['severidad' => 'media', 'texto' => "El PDF tiene $eofs guardados (actualizaciones incrementales); fue modificado después de generarse."];
        }

        // JavaScript embebido
        if (preg_match('#/JavaScript|/JS\b#', $bytes)) {
            $hallazgos[] = ['severidad' => 'media', 'texto' => 'El PDF contiene JavaScript embebido, inusual en una factura.'];
        }

        // Anotaciones (texto agregado encima)
        if (preg_match('#/Annots?\b#', $bytes)) {
            $hallazgos[] = ['severidad' => 'baja', 'texto' => 'El PDF contiene anotaciones; verifica que no se haya superpuesto texto sobre la factura.'];
        }
    }

    private static function pdfCampo(string $bytes, string $clave): ?string
    {
        if (preg_match('#/' . $clave . '\s*\(((?:[^()\\\\]|\\\\.)*)\)#', $bytes, $m)) {
            $v = preg_replace('/\\\\([()\\\\])/', '$1', $m[1]);
            $v = trim($v);
            return $v !== '' ? $v : null;
        }
        return null;
    }

    private static function pdfFecha(string $bytes, string $clave): ?int
    {
        // Formato PDF: D:YYYYMMDDHHmmSS
        if (preg_match('#/' . $clave . '\s*\(D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?#', $bytes, $m)) {
            $y = (int)$m[1]; $mo = (int)($m[2] ?: 1); $d = (int)($m[3] ?: 1);
            $h = (int)($m[4] ?: 0); $i = (int)($m[5] ?: 0); $s = (int)($m[6] ?: 0);
            $ts = gmmktime($h, $i, $s, $mo, $d, $y);
            return $ts !== false ? $ts : null;
        }
        return null;
    }

    // ---------------------------------------------------------------- Imagen
    private static function analizarImagen(string $bytes, array &$hallazgos, array &$metadatos): void
    {
        $esJpeg = strncmp($bytes, "\xFF\xD8\xFF", 3) === 0;

        // EXIF (solo JPEG y si la extensión está disponible)
        if ($esJpeg && function_exists('exif_read_data')) {
            $tmp = tempnam(sys_get_temp_dir(), 'fx_');
            if ($tmp) {
                file_put_contents($tmp, $bytes);
                $exif = @exif_read_data($tmp);
                @unlink($tmp);
                if (is_array($exif)) {
                    $sw = (string)($exif['Software'] ?? '');
                    if ($sw !== '') {
                        $metadatos['software'] = $sw;
                        $low = mb_strtolower($sw, 'UTF-8');
                        foreach (self::EDITORES as $ed) {
                            if (strpos($low, $ed) !== false) {
                                $hallazgos[] = ['severidad' => 'alta', 'texto' => "La imagen fue editada con software de edición ($sw)."];
                                break;
                            }
                        }
                    }
                    $hasModel = !empty($exif['Model']) || !empty($exif['Make']);
                    if (!$hasModel && $sw !== '') {
                        $hallazgos[] = ['severidad' => 'media', 'texto' => 'La imagen no tiene datos de cámara pero sí software de edición; pudo ser manipulada.'];
                    }
                    $dtO = strtotime((string)($exif['DateTimeOriginal'] ?? '')) ?: 0;
                    $dtM = strtotime((string)($exif['DateTime'] ?? '')) ?: 0;
                    if ($dtO && $dtM && $dtM > $dtO + 60) {
                        $hallazgos[] = ['severidad' => 'media', 'texto' => 'La imagen fue modificada después de tomarse (fecha de edición posterior a la de captura).'];
                    }
                }
            }
        }

        // Error Level Analysis (ELA) con GD
        if (function_exists('imagecreatefromstring')) {
            $ela = self::ela($bytes);
            if ($ela !== null) {
                $metadatos['ela'] = $ela;
                if ($ela['localizado']) {
                    $hallazgos[] = ['severidad' => 'alta', 'texto' => 'El análisis de nivel de error (ELA) detectó una zona con compresión muy distinta al resto: posible montaje o edición localizada.'];
                } elseif ($ela['global'] > 18) {
                    $hallazgos[] = ['severidad' => 'media', 'texto' => 'La imagen muestra un nivel de error alto y uniforme: pudo recomprimirse o editarse por completo.'];
                }
            }
        }
    }

    /**
     * ELA: recomprime la imagen y mide la diferencia por bloques.
     * Devuelve nivel global y si hay un bloque anómalo (edición localizada).
     */
    private static function ela(string $bytes): ?array
    {
        $src = @imagecreatefromstring($bytes);
        if (!$src) return null;
        try {
            $w = imagesx($src); $h = imagesy($src);
            if ($w < 16 || $h < 16) return null;
            // Recomprimir a JPEG calidad 90
            ob_start();
            imagejpeg($src, null, 90);
            $re = ob_get_clean();
            $cmp = @imagecreatefromstring($re);
            if (!$cmp) return null;

            $cols = 8; $rows = 8;
            $bw = (int)floor($w / $cols); $bh = (int)floor($h / $rows);
            if ($bw < 1 || $bh < 1) return null;
            $stepX = max(1, (int)floor($bw / 6));
            $stepY = max(1, (int)floor($bh / 6));

            $bloque = [];
            $sumGlobal = 0.0; $nGlobal = 0;
            for ($r = 0; $r < $rows; $r++) {
                for ($c = 0; $c < $cols; $c++) {
                    $sum = 0.0; $n = 0;
                    for ($y = $r * $bh; $y < ($r + 1) * $bh; $y += $stepY) {
                        for ($x = $c * $bw; $x < ($c + 1) * $bw; $x += $stepX) {
                            $p1 = imagecolorat($src, $x, $y);
                            $p2 = imagecolorat($cmp, $x, $y);
                            $d = abs((($p1 >> 16) & 0xFF) - (($p2 >> 16) & 0xFF))
                               + abs((($p1 >> 8) & 0xFF) - (($p2 >> 8) & 0xFF))
                               + abs(($p1 & 0xFF) - ($p2 & 0xFF));
                            $sum += $d / 3.0; $n++;
                        }
                    }
                    $avg = $n ? $sum / $n : 0.0;
                    $bloque[] = $avg;
                    $sumGlobal += $sum; $nGlobal += $n;
                }
            }
            imagedestroy($cmp);

            $global = $nGlobal ? $sumGlobal / $nGlobal : 0.0;
            $maxB = max($bloque ?: [0.0]);
            $media = array_sum($bloque) / max(1, count($bloque));
            // Bloque anómalo: muy por encima de la media del resto y en términos absolutos
            $localizado = $media > 0.5 && $maxB > $media * 3.5 && $maxB > 25;
            return [
                'global' => round($global, 2),
                'maxBloque' => round($maxB, 2),
                'mediaBloques' => round($media, 2),
                'localizado' => $localizado,
            ];
        } finally {
            imagedestroy($src);
        }
    }
}
