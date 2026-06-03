<?php
declare(strict_types=1);

// Endpoint publico: lista roles activos para el formulario de registro.
// Excluye el rol Administrador.
$pdo = Db::pdo();
$stmt = $pdo->query(
    "SELECT id, nombre, descripcion
     FROM roles
     WHERE activo = 1 AND LOWER(nombre) <> 'administrador'
     ORDER BY nombre ASC"
);
$rows = $stmt->fetchAll();

Response::json(array_map(fn($r) => [
    'id'          => (int)$r['id'],
    'nombre'      => (string)$r['nombre'],
    'descripcion' => $r['descripcion'] !== null ? (string)$r['descripcion'] : null,
], $rows));
