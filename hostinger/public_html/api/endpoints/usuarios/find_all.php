<?php
declare(strict_types=1);

Auth::requireUser();

$pdo = Db::pdo();
$rows = $pdo->query(
    "SELECT u.*, r.id AS r_id, r.nombre AS r_nombre, r.descripcion AS r_desc,
            r.activo AS r_activo, r.permisos AS r_permisos
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     ORDER BY u.id ASC"
)->fetchAll();

Response::json(array_map([Shapes::class, 'usuario'], $rows));
