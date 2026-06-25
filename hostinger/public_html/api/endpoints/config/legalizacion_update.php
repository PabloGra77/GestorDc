<?php
declare(strict_types=1);

// PUT /config/legalizacion — actualiza configuración de legalizaciones. Solo admins.
$jwt = Auth::requireUser();

$pdo = Db::pdo();
$uStmt = $pdo->prepare("SELECT r.nombre AS rol FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id WHERE u.id = :id LIMIT 1");
$uStmt->execute([':id' => (int)$jwt['sub']]);
$user = $uStmt->fetch();
if (!$user || strtolower(trim($user['rol'] ?? '')) !== 'administrador') {
    Response::error('Solo administradores pueden modificar esta configuración', 403);
}

$body = Request::body();

if (isset($body['categorias'])) {
    $cats = is_array($body['categorias']) ? $body['categorias'] : [];
    $cats = array_values(array_filter(array_map(fn($c) => mb_substr(trim((string)$c), 0, 80), $cats)));
    if (count($cats) === 0) Response::error('Debe haber al menos una categoría', 400);
    Settings::set('legalizacion.categorias', json_encode($cats, JSON_UNESCAPED_UNICODE));
}

if (array_key_exists('montoMaximo', $body)) {
    $monto = max(0, (float)($body['montoMaximo'] ?? 0));
    Settings::set('legalizacion.monto_maximo', (string)$monto);
}

if (isset($body['mensajePago'])) {
    $msg = mb_substr(trim((string)$body['mensajePago']), 0, 1000);
    if ($msg === '') Response::error('El mensaje no puede estar vacío', 400);
    Settings::set('legalizacion.mensaje_pago', $msg);
}

Response::json(['ok' => true]);
