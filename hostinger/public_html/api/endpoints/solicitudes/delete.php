<?php
declare(strict_types=1);

// Eliminar una solicitud por completo. Solo administradores.
Auth::requireAdmin();

$id = (int)($params['id'] ?? 0);
if ($id <= 0) Response::error('Identificador inválido', 400);

$pdo = Db::pdo();

// Recuperar adjuntos para borrarlos del disco después
$docsRow = $pdo->prepare("SELECT documentos FROM solicitudes WHERE id = :id LIMIT 1");
$docsRow->execute([':id' => $id]);
$row = $docsRow->fetch();
if (!$row) Response::error('Solicitud no encontrada', 404);

$pdo->beginTransaction();
try {
    $pdo->prepare("DELETE FROM solicitud_movimientos WHERE solicitud_id = :id")->execute([':id' => $id]);
    $del = $pdo->prepare("DELETE FROM solicitudes WHERE id = :id");
    $del->execute([':id' => $id]);
    if ($del->rowCount() === 0) {
        $pdo->rollBack();
        Response::error('Solicitud no encontrada', 404);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[solicitudes/delete] ' . $e->getMessage());
    Response::error('No se pudo eliminar la solicitud', 500);
}

// Borrar archivos adjuntos del disco (best-effort, no bloquea)
$docs = json_decode((string)($row['documentos'] ?? ''), true);
if (is_array($docs)) {
    foreach ($docs as $info) {
        $aid = is_array($info) ? ($info['archivoId'] ?? '') : '';
        if (is_string($aid) && preg_match('/^[a-f0-9]{32}\.(pdf|jpg|png|webp)$/', $aid)) {
            @unlink(__DIR__ . '/../../uploads/' . $aid);
        }
    }
}

Response::json(['ok' => true]);
