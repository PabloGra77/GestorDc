<?php
declare(strict_types=1);

require_once __DIR__ . '/_helpers.php';
$jwt = Auth::requireUser();
// Solo usuarios con permiso de radicar (admin o rol con permiso explicito)
$pdoAuth = Db::pdo();
$authStmt = $pdoAuth->prepare(
    "SELECT r.nombre AS rol, r.permisos AS rol_perm, u.permisos AS user_perm
     FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.id = :id LIMIT 1"
);
$authStmt->execute([':id' => (int)($jwt['sub'] ?? 0)]);
$authU = $authStmt->fetch();
if (!$authU) Response::error('No autorizado', 401);
$esAdminRadicaciones = strtolower(trim((string)$authU['rol'])) === 'administrador';
if (!$esAdminRadicaciones) {
    $perm = function ($json) {
        $arr = json_decode((string)($json ?? ''), true) ?: [];
        $modulo = $arr['radicaciones'] ?? [];
        return is_array($modulo) && in_array('radicarDocumentos', $modulo, true);
    };
    if (!$perm($authU['rol_perm']) && !$perm($authU['user_perm'])) {
        Response::error('No tienes permiso para crear radicados', 403);
    }
}

$body = Request::body();
$pdo = Db::pdo();

$numeroManual = isset($body['numero']) ? strtoupper(trim((string)$body['numero'])) : '';
$referencia = strtoupper(trim((string)($body['referencia'] ?? '')));
if ($referencia === '') Response::error('La referencia es obligatoria', 400);

$asunto = trim((string)($body['asunto'] ?? '')) ?: null;
$numero = $numeroManual !== '' ? $numeroManual : RadicadoHelpers::generarNumero($pdo, 'General');

if ($numeroManual !== '') {
    $check = $pdo->prepare("SELECT numero FROM radicados WHERE numero = :n OR referencia = :r LIMIT 1");
    $check->execute([':n' => $numero, ':r' => $referencia]);
    $found = $check->fetch();
    if ($found) {
        if ($found['numero'] === $numero) Response::error('Ya existe un radicado con ese numero', 409);
        Response::error('Ya existe un radicado con esa referencia', 409);
    }
} else {
    $check = $pdo->prepare("SELECT id FROM radicados WHERE referencia = :r LIMIT 1");
    $check->execute([':r' => $referencia]);
    if ($check->fetch()) Response::error('Ya existe un radicado con esa referencia', 409);
}

$ins = $pdo->prepare(
    "INSERT INTO radicados (numero, referencia, asunto, estado, tipo)
     VALUES (:n, :r, :a, 'Radicado', 'General')"
);
$ins->execute([':n' => $numero, ':r' => $referencia, ':a' => $asunto]);
$id = (int)$pdo->lastInsertId();

// Envio de correo (best-effort)
try {
    $para = RadicadoHelpers::resolverCorreos($pdo, $body['para'] ?? []);
    $cc   = RadicadoHelpers::resolverCorreos($pdo, $body['cc'] ?? []);
    $adjuntos = is_array($body['adjuntos'] ?? null) ? $body['adjuntos'] : [];
    $mensaje = trim((string)($body['mensaje'] ?? ''));

    if (!empty($para)) {
        $adjuntosTexto = !empty($adjuntos)
            ? "\n\nAdjuntos registrados:\n- " . implode("\n- ", $adjuntos)
            : '';
        $text = "Gestor Documental - Notificacion de solicitud\n\n"
              . "Radicado: {$numero}\nReferencia: {$referencia}\n\n"
              . "Mensaje: " . ($mensaje !== '' ? $mensaje : '(sin mensaje adicional)')
              . $adjuntosTexto;
        Mailer::send([
            'to'      => $para,
            'cc'      => $cc,
            'subject' => "[Radicado {$numero}] " . ($asunto ?: $referencia),
            'text'    => $text,
        ]);
    }
} catch (Throwable $e) {
    error_log("Correo radicado {$numero} fallo: " . $e->getMessage());
}

$sel = $pdo->prepare("SELECT * FROM radicados WHERE id = :id");
$sel->execute([':id' => $id]);
Response::json(Shapes::radicado($sel->fetch()), 201);
