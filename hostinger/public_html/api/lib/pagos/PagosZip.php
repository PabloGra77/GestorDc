<?php
declare(strict_types=1);

/**
 * ZIP cifrado con AES-256, con ZipArchive puro (sin librerías externas) —
 * Portal de Pagos.
 *
 * ZipArchive::setEncryptionName() existe desde PHP 7.2 si libzip se compiló
 * con soporte de cifrado, pero el método puede EXISTIR en la clase mientras
 * el libzip enlazado en el hosting no soporte AES: en ese caso devuelve
 * false en silencio. Por eso soportaCifrado() hace una prueba real, no solo
 * mira si el método existe.
 */
final class PagosZip
{
    private static ?bool $soportado = null;

    public static function soportaCifrado(): bool
    {
        if (self::$soportado !== null) {
            return self::$soportado;
        }
        if (!class_exists('ZipArchive') || !defined('ZipArchive::EM_AES_256')) {
            return self::$soportado = false;
        }

        $ruta = PagosLote::storageDir() . '/_zipchk_' . bin2hex(random_bytes(6)) . '.zip';
        $zip = new ZipArchive();
        $ok = $zip->open($ruta, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true;
        if ($ok) {
            $zip->addFromString('t.txt', 'x');
            $ok = $zip->setEncryptionName('t.txt', ZipArchive::EM_AES_256, 'prueba123456') && $zip->close();
        }
        @unlink($ruta);
        return self::$soportado = $ok;
    }

    /**
     * Crea un ZIP cifrado con AES-256. Si cualquier archivo falla al
     * cifrarse, no deja un ZIP a medias en disco.
     *
     * @param array<string,string> $archivos nombre dentro del zip => contenido binario
     */
    public static function crearCifrado(string $rutaDestino, array $archivos, string $clave): bool
    {
        $zip = new ZipArchive();
        if ($zip->open($rutaDestino, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return false;
        }
        foreach ($archivos as $nombre => $contenido) {
            $zip->addFromString($nombre, $contenido);
            if (!$zip->setEncryptionName($nombre, ZipArchive::EM_AES_256, $clave)) {
                $zip->close();
                @unlink($rutaDestino);
                return false;
            }
        }
        if (!$zip->close()) {
            @unlink($rutaDestino);
            return false;
        }
        return true;
    }
}
