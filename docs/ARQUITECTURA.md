# Arquitectura — Payops

Documento técnico de referencia. Detalla cómo se organiza el sistema, qué responsabilidad tiene cada parte y cómo se comunican entre sí.

---

## Visión general

```
┌──────────────────────────────────────────────────────────────────┐
│                       NAVEGADOR / PWA                             │
│  React 19 + Vite + TypeScript                                     │
│  Service Worker (offline cache)                                   │
└───────────────────┬──────────────────────────────────────────────┘
                    │  HTTPS  (axios baseURL = /api/index.php)
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                  HOSTINGER · payops.ipsgoleman.com                │
│                                                                   │
│  public_html/                                                     │
│  ├── index.html + assets/ + logos          ←  Frontend estático   │
│  └── api/                                                         │
│      └── index.php  →  endpoints/*/*.php   ←  Backend PHP         │
│                                                                   │
│  MariaDB (mismo servidor)                                         │
│  └── <DB_NAME>                            │
└──────────────────────────────────────────────────────────────────┘
```

Frontend y backend están físicamente en la misma máquina; el frontend es estático y el backend es PHP puro accedido por PATH_INFO.

---

## Capa de frontend

### Router (`apps/web/src/app/router/index.tsx`)

```
/                              → redirect /login
/login                         → LoginPage
/registro                      → RegistroPage (público)
/forgot-password               → ForgotPasswordPage
/reset-password                → ResetPasswordPage
/radicacion-cuenta-cobro-ops   → OpsCuentaCobroUploadPage (público)
/instalar                      → InstallPage (PWA)
/first-password                → FirstPasswordChangePage (auth)
/dashboard                     → DashboardPage (auth + password actualizado)
```

`RequireAuth` y `RequirePasswordUpdated` son guards que redirigen al login si no hay sesión válida en `localStorage`.

### Estado y sesión

- Sesión en `localStorage` bajo la clave `payops:auth` (token + datos del usuario)
- Cliente axios en `src/services/http/api.ts` lee el token e inyecta `Authorization: Bearer <token>` automáticamente
- En 401 el cliente no fuerza redirect; cada feature maneja sus propios errores

### Features principales

| Feature | Archivos clave | Función |
|---|---|---|
| Login | `features/auth/LoginPage.tsx` | Email + password, link a registro y reset |
| Registro público | `features/auth/RegistroPage.tsx` | Solicitud de cuenta (queda pendiente de aprobación) |
| Dashboard | `features/dashboard/DashboardPage.tsx` | Hub principal: inicio, panel admin, radicaciones |
| Panel admin | `features/admin/*` | AreasPanel, TiposSolicitudPanel, ReportesPanel, BulkCreatePanel |
| Solicitudes | `features/solicitudes/*` | NuevaSolicitudPanel, MisSolicitudesPanel, BandejaPanel |
| Radicación pública | `features/radicaciones/OpsCuentaCobroUploadPage.tsx` | Formulario externo + consulta de estado |

### Componentes reutilizables

- `components/SignaturePad.tsx` — canvas + carga de imagen para firmas digitales
- `hooks/useOcrDocument.ts` — Tesseract.js para validar documentos vs. datos del formulario
- `utils/bancos.ts` — lista cerrada de bancos colombianos
- `utils/documentoLabels.ts` — mapeo entre claves internas (`eps`, `rut`) y etiquetas amigables
- `utils/numeroALetras.ts` — convierte valor numérico a texto en español

### Estilos

`styles/global.css` (un solo archivo, ~5500 líneas). Convención:
- Variables CSS en `:root` (dark) y `[data-theme="light"]`
- Clases por feature: `admin-*`, `bandeja-*`, `nueva-sol-*`, `payops-*`, `ops-*`
- Regla de oro: en dark nunca texto negro, en light nunca texto blanco; botones dorados → texto negro siempre

---

## Capa de backend

### Router (`api/index.php`)

Tabla de rutas declarativa. Cada entrada: `[método, regex, handler]`. El handler es la ruta relativa (sin extensión) al archivo de endpoint.

