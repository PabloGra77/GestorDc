<?php
declare(strict_types=1);

// DELETE /usuarios/:id  — solo administrador. Usado para "rechazar" auto-registros.
$ctx = Auth::requireAdmin();
$adminId = (int)($ctx['user']['id'] ?? 0);

$id = (int)($params['id'] ?? 0);
if ($id <= 0) Response::error('ID invalido', 400);
if ($id === $adminId) Response::error('No puedes eliminar tu propia cuenta', 400);

$pdo = Db::pdo();
$stmt = $pdo->prepare(
    "SELECT u.id, r.nombre AS rol
     FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = :id LIMIT 1"
);
$stmt->execute([':id' => $id]);
$u = $stmt->fetch();
if (!$u) Response::error('Usuario no encontrado', 404);
if (strtolower(trim((string)$u['rol'])) === 'administrador') {
    Response::error('No se puede eliminar un usuario administrador', 403);
}

try {
    $del = $pdo->prepare("DELETE FROM usuarios WHERE id = :id");
    $del->execute([':id' => $id]);
} catch (Throwable $e) {
    // Probable violacion de clave foranea (el usuario tiene historial asociado).
    error_log('[usuarios/delete] ' . $e->getMessage());
    Response::error(
        'No se puede eliminar: el usuario tiene registros asociados. Desactivalo en su lugar.',
        409
    );
}

Response::json(['ok' => true]);
