<?php
declare(strict_types=1);

Auth::requireUser();
$body     = Request::body();
$endpoint = trim((string)($body['endpoint'] ?? ''));

if ($endpoint) {
    WebPushSender::unsubscribe(Db::pdo(), $endpoint);
}
Response::json(['ok' => true]);