```php
$routes = [
    ['POST', '#^/auth/login$#', 'auth/login'],
    ['GET',  '#^/solicitudes/bandeja$#', 'solicitudes/bandeja'],
    // ...
];
```

El `index.php` resuelve PATH_INFO (`/auth/login`), busca el match, captura grupos nombrados como `params` y hace `require` del archivo.

### Bootstrap (`api/bootstrap.php`)

Se ejecuta en cada request antes del router. Responsabilidades:
- Cargar `.env`
- Configurar CORS según `WEB_BASE_URL`
- Emitir headers de seguridad (CSP, HSTS, X-Frame-Options, etc.)
- Definir handlers de error que devuelven JSON limpio (sin stack traces en producción)
- Autoload de las clases de `lib/`

### Librería compartida (`api/lib/`)

| Clase | Responsabilidad |
|---|---|
| `Db` | PDO singleton con `EMULATE_PREPARES=false` |
| `Auth` | `requireUser()` y `requireAdmin()` — extraen JWT del header |
| `Jwt` | Firma y verifica HS256, valida `alg` y `exp` |
| `Request` | Parser JSON con tope de 2 MB; lectura de query params |
| `Response` | `json()`, `error()` — siempre con header `Content-Type` correcto |
| `Throttle` | Rate limiting por IP usando archivos en `/tmp` |
| `Mailer` | SMTP plano (sin PHPMailer); soporta texto + HTML |
| `Permissions` | Normaliza el JSON de permisos por módulo |
| `Shapes` | Convierte filas de BD al shape de respuesta esperado por el cliente |
| `Config` | Lee `.env` con tipos y valores por defecto |
| `DomainPolicy` | Valida que un correo pertenezca a un dominio permitido |

### Endpoints

Cada endpoint es un archivo PHP independiente. No hay autoload de controllers; el router hace `require` directo.

Convención típica de un endpoint:

```php
<?php
declare(strict_types=1);

Auth::requireUser();                  // o requireAdmin()
$body = Request::body();
$pdo  = Db::pdo();

// validación

$stmt = $pdo->prepare("SELECT ...");
$stmt->execute([':id' => $id]);

Response::json([...]);
```

Para endpoints públicos se omite `Auth::require*` y se aplica `Throttle::hit(...)`.

---

## Modelo de datos

### Entidades centrales

**`usuarios`** — Cuentas del sistema
```
id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
nombre_completo, correo, password_hash, must_change_password,
password_changed_at, activo, rol_id, area_id, nivel_aprobacion,
permisos JSON, creado_en
```

**`roles`** — Perfiles con permisos
```
id, nombre, descripcion, activo,
permisos JSON   { modulo: ["accion1", "accion2"] }
```

**`areas`** — Áreas institucionales
```
id, nombre, slug, descripcion, activo, orden
```

**`tipos_solicitud`** — Plantillas de solicitudes
```
id, area_id, nombre, descripcion, slug, activo, orden,
campos_plantilla JSON,    [{key, label, type, required, group, ocr_target}]
flujo_aprobacion JSON     [{rol, label, orden}]
```

`campos_plantilla` define los campos del formulario dinámico. `flujo_aprobacion` define los pasos de validación por nivel.

**`solicitudes`** — Instancias de solicitud
```
id, numero_radicado, tipo_solicitud_id, area_id,
solicitante_usuario_id, solicitante_nombre, solicitante_correo, solicitante_documento,
datos_formulario JSON, documentos JSON, firmas JSON, alertas JSON,
estado, paso_actual, paso_orden,
creado_en, actualizado_en, aprobado_en
```

Estados: `borrador`, `en_validacion`, `aprobado`, `rechazado`, `devuelto`.

**`solicitud_movimientos`** — Trazabilidad
```
id, solicitud_id, accion, paso, estado_resultado,
usuario_nombre, usuario_rol, comentario, visibilidad, creado_en
```

### Flujo de aprobación

1. Solicitud creada → `estado='en_validacion'`, `paso_actual` = primer paso del flujo
2. Validador del paso actual ejecuta `validar`, `devolver` o `rechazar`
3. `validar` avanza al siguiente paso o cierra como `aprobado`
4. `devolver` regresa al solicitante (`estado='devuelto'`)
5. `rechazar` cierra como `rechazado`
6. Cada acción inserta una fila en `solicitud_movimientos`

