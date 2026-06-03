<?php
declare(strict_types=1);

Auth::requireUser();

$rows = Db::pdo()->query(
    "SELECT * FROM areas ORDER BY orden ASC, nombre ASC"
)->fetchAll();

Response::json(array_map(function ($row) {
    return [
        'id'          => (int)$row['id'],
        'nombre'      => $row['nombre'],
        'descripcion' => $row['descripcion'],
        'slug'        => $row['slug'],
        'activo'      => (bool)$row['activo'],
        'orden'       => (int)$row['orden'],
        'creadoEn'    => $row['creado_en'],
    ];
}, $rows));
