<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('gestionarConfiguracion');

$id = (int) ($params['id'] ?? 0);
$empresa = PagosDb::uno('SELECT * FROM pagos_empresas WHERE id = ?', [$id]);
if (!$empresa) {
    Response::error('La empresa no existe', 404);
}

$body = Request::body();
$nuevo = [
    'nombre'              => PagosTexto::nombre((string) ($body['nombre'] ?? $empresa['nombre']), 160),
    'identificacion'      => (string) ($body['identificacion'] ?? $empresa['identificacion']),
    'tipo_identificacion' => (string) ($body['tipoIdentificacion'] ?? $empresa['tipo_identificacion']),
    'cuenta_origen'       => (string) ($body['cuentaOrigen'] ?? $empresa['cuenta_origen']),
    'tipo_cuenta'         => (string) ($body['tipoCuenta'] ?? $empresa['tipo_cuenta']),
    'activa'              => isset($body['activa']) ? (int) (bool) $body['activa'] : (int) $empresa['activa'],
];

$validador = new PagosValidador();
$hallazgos = $validador->validarEmpresa($nuevo);
if (!PagosValidador::esValido($hallazgos)) {
    Response::error('Datos de la empresa inválidos', 422, ['hallazgos' => $hallazgos]);
}

PagosDb::ejecutar(
    'UPDATE pagos_empresas SET nombre = ?, identificacion = ?, tipo_identificacion = ?,
            cuenta_origen = ?, tipo_cuenta = ?, activa = ? WHERE id = ?',
    [$nuevo['nombre'], $nuevo['identificacion'], $nuevo['tipo_identificacion'],
     $nuevo['cuenta_origen'], $nuevo['tipo_cuenta'], $nuevo['activa'], $id]
);
PagosAudit::registrar('empresa.actualizada', 'empresa', (string) $id);

Response::json(['ok' => true]);
