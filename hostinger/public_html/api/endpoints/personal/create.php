<?php
declare(strict_types=1);

// Autorizar UNA cedula (whitelist) para que pueda crear cuenta. Solo admin.
Auth::requireAdmin();
require_once __DIR__ . '/_helpers.php';

$body = Request::body();
$cc   = PersonalHelpers::limpiarDocumento((string)($body['numeroDocumento'] ?? $body['cc'] ?? ''));
$rol  = PersonalHelpers::normalizarRol((string)($body['rol'] ?? ''));
$area = trim((string)($body['area'] ?? ''));

if (strlen($cc) < 4) Response::error('Numero de documento invalido', 400);
if (!in_array($rol, PersonalHelpers::ROLES_VALIDOS, true)) {
    Response::error('Rol invalido. Use: ' . implode(', ', PersonalHelpers::ROLES_VALIDOS), 400);
}

$pdo = Db::pdo();

// El rol debe existir en la tabla roles
if (PersonalHelpers::rolIdPorSlug($pdo, $rol) === null) {
    Response::error("El rol '{$rol}' no existe en el sistema", 400);
}

// area requerida para roles que validan por area
$areaId = PersonalHelpers::areaIdPorNombre($pdo, $area);
if (in_array($rol, ['analista', 'coordinador', 'director'], true) && $areaId === null) {
    Response::error("El rol '{$rol}' requiere un area valida (no se encontro: '{$area}')", 400);
}

$nivel = PersonalHelpers::nivelDeRol($rol);

$st = $pdo->prepare(
    "INSERT INTO personal_autorizado (numero_documento, rol, area, nivel_aprobacion, usado)
     VALUES (:cc, :rol, :area, :niv, 0)
     ON DUPLICATE KEY UPDATE rol = VALUES(rol), area = VALUES(area),
       nivel_aprobacion = VALUES(nivel_aprobacion)"
);
$st->execute([
    ':cc'   => $cc,
    ':rol'  => $rol,
    ':area' => $area !== '' ? $area : null,
    ':niv'  => $nivel,
]);

Response::json([
    'ok' => true,
    'numeroDocumento' => $cc,
    'rol' => $rol,
    'area' => $area !== '' ? $area : null,
], 201);
