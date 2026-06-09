<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Soportar 3 estilos de URL:
//   1) /api/auth/login        (via .htaccess rewrite)
//   2) /api/index.php/auth/login   (PATH_INFO)
//   3) /api/?_route=auth/login     (query param fallback)
$pathInfo = $_SERVER['PATH_INFO'] ?? '';
$routeQs  = isset($_GET['_route']) ? (string)$_GET['_route'] : '';
$uri      = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($pathInfo !== '') {
    $path = $pathInfo;
} elseif ($routeQs !== '') {
    $path = '/' . ltrim($routeQs, '/');
} else {
    // Quitar prefijo /api y opcionalmente /index.php
    $path = preg_replace('#^/api(/index\.php)?#', '', $uri) ?: '/';
}
$path = '/' . trim($path, '/');

// Tabla de rutas: [METHOD, regex, handler_file]
$routes = [
    ['GET',    '#^/$#',                                          'health'],
    ['GET',    '#^/health$#',                                    'health'],

    // Auth
    ['POST',   '#^/auth/login$#',                                'auth/login'],
    ['POST',   '#^/auth/password-reset/request$#',               'auth/password_reset_request'],
    ['POST',   '#^/auth/password-reset/confirm$#',               'auth/password_reset_confirm'],
    ['POST',   '#^/auth/change-initial-password$#',              'auth/change_initial_password'],

    // Usuarios
    ['POST',   '#^/usuarios$#',                                  'usuarios/create'],
    ['POST',   '#^/usuarios/bulk$#',                             'usuarios/bulk_create'],
    ['GET',    '#^/usuarios/reporte$#',                          'usuarios/reporte'],
    ['GET',    '#^/usuarios/nombres$#',                          'usuarios/nombres'],
    ['GET',    '#^/usuarios$#',                                  'usuarios/find_all'],
    ['GET',    '#^/usuarios/(?P<id>\d+)$#',                      'usuarios/find_one'],
    ['PATCH',  '#^/usuarios/(?P<id>\d+)$#',                      'usuarios/update'],
    ['DELETE', '#^/usuarios/(?P<id>\d+)$#',                      'usuarios/delete'],

    // Roles
    ['POST',   '#^/roles$#',                                     'roles/create'],
    ['GET',    '#^/roles$#',                                     'roles/find_all'],
    ['GET',    '#^/roles/(?P<id>\d+)$#',                         'roles/find_one'],
    ['PATCH',  '#^/roles/(?P<id>\d+)$#',                         'roles/update'],
    ['DELETE', '#^/roles/(?P<id>\d+)$#',                         'roles/delete'],

    // Areas
    ['POST',   '#^/areas$#',                                     'areas/create'],
    ['GET',    '#^/areas$#',                                     'areas/find_all'],
    ['PATCH',  '#^/areas/(?P<id>\d+)$#',                         'areas/update'],

    // Tipos de solicitud
    ['POST',   '#^/tipos$#',                                     'tipos/create'],
    ['GET',    '#^/tipos$#',                                     'tipos/find_all'],
    ['PATCH',  '#^/tipos/(?P<id>\d+)$#',                         'tipos/update'],
    ['DELETE', '#^/tipos/(?P<id>\d+)$#',                         'tipos/delete'],

    // Endpoints publicos (sin auth) para formulario externo
    ['GET',    '#^/publico/areas$#',                             'areas/publica_find_all'],
    ['GET',    '#^/publico/roles$#',                             'roles/publica_find_all'],
    ['GET',    '#^/publico/tipos$#',                             'tipos/publica_find_all'],
    ['POST',   '#^/publico/solicitudes$#',                       'solicitudes/publica_create'],
    ['GET',    '#^/publico/solicitudes/estado$#',                'solicitudes/estado_publico'],
    ['POST',   '#^/publico/usuarios/registro$#',                 'usuarios/registro_publico'],

    // Solicitudes (instancias)
    ['POST',   '#^/solicitudes$#',                               'solicitudes/create'],
    ['GET',    '#^/solicitudes$#',                               'solicitudes/find_all'],
    ['GET',    '#^/solicitudes/reporte$#',                       'solicitudes/reporte'],
    ['GET',    '#^/solicitudes/bandeja$#',                       'solicitudes/bandeja'],
    ['GET',    '#^/solicitudes/(?P<id>\d+)$#',                   'solicitudes/find_one'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/validar$#',           'solicitudes/validar'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/devolver$#',          'solicitudes/devolver'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/rechazar$#',          'solicitudes/rechazar'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/remitir$#',           'solicitudes/remitir'],
    ['DELETE', '#^/solicitudes/(?P<id>\d+)$#',                    'solicitudes/delete'],

    // Adjuntos (subir / ver con sesión)
    ['POST',   '#^/archivos$#',                                  'archivos/subir'],
    ['GET',    '#^/archivos/ver$#',                              'archivos/ver'],

    // Verificación forense de documentos
    ['POST',   '#^/forense$#',                                   'forense/analizar'],

    // Configuracion (solo admin)
    ['GET',    '#^/config/smtp$#',                               'config/smtp_get'],
    ['PUT',    '#^/config/smtp$#',                               'config/smtp_update'],
    ['POST',   '#^/config/smtp/test$#',                          'config/smtp_test'],

    // Radicados
    ['POST',   '#^/radicados$#',                                 'radicados/create'],
    ['POST',   '#^/radicados/cuentas-cobro-ops/solicitud$#',     'radicados/ops_solicitud'],
    ['GET',    '#^/radicados/cuentas-cobro-ops/verificar$#',     'radicados/ops_verificar'],
    ['POST',   '#^/radicados/cuentas-cobro-ops/documentos$#',    'radicados/ops_documentos'],
    ['GET',    '#^/radicados/verificar$#',                       'radicados/verify'],
];

foreach ($routes as [$m, $regex, $handler]) {
    if ($m !== $method) continue;
    if (preg_match($regex, $path, $matches)) {
        $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
        require __DIR__ . '/endpoints/' . $handler . '.php';
        exit;
    }
}

Response::error('Ruta no encontrada', 404);
