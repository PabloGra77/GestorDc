<?php
declare(strict_types=1);

/**
 * Arma un archivo .eml (RFC 5322/MIME) descargable, con los adjuntos ya
 * empacados — Portal de Pagos. El servidor nunca envía el correo: la
 * persona lo abre en Outlook de escritorio, pulsa "Reenviar" (queda editable
 * conservando los adjuntos) y lo manda desde su propia cuenta anclada. Sin
 * librerías: solo funciones nativas de PHP (mbstring).
 */
final class PagosCorreo
{
    public static function saludoPorHora(?DateTimeImmutable $ahora = null): string
    {
        $h = (int) ($ahora ?? new DateTimeImmutable('now'))->format('G');
        if ($h < 12) return 'Buenos días';
        if ($h < 19) return 'Buenas tardes';
        return 'Buenas noches';
    }

    public static function cuerpoPredeterminado(array $lote, string $clave): string
    {
        $totalFormateado = '$' . number_format((float) $lote['valor_total'], 2, ',', '.');
        return self::saludoPorHora() . ",\n\n"
            . "Me permito compartir archivo plano para pagos habilitado para el portal, "
            . "como es de su conocimiento el plano va comprimido y cifrado y adjunto la "
            . "clave para descomprimirlo y liberarlo para su respectivo proceso de pago.\n\n"
            . "Se adjunta archivo también para validación y cruce.\n\n"
            . "clave: {$clave}\n"
            . 'Cantidad filas: ' . (int) $lote['cantidad_pagos'] . "\n"
            . 'Valor total: ' . $totalFormateado . "\n\n"
            . 'Quedo atento.';
    }

    /**
     * @param array{nombre:string,email:string} $remitente
     * @param array<int,array{nombre:string,contenido:string,tipoMime:string}> $adjuntos
     */
    public static function construirEml(
        array $remitente, string $para, string $cc, string $asunto, string $cuerpo, array $adjuntos
    ): string {
        $boundary = '=_Boundary_' . bin2hex(random_bytes(16));
        $l = [];
        $l[] = 'From: ' . self::direccion($remitente['nombre'], $remitente['email']);
        $l[] = 'To: ' . $para;
        if (trim($cc) !== '') {
            $l[] = 'Cc: ' . $cc;
        }
        $l[] = 'Subject: ' . mb_encode_mimeheader($asunto, 'UTF-8', 'B', "\r\n");
        $l[] = 'Date: ' . date('r');
        $l[] = 'Message-ID: <' . bin2hex(random_bytes(12)) . '@pagos.local>';
        $l[] = 'MIME-Version: 1.0';
        $l[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';
        $l[] = '';
        $l[] = '--' . $boundary;
        $l[] = 'Content-Type: text/plain; charset="UTF-8"';
        $l[] = 'Content-Transfer-Encoding: quoted-printable';
        $l[] = '';
        $l[] = quoted_printable_encode($cuerpo);

        foreach ($adjuntos as $a) {
            $nombre = str_replace('"', '', $a['nombre']);
            $l[] = '--' . $boundary;
            $l[] = 'Content-Type: ' . $a['tipoMime'] . '; name="' . $nombre . '"';
            $l[] = 'Content-Disposition: attachment; filename="' . $nombre . '"';
            $l[] = 'Content-Transfer-Encoding: base64';
            $l[] = '';
            $l[] = chunk_split(base64_encode($a['contenido']), 76, "\r\n");
        }
        $l[] = '--' . $boundary . '--';
        $l[] = '';

        return implode("\r\n", $l);
    }

    private static function direccion(string $nombre, string $email): string
    {
        $nombre = trim($nombre);
        if ($nombre === '') {
            return $email;
        }
        return mb_encode_mimeheader($nombre, 'UTF-8', 'B', "\r\n") . ' <' . $email . '>';
    }
}
