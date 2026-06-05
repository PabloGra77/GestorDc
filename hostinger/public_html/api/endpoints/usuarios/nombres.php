<?php
declare(strict_types=1);

// Lista ligera de nombres para autocompletar (campos tipo "persona").
// Requiere usuario autenticado (cualquier rol); expone solo nombre + rol/área,
// no datos sensibles (correo, documento, etc.).
Auth::requireUser();

$pdo = Db::pdo();
$rows = $pdo->query(
    "SELECT u.id, u.nombre_completo, r.nombre AS rol, a.nombre AS area
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     LEFT JOIN areas a ON a.id = u.area_id
     WHERE u.activo = 1
     ORDER BY u.nombre_completo ASC"
)->fetchAll();

Response::json(array_map(static function (array $row): array {
    return [
        'id'             => (int)$row['id'],
        'nombreCompleto' => $row['nombre_completo'],
        'rol'            => $row['rol'],
        'area'           => $row['area'],
    ];
}, $rows));
