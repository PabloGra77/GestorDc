<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('gestionarConfiguracion');

$body = Request::body();
$empresa = [
    'identificacion'      => (string) ($body['identificacion'] ?? ''),
    'tipo_identificacion' => (string) ($body['tipoIdentificacion'] ?? ''),
    'cuenta_origen'       => (string) ($body['cuentaOrigen'] ?? ''),
    'tipo_cuenta'         => (string) ($body['tipoCuenta'] ?? ''),
];

$validador = new PagosValidador();
$hallazgos = $validador->validarEmpresa($empresa);
if (!PagosValidador::esValido($hallazgos)) {
    Response::error('Datos de la empresa inválidos', 422, ['hallazgos' => $hallazgos]);
}

$nombre = PagosTexto::nombre((string) ($body['nombre'] ?? ''), 160);
if ($nombre === '') {
    Response::error('El nombre de la empresa es obligatorio', 400);
}

$existe = PagosDb::valor('SELECT id FROM pagos_empresas WHERE cuenta_origen = ?', [$empresa['cuenta_origen']]);
if ($existe) {
    Response::error('Ya existe una empresa con esa cuenta de origen', 409);
}

$id = PagosDb::insertar(
    'INSERT INTO pagos_empresas (nombre, identificacion, tipo_identificacion, cuenta_origen, tipo_cuenta, activa)
     VALUES (?, ?, ?, ?, ?, 1)',
    [$nombre, $empresa['identificacion'], $empresa['tipo_identificacion'], $empresa['cuenta_origen'], $empresa['tipo_cuenta']]
);
PagosAudit::registrar('empresa.creada', 'empresa', (string) $id, ['nombre' => $nombre]);

Response::json(['id' => $id], 201);
