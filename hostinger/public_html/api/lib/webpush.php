<?php
declare(strict_types=1);

/**
 * Web Push via VAPID (RFC 8292).
 * Sends empty-payload pushes — no AES-GCM needed, avoids complex encryption.
 * The service worker wakes up and shows a hardcoded notification.
 */
final class WebPushSender
{
    private const SUBJECT = 'mailto:estadistica@goleman.edu.co';

    /** Returns base64url-encoded VAPID public key, or null if not initialised yet. */
    public static function getPublicKey(): ?string
    {
        return Settings::get('vapid.public_key');
    }

    /** Generates and persists VAPID key pair if not already present. */
    public static function ensureKeys(): bool
    {
        if (Settings::get('vapid.public_key') !== null) return true;

        $config = ['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1'];
        $key = openssl_pkey_new($config);
        if ($key === false) { error_log('[webpush] openssl_pkey_new failed'); return false; }

        openssl_pkey_export($key, $privPem);
        $details = openssl_pkey_get_details($key);
        $pubDer = base64_decode(str_replace(
            ['-----BEGIN PUBLIC KEY-----', '-----END PUBLIC KEY-----', "\n", "\r"],
            '',
            (string)($details['key'] ?? '')
        ));
        if (strlen($pubDer) < 65) { error_log('[webpush] DER key too short'); return false; }

        // Uncompressed EC point: 0x04 + 32 bytes X + 32 bytes Y (last 65 bytes of SubjectPublicKeyInfo DER)
        $rawPub       = substr($pubDer, -65);
        $pubBase64Url = rtrim(strtr(base64_encode($rawPub), '+/', '-_'), '=');

        Settings::set('vapid.public_key',  $pubBase64Url);
        Settings::set('vapid.private_pem', $privPem);
        return true;
    }

