<?php
declare(strict_types=1);

/**
 * GET /push/status  (admin only)
 * Diagnostic endpoint: shows whether VAPID keys are present & valid,
 * and how many push subscriptions are saved in the DB.
 */
Auth::requireAdmin();

$pdo = Db::pdo();

// Ensure keys exist
WebPushSender::ensureKeys();

$pubKey  = WebPushSender::getPublicKey();
$privPem = Settings::get('vapid.private_pem');

$privOk = false;
if ($privPem) {
    $testKey = @openssl_pkey_get_private($privPem);
    $privOk  = ($testKey !== false && $testKey !== null);
}

// Count subscriptions
$subCount  = 0;
$tableExists = false;
try {
    $res = $pdo->query("SELECT COUNT(*) FROM push_subscriptions");
    $subCount    = (int)$res->fetchColumn();
    $tableExists = true;
} catch (Throwable) {
    $tableExists = false;
}

Response::json([
    'vapid_public_key'  => $pubKey,
    'private_key_valid' => $privOk,
    'private_key_format'=> $privPem ? (str_contains($privPem, 'EC PRIVATE') ? 'SEC1' : 'PKCS8') : null,
    'table_exists'      => $tableExists,
    'subscription_count'=> $subCount,
    'openssl_ec_ok'     => (bool)(@openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1'])),
]);
