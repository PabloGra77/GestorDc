# Payops — Goleman IPS

Plataforma documental y de radicación de cuentas de cobro para Goleman IPS.

**Producción:** https://payops.ipsgoleman.com

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 · Vite 6 · TypeScript |
| Backend | PHP 8 puro (sin Composer ni framework) |
| Base de datos | MariaDB 10 (Hostinger) |
| Autenticación | JWT HS256 · bcrypt cost 12 |
| Email | SMTP Gmail (notigoleman) |
| Hosting | Hostinger shared (LiteSpeed) |

---

## Árbol del repositorio

```
gestion-documental/
├── apps/
│   └── web/                            Frontend React (fuente)
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout/             Header, Sidebar, ThemeToggle, RequestsChatDock
│       │   │   └── router/             rutas de la SPA
│       │   ├── features/
│       │   │   ├── auth/               Login, Registro, ForgotPassword, ResetPassword, FirstPasswordChange
│       │   │   ├── dashboard/          DashboardPage (panel admin + bandeja + mis solicitudes)
│       │   │   ├── admin/              AreasPanel, TiposSolicitudPanel, ReportesPanel, BulkCreatePanel
│       │   │   ├── solicitudes/        NuevaSolicitudPanel, MisSolicitudesPanel, BandejaPanel, generarPdfFormato
│       │   │   ├── radicaciones/       RadicacionesModule, OpsCuentaCobroUploadPage (formulario público)
│       │   │   └── install/            página PWA install
│       │   ├── components/             SignaturePad
│       │   ├── hooks/                  useOcrDocument, usePayopsLogo
│       │   ├── utils/                  bancos, documentoLabels, numeroALetras
│       │   ├── services/http/          cliente axios con JWT
│       │   ├── types/                  role, usuario, radicado
│       │   └── styles/global.css
│       ├── public/                     estáticos servidos en raíz (logos, sw.js, manifest)
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── hostinger/                          Espejo de lo que vive en el servidor
│   ├── public_html/
│   │   ├── api/                        Backend PHP
│   │   │   ├── index.php               Router (tabla de rutas → endpoint)
│   │   │   ├── bootstrap.php           Autoload, CORS, headers de seguridad
│   │   │   ├── .env.example
│   │   │   ├── .htaccess
│   │   │   ├── lib/                    Auth, Db, Jwt, Mailer, Permissions, Request,
│   │   │   │                           Response, Shapes, Throttle, Config, DomainPolicy
│   │   │   └── endpoints/
│   │   │       ├── auth/               login, password_reset_request, password_reset_confirm,
│   │   │       │                       change_initial_password
│   │   │       ├── usuarios/           create, find_all, find_one, update,
│   │   │       │                       bulk_create, reporte, registro_publico
│   │   │       ├── roles/              create, find_all, find_one, update, publica_find_all
│   │   │       ├── areas/              create, find_all, update, publica_find_all
│   │   │       ├── tipos/              create, find_all, update, publica_find_all
│   │   │       ├── solicitudes/        create, find_all, find_one, bandeja,
│   │   │       │                       validar, devolver, rechazar,
│   │   │       │                       publica_create, estado_publico, _flujo
│   │   │       ├── radicados/          create, verify, ops_solicitud, ops_documentos,
│   │   │       │                       ops_verificar, _helpers
│   │   │       └── health.php
│   │   ├── .htaccess                   HTTPS forzado, headers, SPA fallback
│   │   ├── index.html                  SPA entry (compilado)
│   │   ├── assets/                     JS/CSS minificados (Vite build)
│   │   ├── logo-payops.png             logo modo oscuro
│   │   ├── logo-payops-dark.png        logo modo claro
│   │   ├── icon-app.png                icono PWA
│   │   ├── sw.js                       service worker
│   │   └── manifest.webmanifest
│   ├── sql/
│   │   ├── schema.sql                  esquema base
│   │   ├── 001_*.sql ... 003_*.sql     migraciones aplicadas
│   │   └── seed-admin.php              crear/resetear admin vía SSH
│   └── docs/
│       └── DESPLIEGUE.md
│
├── docs/
│   ├── base-datos/migraciones.md
│   ├── despliegue/                     checklists pre/post deploy
│   └── seguridad/protocolo-vps-preproduccion.md
│
├── README.md
├── .gitignore
└── NOTAS_PRIVADAS.md                   (gitignored — credenciales locales)
```

---

## Cómo funciona en producción

### Routing del backend

Hostinger no aplica `.htaccess` rewrites de forma confiable, por lo que el frontend pega contra `/api/index.php/<ruta>` (PATH_INFO):

```
POST  /api/index.php/auth/login
GET   /api/index.php/solicitudes/bandeja
POST  /api/index.php/publico/solicitudes
GET   /api/index.php/usuarios/reporte?tipo=nuevos
```

