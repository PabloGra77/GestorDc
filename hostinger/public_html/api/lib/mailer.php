<?php
declare(strict_types=1);

/**
 * SMTP client minimo sin dependencias externas.
 * Soporta STARTTLS y SSL implicito (puerto 465).
 */
final class Mailer
{
    public static function send(array $params): bool
    {
        // La configuracion guardada en BD (panel admin) tiene prioridad; si no existe,
        // se usa el .env como fallback.
        $host = Settings::get('smtp_host', Config::get('SMTP_HOST'));
        $user = Settings::get('smtp_user', Config::get('SMTP_USER'));
        $pass = Settings::decryptSecret(Settings::get('smtp_pass', Config::get('SMTP_PASS')));
        $from = Settings::get('smtp_from', Config::get('SMTP_FROM')) ?: $user;
        $port = (int)(Settings::get('smtp_port', (string)Config::getInt('SMTP_PORT', 587)));
        $secureRaw = Settings::get('smtp_secure');
        $secure = $secureRaw !== null
            ? in_array(strtolower($secureRaw), ['1', 'true', 'yes', 'on'], true)
            : Config::getBool('SMTP_SECURE', false);

        if (!$host || !$user || !$pass || !$from) {
            error_log('SMTP no configurado completamente. Se omite envio.');
            return false;
        }

        $to = $params['to'] ?? [];
        $cc = $params['cc'] ?? [];
        $subject = $params['subject'] ?? '(sin asunto)';
        $text = $params['text'] ?? '';
        $html = $params['html'] ?? null;

        if (!is_array($to)) $to = [$to];
        if (!is_array($cc)) $cc = [$cc];
        $to = array_filter($to);
        $cc = array_filter($cc);
        if (empty($to)) return false;

        $remote = ($secure ? 'ssl://' : '') . $host . ':' . $port;
        $errno = 0; $errstr = '';
        $sock = @stream_socket_client($remote, $errno, $errstr, 15);
        if (!$sock) {
            error_log("SMTP connect fallo: {$errstr}");
            return false;
        }
        stream_set_timeout($sock, 15);

        try {
            self::expect($sock, 220);
            self::cmd($sock, 'EHLO ' . self::hostname(), 250);

            if (!$secure && $port === 587) {
                self::cmd($sock, 'STARTTLS', 220);
                if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new RuntimeException('No se pudo habilitar TLS');
                }
                self::cmd($sock, 'EHLO ' . self::hostname(), 250);
            }

            self::cmd($sock, 'AUTH LOGIN', 334);
            self::cmd($sock, base64_encode($user), 334);
            self::cmd($sock, base64_encode($pass), 235);

            $fromAddr = self::extractAddress($from);
            self::cmd($sock, "MAIL FROM:<{$fromAddr}>", 250);
            foreach (array_merge($to, $cc) as $rcpt) {
                self::cmd($sock, "RCPT TO:<" . self::extractAddress($rcpt) . ">", 250);
            }
            self::cmd($sock, 'DATA', 354);

            $headers = self::buildHeaders($from, $to, $cc, $subject, $html !== null);
            $body = self::buildBody($text, $html);
            self::write($sock, $headers . "\r\n\r\n" . $body . "\r\n.\r\n");
            self::expect($sock, 250);

            self::cmd($sock, 'QUIT', 221);
            fclose($sock);
            return true;
        } catch (Throwable $e) {
            error_log('SMTP error: ' . $e->getMessage());
            @fclose($sock);
            return false;
        }
    }

    private static function cmd($sock, string $line, int $expect): void
    {
        self::write($sock, $line . "\r\n");
        self::expect($sock, $expect);
    }

    private static function write($sock, string $data): void
    {
        fwrite($sock, $data);
    }

    private static function expect($sock, int $code): string
    {
        $response = '';
        while (!feof($sock)) {
            $line = fgets($sock, 1024);
            if ($line === false) break;
            $response .= $line;
            if (strlen($line) >= 4 && $line[3] === ' ') break;
        }
        if ((int)substr($response, 0, 3) !== $code) {
            throw new RuntimeException("SMTP esperaba {$code}, recibio: " . trim($response));
        }
        return $response;
    }

    private static function buildHeaders(string $from, array $to, array $cc, string $subject, bool $isHtml): string
    {
        $boundary = 'b_' . bin2hex(random_bytes(8));
        $clean = fn(string $s): string => str_replace(["\r", "\n", "\0"], '', $s);
        $headers = [
            'From: ' . $clean($from),
            'To: ' . implode(', ', array_map($clean, $to)),
        ];
        if (!empty($cc)) {
            $headers[] = 'Cc: ' . implode(', ', array_map($clean, $cc));
        }
        $headers[] = 'Subject: =?UTF-8?B?' . base64_encode($clean($subject)) . '?=';
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Date: ' . date('r');
        if ($isHtml) {
            $headers[] = "Content-Type: multipart/alternative; boundary=\"{$boundary}\"";
            self::$boundary = $boundary;
        } else {
            $headers[] = 'Content-Type: text/plain; charset=UTF-8';
            $headers[] = 'Content-Transfer-Encoding: 8bit';
        }
        return implode("\r\n", $headers);
    }

    private static ?string $boundary = null;

    private static function buildBody(string $text, ?string $html): string
    {
        if ($html === null) {
            return self::dotStuff($text);
        }
        $b = self::$boundary;
        return self::dotStuff(
            "--{$b}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n\r\n"
            . $text . "\r\n"
            . "--{$b}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n\r\n"
            . $html . "\r\n"
            . "--{$b}--"
        );
    }

    /**
     * RFC 5321 4.5.2: duplicar cualquier linea que empiece con "."
     * para que el contenido del mensaje no pueda terminar prematuramente
     * la secuencia DATA ni inyectar comandos SMTP en la misma sesion.
     */
    private static function dotStuff(string $body): string
    {
        return preg_replace('/(^|\r\n)\./', '$1..', $body);
    }

    private static function extractAddress(string $s): string
    {
        // Defensa contra inyección de cabeceras: eliminar CR/LF y NUL
        $s = str_replace(["\r", "\n", "\0"], '', $s);
        if (preg_match('/<([^>]+)>/', $s, $m)) return $m[1];
        return trim($s);
    }

    private static function hostname(): string
    {
        return $_SERVER['SERVER_NAME'] ?? 'gestordoc.local';
    }
}
