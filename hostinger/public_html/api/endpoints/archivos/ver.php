<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

$jwt = Auth::requireUser();

$id = Request::query('id');
if (!$id) {
    Response::error('ID de archivo requerido', 400);
}

// Validar formato estricto del ID (solo hex + extensión permitida)
if (!preg_match('/^[a-f0-9]{32}\.(pdf|jpg|png|webp)$/i', $id)) {
    Response::error('ID de archivo invalido', 400);
}

// Sanitizar para prevenir Path Traversal
$id = basename($id);

// ── PHP-05: Verificar que el usuario tiene derecho a ver este archivo ──
{
    $uid  = (int)($jwt['sub'] ?? 0);
    $uuid = pathinfo($id, PATHINFO_FILENAME); // hex sin extensión

    $pdo = Db::pdo();

    // Cargar rol y nivel del usuario
    $uStmt = $pdo->prepare(
        "SELECT u.area_id, u.nivel_aprobacion, r.nombre AS rol
         FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id WHERE u.id = :id LIMIT 1"
    );
    $uStmt->execute([':id' => $uid]);
    $uRow     = $uStmt->fetch();
    $esAdmin  = strtolower(trim($uRow['rol'] ?? '')) === 'administrador';

    if (!$esAdmin) {
        $pat       = '%' . $uuid . '%';
        $userArea  = (int)($uRow['area_id'] ?? 0);
        $userNivel = (string)($uRow['nivel_aprobacion'] ?? '');
        $ok        = false;

        // ¿Es el solicitante de alguna solicitud que contiene este archivo?
        $s = $pdo->prepare(
            "SELECT 1 FROM solicitudes
             WHERE (datos_formulario LIKE :p OR documentos LIKE :p2)
               AND solicitante_usuario_id = :u LIMIT 1"
        );
        $s->execute([':p' => $pat, ':p2' => $pat, ':u' => $uid]);
        if ($s->fetch()) $ok = true;

        // ¿Ha actuado como validador en alguna solicitud que contiene este archivo?
        if (!$ok) {
            $s = $pdo->prepare(
                "SELECT 1 FROM solicitudes s
                 INNER JOIN solicitud_movimientos m ON m.solicitud_id = s.id
                 WHERE (s.datos_formulario LIKE :p OR s.documentos LIKE :p2)
                   AND m.usuario_id = :u LIMIT 1"
            );
            $s->execute([':p' => $pat, ':p2' => $pat, ':u' => $uid]);
            if ($s->fetch()) $ok = true;
        }

        // ¿Es validador en turno de alguna solicitud que contiene este archivo?
        if (!$ok && $userNivel !== '') {
            $s = $pdo->prepare(
                "SELECT 1 FROM solicitudes
                 WHERE (datos_formulario LIKE :p OR documentos LIKE :p2)
                   AND paso_actual = :niv
                   AND (:cont = 'contabilidad' OR area_id = :area) LIMIT 1"
            );
            $s->execute([':p' => $pat, ':p2' => $pat, ':niv' => $userNivel, ':cont' => $userNivel, ':area' => $userArea]);
            if ($s->fetch()) $ok = true;
        }

        if (!$ok) {
            Response::error('No tienes permiso para ver este archivo', 403);
        }
    }
}
$path = __DIR__ . '/../../uploads/' . $id;

// Verificar que el path resuelto está DENTRO del directorio uploads
$realPath = realpath($path);
$uploadsDir = realpath(__DIR__ . '/../../uploads');

if (!$realPath || !$uploadsDir || strpos($realPath, $uploadsDir) !== 0) {
    Response::error('Archivo no encontrado', 404);
}

if (!is_file($realPath) || !is_readable($realPath)) {
    Response::error('Archivo no disponible', 404);
}

$mimes = [
    'pdf' => 'application/pdf',
    'jpg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
];

$ext = strtolower((string)pathinfo($id, PATHINFO_EXTENSION));
$mimeType = $mimes[$ext] ?? 'application/octet-stream';

// Verificar que el MIME real coincide con la extensión
$finfo = new finfo(FILEINFO_MIME_TYPE);
$realMime = $finfo->file($realPath);
if ($realMime !== $mimeType) {
    Logger::warning('MIME type mismatch en archivo', [
        'file_id' => $id,
        'expected' => $mimeType,
        'actual' => $realMime,
        'user_id' => $jwt['sub'] ?? null
    ]);
    Response::error('Tipo de archivo invalido', 415);
}

// Headers de seguridad
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . filesize($realPath));
header('Content-Disposition: inline; filename="adjunto.' . $ext . '"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=300');
header('X-Frame-Options: SAMEORIGIN');

readfile($realPath);
exit;