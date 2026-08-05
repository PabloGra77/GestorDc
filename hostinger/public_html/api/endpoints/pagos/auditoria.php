<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('verAuditoria');

$limite = min(500, max(1, (int) (Request::query('limite') ?? '100')));

$filas = Db::pdo()->prepare(
    "SELECT * FROM auditoria_logs WHERE accion LIKE 'pagos.%' ORDER BY created_at DESC LIMIT " . $limite
);
$filas->execute();

Response::json(array_map(static fn($f) => [
    'id'         => (int) $f['id'],
    'usuario'    => $f['nombre_completo'] ?? $f['correo'],
    'accion'     => substr((string) $f['accion'], strlen('pagos.')),
    'detalle'    => $f['detalle'] ? json_decode((string) $f['detalle'], true) : null,
    'ip'         => $f['ip'],
    'creadoEn'   => $f['created_at'],
], $filas->fetchAll()));
