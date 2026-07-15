<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

Auth::requireAdmin();

$pdo = Db::pdo();

// Parámetros de filtro
$fechaDesde   = isset($_GET['fecha_desde'])   ? trim((string)$_GET['fecha_desde'])   : null;
$fechaHasta   = isset($_GET['fecha_hasta'])   ? trim((string)$_GET['fecha_hasta'])   : null;
$accion       = isset($_GET['accion'])        ? trim((string)$_GET['accion'])        : null;
$usuarioId    = isset($_GET['usuario_id'])    ? (int)$_GET['usuario_id']             : null;
$busqueda     = isset($_GET['q'])             ? trim((string)$_GET['q'])             : null;
$pagina       = max(1, (int)($_GET['pagina'] ?? 1));
$porPagina    = min(200, max(10, (int)($_GET['por_pagina'] ?? 50)));
$offset       = ($pagina - 1) * $porPagina;

$where  = [];
$params = [];

if ($fechaDesde) {
    $where[]            = 'al.created_at >= :fecha_desde';
    $params[':fecha_desde'] = $fechaDesde . ' 00:00:00';
}
if ($fechaHasta) {
    $where[]            = 'al.created_at <= :fecha_hasta';
    $params[':fecha_hasta'] = $fechaHasta . ' 23:59:59';
}
if ($accion) {
    $where[]            = 'al.accion = :accion';
    $params[':accion']  = $accion;
}
if ($usuarioId) {
    $where[]              = 'al.usuario_id = :usuario_id';
    $params[':usuario_id'] = $usuarioId;
}
if ($busqueda) {
    $where[]            = '(al.correo LIKE :q OR al.nombre_completo LIKE :q OR al.ip LIKE :q OR al.detalle LIKE :q)';
    $params[':q']       = '%' . $busqueda . '%';
}

$whereClause = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

// Total
$stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM auditoria_logs al $whereClause");
$stmtTotal->execute($params);
$total = (int)$stmtTotal->fetchColumn();

// Registros paginados
$sql = "SELECT al.id, al.usuario_id, al.correo, al.nombre_completo, al.accion,
               al.detalle, al.ip, al.user_agent, al.exitoso, al.created_at
        FROM auditoria_logs al
        $whereClause
        ORDER BY al.created_at DESC
        LIMIT :limit OFFSET :offset";

$stmt = $pdo->prepare($sql);
foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
$stmt->bindValue(':limit',  $porPagina, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset,    PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$logs = array_map(fn($r) => [
    'id'            => (int)$r['id'],
    'usuarioId'     => $r['usuario_id'] ? (int)$r['usuario_id'] : null,
    'correo'        => $r['correo'],
    'nombreCompleto'=> $r['nombre_completo'],
    'accion'        => $r['accion'],
    'detalle'       => $r['detalle'],
    'ip'            => $r['ip'],
    'userAgent'     => $r['user_agent'],
    'exitoso'       => (bool)$r['exitoso'],
    'creadoEn'      => $r['created_at'],
], $rows);

Response::json([
    'total'     => $total,
    'pagina'    => $pagina,
    'porPagina' => $porPagina,
    'logs'      => $logs,
]);
