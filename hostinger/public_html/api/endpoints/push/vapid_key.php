<?php
declare(strict_types=1);

Auth::requireUser();
WebPushSender::ensureKeys();
$key = WebPushSender::getPublicKey();
Response::json(['publicKey' => $key]);
