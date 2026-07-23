<?php
declare(strict_types=1);

$jwt     = Auth::requireUser();
$userId  = (int)($jwt['sub'] ?? 0);
$body    = Request::body();

$endpoint = trim((string)($body['endpoint'] ?? ''));
$p256dh   = trim((string)($body['keys']['p256dh'] ?? ''));
$auth     = trim((string)($body['keys']['auth']   ?? ''));

if (!$endpoint || !$p256dh || !$auth) Response::error('Faltan campos de la suscripción', 400);

$pdo = Db::pdo();
WebPushSender::subscribe($pdo, $userId, $endpoint, $p256dh, $auth);
Response::json(['ok' => true]);