Guard anti-race: `UPDATE ... WHERE estado='en_validacion' AND paso_actual=:pa_prev` con verificación de `rowCount()`.

---

## Validación de documentos con IA

`hooks/useOcrDocument.ts` carga Tesseract.js en el cliente. Cuando el usuario adjunta un documento con `ocr_target` definido:

1. Tesseract extrae el texto del archivo (imagen)
2. `validarTipoDocumento` busca palabras clave del tipo esperado (EPS, RUT, etc.)
3. `validarOcrContraDato` cruza cédula, nombre, banco y número de cuenta del formulario contra el texto
4. Las alertas se guardan en `documentos[campo].ocrAlertas` y se persisten en la BD
5. Si la confianza está bajo 50% se reporta como alerta crítica

El backend no procesa OCR; confía en el cliente para esta validación. Las alertas quedan visibles al validador en el panel de bandeja.

---

## Seguridad

### Autenticación

- JWT HS256 con secreto de 64 bytes hex en `.env`
- TTL configurable (`JWT_TTL_MINUTES`, default 480)
- `alg` validado explícitamente al verificar (anti-confusion)
- `hash_equals` para comparar firmas (timing constante)
- `password_verify` siempre se ejecuta en login (incluso con usuario inexistente, contra hash dummy)

### Autorización

- `Auth::requireAdmin()` exige rol `Administrador` en el JWT
- Endpoints sensibles tienen el guard inmediatamente después del `<?php`
- `find_one.php` cruza usuario + área + nivel_aprobacion + paso_actual para decidir visibilidad
- Las firmas solo son visibles al solicitante y al administrador

### Throttling

Por IP real (`REMOTE_ADDR`, no `X-Forwarded-For`):
- Login: 10/min
- Reset password: 5/min · 20/hora
- Registro público: 3/min · 10/hora
- Solicitud pública: 5/min · 25/hora
- Documentos OPS: 5/min · 30/hora

### Input

- Body máximo: 2 MB
- Firmas base64: ≤ 300 KB cada una, formato `data:image/(png|jpe?g)` obligatorio
- `datos` y `documentos` se filtran contra `campos_plantilla` antes de insertar (whitelist de keys)
- Nombres de documento: regex `[\w.\- ]{1,120}`
- Todas las queries usan prepared statements; no hay concatenación dinámica de SQL

### Headers

Bootstrap emite:
- `Strict-Transport-Security: max-age=31536000`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: same-origin`
- `Content-Security-Policy: default-src 'self'; ...` (estricto, permite Tesseract CDN y blob workers)

### Secretos

- `.env` con permisos `600`, ruta `/home/<USER>/websites/<SITE>/public_html/api/.env`
- `.htaccess` bloquea acceso público a `.env`, `lib/`, `endpoints/`, `*.sql`, `*.md`
- Las credenciales nunca van al repositorio Git

---

## PWA

`apps/web/public/sw.js` cachea el shell de la app (HTML, CSS, JS principal). Permite que el dashboard cargue sin red, aunque las llamadas API requieren conexión.

`manifest.webmanifest` define la app instalable con icono dorado y modo `standalone`. El icono está en `public_html/icon-app.png`.

---

## Convenciones de código

### PHP

- `declare(strict_types=1);` en todos los archivos
- Helpers estáticos en `lib/` con namespace global (no hay namespaces)
- Constantes en SCREAMING_SNAKE
- Sin frameworks ni Composer; toda dependencia es nativa de PHP 8

### TypeScript

- React funcional con hooks
- Tipado explícito en respuestas de API
- No hay state management externo (Redux, Zustand); se usa `useState` y context donde aplica
- Componentes feature-first: `features/<modulo>/<Componente>.tsx`

### Commits

```
feat(modulo):    nueva funcionalidad
fix(modulo):     corrección
sec:             cambios de seguridad
docs:            documentación
style:           UI / estilos
chore:           mantenimiento
```