    /** Persist a browser push subscription for a user. */
    public static function subscribe(PDO $pdo, int $userId, string $endpoint, string $p256dh, string $auth): void
    {
        self::ensureTable($pdo);
        $pdo->prepare(
            "INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth)
             VALUES (:u, :e, :p, :a)
             ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id),
               p256dh = VALUES(p256dh), auth = VALUES(auth)"
        )->execute([':u' => $userId, ':e' => $endpoint, ':p' => $p256dh, ':a' => $auth]);
    }

    /** Remove a push subscription by endpoint URL. */
    public static function unsubscribe(PDO $pdo, string $endpoint): void
    {
        try {
            $pdo->prepare("DELETE FROM push_subscriptions WHERE endpoint = ?")->execute([$endpoint]);
        } catch (Throwable $e) {
            error_log('[webpush] unsubscribe: ' . $e->getMessage());
        }
    }

    /** Send a push ping to all subscriptions of the given user IDs. */
    public static function notificar(PDO $pdo, array $usuarioIds): void
    {
        if (empty($usuarioIds)) return;
        $pubKey  = Settings::get('vapid.public_key');
        $privPem = Settings::get('vapid.private_pem');
        if (!$pubKey || !$privPem) {
            if (!self::ensureKeys()) return;
            $pubKey  = Settings::get('vapid.public_key');
            $privPem = Settings::get('vapid.private_pem');
            if (!$pubKey || !$privPem) return;
        }

        $privKey = openssl_pkey_get_private($privPem);
        if (!$privKey) return;

        try {
            $placeholders = implode(',', array_fill(0, count($usuarioIds), '?'));
            $stmt = $pdo->prepare(
                "SELECT id, endpoint FROM push_subscriptions WHERE usuario_id IN ({$placeholders})"
            );
            $stmt->execute(array_values($usuarioIds));
            $subs = $stmt->fetchAll();
        } catch (Throwable $e) {
            error_log('[webpush] DB: ' . $e->getMessage());
            return;
        }

        $expired = [];
        foreach ($subs as $sub) {
            $code = self::sendOne((string)$sub['endpoint'], $privKey, $pubKey);
            if ($code === 404 || $code === 410) $expired[] = (string)$sub['endpoint'];
        }
        foreach ($expired as $ep) self::unsubscribe($pdo, $ep);
    }

    /** Convenience: send push to a user identified by email address. */
    public static function notificarPorCorreo(PDO $pdo, string $correo): void
    {
        if (!$correo) return;
        try {
            $s = $pdo->prepare("SELECT id FROM usuarios WHERE correo = ? AND activo = 1 LIMIT 1");
            $s->execute([$correo]);
            $row = $s->fetch();
            if ($row) self::notificar($pdo, [(int)$row['id']]);
        } catch (Throwable $e) {
            error_log('[webpush] byEmail: ' . $e->getMessage());
        }
    }

    /** Convenience: send push to all validators with the given nivel + area. */
    public static function notificarPorNivel(PDO $pdo, string $nivel, int $areaId): void
    {
        if (!$nivel) return;
        try {
            if ($nivel === 'contabilidad') {
                $s = $pdo->prepare("SELECT id FROM usuarios WHERE activo = 1 AND nivel_aprobacion = ?");
                $s->execute([$nivel]);
            } else {
                $s = $pdo->prepare("SELECT id FROM usuarios WHERE activo = 1 AND nivel_aprobacion = ? AND area_id = ?");
                $s->execute([$nivel, $areaId]);
            }
            $ids = array_column($s->fetchAll(), 'id');
            if ($ids) self::notificar($pdo, array_map('intval', $ids));
        } catch (Throwable $e) {
            error_log('[webpush] byNivel: ' . $e->getMessage());
        }
    }

    // ─── Private helpers ───────────────────────────────────────────────────────

    /** Send one empty-payload push. Returns HTTP response code. */
    private static function sendOne(string $endpoint, $privKey, string $pubKey): int
    {
        try {
            $parsedUrl = parse_url($endpoint);
            $origin = ($parsedUrl['scheme'] ?? 'https') . '://' . ($parsedUrl['host'] ?? '');
            if (!$origin) return 0;

            $jwt = self::vapidJwt($origin, $privKey);

            $ch = curl_init($endpoint);
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST  => 'POST',
                CURLOPT_POSTFIELDS     => '',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_HTTPHEADER     => [
                    'Authorization: vapid t=' . $jwt . ',k=' . $pubKey,
                    'TTL: 86400',
                    'Urgency: normal',
                    'Content-Length: 0',
                ],
            ]);
            curl_exec($ch);
            $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            return $code;
        } catch (Throwable $e) {
            error_log('[webpush] sendOne: ' . $e->getMessage());
            return 0;
        }
    }

    /** Build and sign a VAPID JWT for the given push service origin. */
    private static function vapidJwt(string $audience, $privKey): string
    {
        $h = rtrim(strtr(base64_encode('{"typ":"JWT","alg":"ES256"}'), '+/', '-_'), '=');
        $p = rtrim(strtr(base64_encode((string)json_encode([
            'aud' => $audience,
            'exp' => time() + 43200,
            'sub' => self::SUBJECT,
        ])), '+/', '-_'), '=');
        $toSign = $h . '.' . $p;
        openssl_sign($toSign, $derSig, $privKey, OPENSSL_ALGO_SHA256);
        return $toSign . '.' . rtrim(strtr(base64_encode(self::derToRaw($derSig)), '+/', '-_'), '=');
    }

    /**
     * Convert DER-encoded ECDSA signature to raw r|s (64 bytes) required by JWT ES256.
     * DER layout: 30 <totalLen> 02 <rLen> <r> 02 <sLen> <s>
     */
    private static function derToRaw(string $der): string
    {
        $pos = 2;              // skip SEQUENCE tag + length
        $pos++;                // skip INTEGER tag (0x02) for r
        $rLen = ord($der[$pos++]);
        $r = substr($der, $pos, $rLen);
        $pos += $rLen;
        $pos++;                // skip INTEGER tag (0x02) for s
        $sLen = ord($der[$pos++]);
        $s = substr($der, $pos, $sLen);
        // Normalise each to exactly 32 bytes (P-256 field size)
        $r = str_pad(ltrim($r, "\x00"), 32, "\x00", STR_PAD_LEFT);
        $s = str_pad(ltrim($s, "\x00"), 32, "\x00", STR_PAD_LEFT);
        return $r . $s;
    }

    private static function ensureTable(PDO $pdo): void
    {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS push_subscriptions (
               id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
               usuario_id  INT UNSIGNED NOT NULL,
               endpoint    TEXT NOT NULL,
               p256dh      VARCHAR(500) NOT NULL,
               auth        VARCHAR(100) NOT NULL,
               created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               UNIQUE KEY uq_endpoint (endpoint(512))
             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    }
}
