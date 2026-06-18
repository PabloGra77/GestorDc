<?php
declare(strict_types=1);

// Lista la whitelist de personal autorizado. Solo admin.
Auth::requireAdmin();

$pdo = Db::pdo();
$rows = $pdo->query(
    "SELECT id, numero_documento, rol, area, nivel_aprobacion, usado, usado_en, creado_en
     FROM personal_autorizado ORDER BY usado ASC, creado_en DESC LIMIT 1000"
)->fetchAll();

Response::json(array_map(static function ($r) {
    return [
        'id'              => (int)$r['id'],
        'numeroDocumento' => $r['numero_documento'],
        'rol'             => $r['rol'],
        'area'            => $r['area'],
        'nivelAprobacion' => $r['nivel_aprobacion'],
        'usado'           => (bool)$r['usado'],
        'usadoEn'         => $r['usado_en'],
        'creadoEn'        => $r['creado_en'],
    ];
}, $rows));
