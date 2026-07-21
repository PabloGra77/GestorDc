<?php
declare(strict_types=1);

define('PAYOPS_BOOTSTRAP', true);
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
    ['POST',   '#^/auth/logout$#',                               'auth/logout'],
    ['POST',   '#^/auth/password-reset/request$#',               'auth/password_reset_request'],
    ['POST',   '#^/auth/password-reset/confirm$#',               'auth/password_reset_confirm'],
    ['POST',   '#^/auth/change-initial-password$#',              'auth/change_initial_password'],

    // Usuarios
    ['POST',   '#^/usuarios$#',                                  'usuarios/create'],
    ['POST',   '#^/usuarios/bulk$#',                             'usuarios/bulk_create'],
    ['GET',    '#^/usuarios/reporte$#',                          'usuarios/reporte'],
    ['GET',    '#^/usuarios/nombres$#',                          'usuarios/nombres'],
    ['GET',    '#^/usuarios/perfil$#',                          'usuarios/perfil'],
    ['PATCH',  '#^/usuarios/perfil$#',                          'usuarios/perfil'],
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
    ['POST',   '#^/tipos/ensure$#',                              'tipos/ensure'],
    ['POST',   '#^/tipos$#',                                     'tipos/create'],
    ['GET',    '#^/tipos$#',                                     'tipos/find_all'],
    ['PATCH',  '#^/tipos/(?P<id>\d+)$#',                         'tipos/update'],
    ['DELETE', '#^/tipos/(?P<id>\d+)$#',                         'tipos/delete'],

    // Unico endpoint publico restante: auto-registro pre-autorizado (whitelist)
    ['POST',   '#^/publico/usuarios/registro$#',                 'usuarios/registro_publico'],

    // Personal autorizado (whitelist) - solo admin
    ['POST',   '#^/personal/bulk$#',                             'personal/bulk'],
    ['POST',   '#^/personal$#',                                  'personal/create'],
    ['GET',    '#^/personal$#',                                  'personal/find_all'],
    ['DELETE', '#^/personal/(?P<id>\d+)$#',                      'personal/delete'],

    // Solicitudes (instancias)
    ['POST',   '#^/solicitudes$#',                               'solicitudes/create'],
    ['GET',    '#^/solicitudes$#',                               'solicitudes/find_all'],
    ['GET',    '#^/solicitudes/reporte$#',                       'solicitudes/reporte'],
    ['GET',    '#^/solicitudes/bandeja$#',                       'solicitudes/bandeja'],
    ['GET',    '#^/solicitudes/(?P<id>\d+)$#',                   'solicitudes/find_one'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/validar$#',           'solicitudes/validar'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/devolver$#',          'solicitudes/devolver'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/reenviar$#',          'solicitudes/reenviar'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/rechazar$#',          'solicitudes/rechazar'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/remitir$#',           'solicitudes/remitir'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/legalizar$#',              'solicitudes/legalizar'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/legalizacion/confirmar$#', 'solicitudes/legalizacion_confirmar'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/recordar-legalizar$#',     'solicitudes/recordar_legalizar'],
    ['POST',   '#^/solicitudes/(?P<id>\d+)/autorizar-legalizacion$#', 'solicitudes/autorizar_legalizacion'],
    ['DELETE', '#^/solicitudes/(?P<id>\d+)$#',                        'solicitudes/delete'],

    // Viajes (búsqueda de tiquetes con Amadeus + precios estimados Colombia)
    ['GET',    '#^/viajes/buscar$#',                             'viajes/buscar'],

    // Adjuntos (subir / ver con sesión)
    ['POST',   '#^/archivos$#',                                  'archivos/subir'],
    ['GET',    '#^/archivos/ver$#',                              'archivos/ver'],

    // Verificación forense de documentos
    ['POST',   '#^/forense$#',                                   'forense/analizar'],

    // Configuracion (solo admin)
    ['GET',    '#^/config/smtp$#',                               'config/smtp_get'],
    ['PUT',    '#^/config/smtp$#',                               'config/smtp_update'],
    ['POST',   '#^/config/smtp/test$#',                          'config/smtp_test'],
    ['GET',    '#^/config/legalizacion$#',                       'config/legalizacion_get'],
    ['PUT',    '#^/config/legalizacion$#',                       'config/legalizacion_update'],

    // Historial de auditoría (solo admin)
    ['GET',    '#^/historial$#',                                    'historial/find_all'],

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