El cliente axios tiene `baseURL = '/api/index.php'`. `index.php` resuelve PATH_INFO contra la tabla `$routes` y delega al archivo de endpoint correspondiente.

### Flujo de petición

```
Browser → /api/index.php/auth/login (POST)
        → index.php parsea PATH_INFO
        → matchea regex → endpoints/auth/login.php
        → endpoint usa lib/Auth, lib/Db, lib/Response, lib/Jwt
        → JSON al cliente
```

### Endpoints públicos (sin auth)

| Ruta | Propósito |
|---|---|
| `GET /publico/areas` | Áreas activas para formulario público |
| `GET /publico/tipos` | Tipos de solicitud activos |
| `GET /publico/roles` | Roles disponibles para registro |
| `POST /publico/solicitudes` | Crear solicitud externa |
| `GET /publico/solicitudes/estado` | Consultar estado por radicado + documento |
| `POST /publico/usuarios/registro` | Auto-registro (pendiente de aprobación) |

---

## Base de datos

| Tabla | Contenido |
|---|---|
| `usuarios` | Cuentas, hash, rol, área, permisos JSON, firmas |
| `roles` | Roles del sistema con permisos JSON por módulo |
| `areas` | Áreas institucionales (PAD, PPL, etc.) |
| `tipos_solicitud` | Plantillas con `campos_plantilla` y `flujo_aprobacion` (JSON) |
| `solicitudes` | Instancias con `datos_formulario`, `documentos`, `firmas`, `alertas` (JSON) |
| `solicitud_movimientos` | Trazabilidad de cambios por solicitud |
| `radicados` | Flujo legado OPS de cuentas de cobro |
| `password_reset_tokens` | Tokens single-use con TTL 30 min |

Migraciones SQL en `hostinger/sql/`. El esquema base está en `schema.sql`; los archivos `00X_*.sql` son alteraciones posteriores aplicadas en producción.

---

## Desarrollo

```bash
cd apps/web
npm install
npm run dev          # http://localhost:3002
npm run build        # genera apps/web/dist/
```

Variable `apps/web/.env`:
```
VITE_API_BASE_URL=/api/index.php
```

En desarrollo el front asume que hay un PHP local sirviendo `/api` o un proxy hacia Hostinger.

---

## Despliegue

Ver [hostinger/docs/DESPLIEGUE.md](hostinger/docs/DESPLIEGUE.md) para procedimiento completo.

**Resumen rápido (frontend):**

```bash
cd apps/web && npm run build
# Subir apps/web/dist/index.html + dist/assets/*  al servidor:
# /home/<USER>/websites/<SITE>/public_html/
# Eliminar bundles viejos del servidor para no acumular.
```

**Backend (PHP):**

```bash
# Solo subir los archivos modificados a:
# /home/<USER>/websites/<SITE>/public_html/api/
```

**Conexión SSH:**
- Host: `<SSH_HOST>` puerto `65002`
- Usuario: `<SSH_USER>`
- Path web: `/home/<USER>/websites/<SITE>/public_html/`

---

## Reglas de negocio

- Login y auto-registro: solo correos `@ipsgoleman.com.co`
- Auto-registro queda `activo=0` hasta aprobación de un administrador
- Auto-registro no permite rol Administrador
- Las solicitudes pasan por un flujo de aprobación por niveles (analista → coordinador → contabilidad por defecto)
- Cada validador firma con su propio dispositivo (canvas o imagen)
- Solo el solicitante, el administrador o el validador en turno pueden ver el detalle de una solicitud
- Las firmas solo son visibles al solicitante y al administrador

---

## Seguridad

- JWT HS256 con `alg` validado explícitamente (anti-confusion)
- `password_verify` siempre se ejecuta en login (timing constante anti-enumeración)
- Bcrypt cost 12
- Rate limiting por IP en endpoints sensibles:
  - login: 10/min
  - reset password: 5/min
  - registro público: 3/min · 10/hora
  - solicitud pública: 5/min · 25/hora
- Tamaño máximo de body 2 MB; firmas base64 individuales ≤ 300 KB
- Filtrado estricto de `datos` y `documentos` contra `campos_plantilla` antes de insertar
- CSP, HSTS, X-Frame-Options DENY
- `.env` con permisos 600

---

## Comandos útiles

**Crear/resetear administrador (SSH):**
```bash
GD_ENV_PATH=/home/<USER>/websites/<SITE>/public_html/api/.env \
  php /home/<USER>/private_seed/seed-admin.php "correo@ipsgoleman.com.co" "Password"
```

**Aplicar migración SQL:**
```bash
mysql -h localhost -u "<DB_USER>" -p \
  <DB_NAME> < hostinger/sql/00X_*.sql
```

---

## Convenciones

```
feat(modulo):    nueva funcionalidad
fix(modulo):     corrección
docs:            documentación
style:           UI / estilos
chore:           mantenimiento
sec:             cambios de seguridad
```
