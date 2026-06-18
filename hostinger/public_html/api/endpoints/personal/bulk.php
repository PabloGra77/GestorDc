<?php
declare(strict_types=1);

// Autorizacion masiva por archivo plano. Solo admin.
// Recibe { texto } con lineas "cc,rol,area" (separador , ; o tab).
// Encabezado opcional (cc/cedula/documento) se ignora.
Auth::requireAdmin();
require_once __DIR__ . '/_helpers.php';

$body = Request::body();
$texto = (string)($body['texto'] ?? '');
if (trim($texto) === '') Response::error('No se recibio contenido del archivo', 400);
if (strlen($texto) > 2_000_000) Response::error('Archivo demasiado grande', 413);

$pdo = Db::pdo();

// Cache de roles/areas validos
$rolesOk = [];
foreach (PersonalHelpers::ROLES_VALIDOS as $r) {
    if (PersonalHelpers::rolIdPorSlug($pdo, $r) !== null) $rolesOk[$r] = true;
}

$lineas = preg_split('/\r\n|\r|\n/', $texto) ?: [];
$ins = $pdo->prepare(
    "INSERT INTO personal_autorizado (numero_documento, rol, area, nivel_aprobacion, usado)
     VALUES (:cc, :rol, :area, :niv, 0)
     ON DUPLICATE KEY UPDATE rol = VALUES(rol), area = VALUES(area), nivel_aprobacion = VALUES(nivel_aprobacion)"
);

$ok = 0; $errores = []; $n = 0;
foreach ($lineas as $linea) {
    $linea = trim($linea);
    if ($linea === '') continue;
    $n++;
    $cols = preg_split('/\s*[,;\t]\s*/', $linea) ?: [];
    $cc  = PersonalHelpers::limpiarDocumento((string)($cols[0] ?? ''));
    $rol = PersonalHelpers::normalizarRol((string)($cols[1] ?? ''));
    $area = trim((string)($cols[2] ?? ''));

    // Saltar encabezado
    $primera = strtolower($cc);
    if ($n === 1 && ($primera === '' || in_array(strtolower((string)($cols[0] ?? '')), ['cc','cedula','cédula','documento','numero','número'], true))) {
        $n--; continue;
    }

    if (strlen($cc) < 4) { $errores[] = "Linea {$n}: documento invalido"; continue; }
    if (!isset($rolesOk[$rol])) { $errores[] = "Linea {$n} ({$cc}): rol invalido '{$rol}'"; continue; }
    $areaId = PersonalHelpers::areaIdPorNombre($pdo, $area);
    if (in_array($rol, ['analista','coordinador','director'], true) && $areaId === null) {
        $errores[] = "Linea {$n} ({$cc}): area requerida/invalida '{$area}'"; continue;
    }
    try {
        $ins->execute([
            ':cc' => $cc, ':rol' => $rol,
            ':area' => $area !== '' ? $area : null,
            ':niv' => PersonalHelpers::nivelDeRol($rol),
        ]);
        $ok++;
    } catch (Throwable $e) {
        $errores[] = "Linea {$n} ({$cc}): no se pudo guardar";
    }
}

Response::json([
    'ok' => true,
    'autorizados' => $ok,
    'errores' => count($errores),
    'detalleErrores' => array_slice($errores, 0, 50),
]);
