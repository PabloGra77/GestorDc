# GestorDoc CO — Plataforma de gestión documental

Sistema institucional de gestión documental: radicación, expedientes, préstamos, transferencias y gestión de usuarios/roles.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | NestJS 11 · TypeORM 0.3.20 · PostgreSQL 17 |
| Frontend Web | React 19 · React Router 7 · Vite 6 · Axios 1.8 |
| App Móvil | React Native 0.76 · Expo SDK 52 · React Navigation 7 |
| Infraestructura | Docker Compose · Nginx (proxy inverso) |

## Servicios y puertos

| Servicio | Puerto | Alcance |
|---|---|---|
| API NestJS (`gestordoc-api`) | `127.0.0.1:3001` | Solo localhost |
| Frontend web (`gestordoc-web`) | `0.0.0.0:3002` | Público |
| PostgreSQL (`gestordoc-postgres`) | `127.0.0.1:5432` | Solo localhost |

## Estructura del proyecto

```
gestion-documental/
├── docker-compose.yml
├── .gitignore
├── README.md
│
├── apps/
│   ├── mobile/                              # React Native 0.76 + Expo SDK 52
│   │   ├── App.tsx                          # Punto de entrada
│   │   ├── app.json                         # Config Expo (scheme: gestordoc)
│   │   ├── babel.config.js
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── config/
│   │       │   └── api.config.ts            # API_BASE_URL, API_TIMEOUT_MS
│   │       ├── navigation/
│   │       │   └── index.tsx                # RootNavigator — 6 rutas
│   │       ├── screens/
│   │       │   ├── auth/
│   │       │   │   ├── LoginScreen.tsx
│   │       │   │   ├── ForgotPasswordScreen.tsx
│   │       │   │   ├── ResetPasswordScreen.tsx
│   │       │   │   └── FirstPasswordScreen.tsx
│   │       │   ├── dashboard/
│   │       │   │   └── DashboardScreen.tsx  # Tabs: Inicio / Radicaciones / Admin
│   │       │   └── radicaciones/
│   │       │       └── OpsCuentaCobroScreen.tsx  # Wizard 4 pasos ⚠️ bugs conocidos
│   │       ├── services/
│   │       │   ├── api.ts                   # Axios + interceptor JWT (AsyncStorage)
│   │       │   ├── auth.service.ts          # login, reset, changePassword, sesión
│   │       │   └── radicaciones.service.ts  # OPS: solicitud, verificar, documentos
│   │       ├── theme/
│   │       │   └── index.ts                 # Colors, Radius, Spacing, Typography
│   │       └── types/
│   │           ├── radicado.ts
│   │           ├── role.ts
│   │           └── usuario.ts               # AuthSession { token, usuario }
│   │
│   └── web/                                 # React 19 + Vite 6
│       ├── Dockerfile
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── App.tsx
│           ├── main.tsx
│           ├── app/
│           │   ├── layout/
│           │   │   ├── AppLayout.tsx
│           │   │   ├── Header.tsx
│           │   │   ├── Sidebar.tsx
│           │   │   ├── RequestsChatDock.tsx
│           │   │   └── requestsChatStore.ts
│           │   └── router/
│           │       └── index.tsx            # 7 rutas (RequireAuth, RequirePasswordUpdated)
│           ├── components/
│           │   ├── forms/                   # (vacío)
│           │   ├── tables/                  # (vacío)
│           │   └── ui/
│           │       ├── PageTitle.tsx
│           │       └── StatCard.tsx
│           ├── features/
│           │   ├── auth/                    # ✅ Completo
│           │   │   ├── LoginPage.tsx
│           │   │   ├── FirstPasswordChangePage.tsx
│           │   │   ├── ForgotPasswordPage.tsx
│           │   │   ├── ResetPasswordPage.tsx
│           │   │   └── auth.service.ts
│           │   ├── dashboard/               # ✅ Base implementada
│           │   │   ├── DashboardPage.tsx
│           │   │   └── DashboardPlaceholderPage.tsx
│           │   ├── dependencias/            # ❌ Vacío
│           │   ├── radicaciones/            # ✅ Completo (flujo OPS)
│           │   │   ├── OpsCuentaCobroUploadPage.tsx
│           │   │   ├── RadicacionesModule.tsx
│           │   │   └── radicaciones.service.ts
│           │   ├── roles/                   # ⚠️ Parcial (service listo, page placeholder)
│           │   │   ├── RolesPage.tsx
│           │   │   └── roles.service.ts
│           │   └── usuarios/                # ⚠️ Parcial (service listo, page placeholder)
│           │       ├── UsuariosPage.tsx
│           │       └── usuarios.service.ts
│           ├── hooks/                       # (vacío)
│           ├── services/
│           │   ├── api/                     # (vacío)
│           │   └── http/
│           │       └── api.ts               # Axios + interceptor JWT (localStorage)
│           ├── styles/
│           │   └── global.css
│           └── types/
│               ├── radicado.ts
│               ├── role.ts
│               └── usuario.ts
│
├── docs/
│   ├── api/                                 # (vacío)
│   ├── arquitectura/                        # (vacío)
│   ├── base-datos/                          # (vacío)
│   ├── normativa/                           # (vacío)
│   └── seguridad/
│       └── protocolo-vps-preproduccion.md
│
├── infra/
│   ├── backup/                              # (vacío)
│   ├── docker/
│   │   ├── postgres.env                     # gitignoreado — credenciales reales
│   │   └── postgres.env.example
│   ├── nginx/                               # (vacío)
│   └── scripts/
│       └── preflight-vps.sh                 # Auditoría de seguridad pre-deploy
│
├── packages/                                # Monorepo packages — reservados, vacíos
│   ├── shared-types/
│   ├── shared-ui/
│   └── shared-validation/
│
└── services/
    └── api/                                 # NestJS 11 + TypeORM 0.3 + PostgreSQL 17
        ├── Dockerfile
        ├── nest-cli.json
        ├── package.json
        ├── tsconfig.json
        ├── tsconfig.build.json
        ├── .env.example
        └── src/
            ├── main.ts                      # Bootstrap: Helmet, CORS, throttler, pipes
            ├── app.module.ts                # Módulos registrados
            ├── root.controller.ts           # GET / → { status, service }
            ├── health.controller.ts         # GET /api/health
            ├── common/
            │   ├── auth/
            │   │   └── jwt.strategy.ts      # Passport JWT — valida token, carga usuario
            │   ├── crypto/                  # (vacío)
            │   ├── filters/
            │   │   └── http-exception.filter.ts  # Sanitiza errores, oculta stack traces
            │   ├── guards/
            │   │   └── jwt-auth.guard.ts
            │   ├── interceptors/            # (vacío)
            │   ├── logging/                 # (vacío)
            │   ├── middleware/              # (vacío)
            │   ├── storage/                 # (vacío)
            │   └── validators/              # (vacío)
            ├── config/                      # (vacío)
            ├── db/
            │   ├── migrations/              # (vacío — usa synchronize:true en dev)
            │   ├── policies/                # (vacío)
            │   └── seeds/                   # (vacío)
            ├── modules/
            │   ├── auth/                    # ✅ Completo
            │   │   ├── auth.module.ts
            │   │   ├── auth.controller.ts
            │   │   ├── auth.service.ts
            │   │   └── dto/
            │   │       ├── login.dto.ts
            │   │       ├── request-password-reset.dto.ts
            │   │       ├── confirm-password-reset.dto.ts
            │   │       └── change-initial-password.dto.ts
            │   ├── usuarios/                # ✅ Completo
            │   │   ├── usuarios.module.ts
            │   │   ├── usuarios.controller.ts
            │   │   ├── usuarios.service.ts
            │   │   ├── usuario.entity.ts
            │   │   └── dto/
            │   │       ├── create-usuario.dto.ts
            │   │       └── update-usuario.dto.ts
            │   ├── roles/                   # ✅ Completo
            │   │   ├── roles.module.ts
            │   │   ├── roles.controller.ts
            │   │   ├── roles.service.ts
            │   │   ├── role.entity.ts
            │   │   ├── roles-permissions.catalog.ts
            │   │   └── dto/
            │   │       ├── create-role.dto.ts
            │   │       └── update-role.dto.ts
            │   ├── radicados/               # ✅ Completo (flujo OPS cuenta de cobro)
            │   │   ├── radicados.module.ts
            │   │   ├── radicados.controller.ts
            │   │   ├── radicados.service.ts
            │   │   ├── radicado.entity.ts   # Incluye datosPlantilla (jsonb)
            │   │   └── dto/
            │   │       ├── create-radicado.dto.ts
            │   │       ├── create-cuenta-cobro-ops.dto.ts
            │   │       └── submit-cuenta-cobro-ops-documentos.dto.ts
            │   ├── auditoria/               # ❌ Vacío (scaffolding)
            │   ├── dependencias/            # ❌ Vacío
            │   ├── documentos/              # ❌ Vacío
            │   ├── expedientes/             # ❌ Vacío
            │   ├── firmas/                  # ❌ Vacío
            │   ├── flujos/                  # ❌ Vacío
            │   ├── metadatos/               # ❌ Vacío
            │   ├── prestamos/               # ❌ Vacío
            │   ├── series/                  # ❌ Vacío
            │   ├── subseries/               # ❌ Vacío
            │   ├── tareas/                  # ❌ Vacío
            │   ├── terceros/                # ❌ Vacío
            │   ├── tipos-documentales/      # ❌ Vacío
            │   ├── transferencias/          # ❌ Vacío
            │   └── trd-tvd/                 # ❌ Vacío
            └── tests/
                ├── integration/             # (vacío)
                ├── security/                # (vacío)
                └── unit/                    # (vacío)
```

### Leyenda de estado

| Símbolo | Significado |
|---|---|
| ✅ | Implementado y funcional |
| ⚠️ | Parcialmente implementado o con bugs conocidos |
| ❌ | Carpeta vacía (scaffolding reservado) |

---

## Inicio rápido

### Prerrequisitos

- Docker + Docker Compose
- Node.js 22+ (para app móvil)
- Variables de entorno configuradas (ver sección Variables de entorno)

### Levantar todos los servicios

```bash
docker compose up -d
```

### Build de la API (sin caché)

```bash
docker compose --progress=plain build --no-cache api
```

La bandera `--progress` es global en `docker compose`, por eso va antes de `build`.

### Ejecutar la app móvil

```bash
cd apps/mobile
npm install --legacy-peer-deps
npx expo start
```

Escanear el QR con Expo Go (Android/iOS) o abrir en emulador Android con `a`.

## Variables de entorno

### Backend — `services/api/.env`

Copiar desde el ejemplo y completar:

```bash
cp services/api/.env.example services/api/.env
```

Variables requeridas:

```env
DB_HOST=gestordoc-postgres
DB_PORT=5432
DB_NAME=gestordoc
DB_USER=gestordoc_app
DB_PASSWORD=<clave_segura>
DB_SYNCHRONIZE=false

JWT_ACCESS_SECRET=<cadena_aleatoria_64_chars>
# openssl rand -hex 32

WEB_BASE_URL=http://localhost:3002

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

> **Importante:** `DB_SYNCHRONIZE=false` en producción. Usar migraciones.

### Base de datos Docker — `infra/docker/postgres.env`

```bash
cp infra/docker/postgres.env.example infra/docker/postgres.env
# editar con credenciales reales
```

Este archivo está en `.gitignore` y nunca debe subirse al repositorio.

## Cumplimiento VPS antes de producción

Antes de desplegar, ejecutar el preflight de seguridad:

```bash
bash infra/scripts/preflight-vps.sh
```

Si el resultado es `FAIL`, no desplegar hasta corregir.

Protocolo completo: `docs/seguridad/protocolo-vps-preproduccion.md`

## Seguridad — medidas implementadas

En la auditoría integral del proyecto se corrigieron las siguientes vulnerabilidades críticas:

### Autenticación y autorización

- **JWT implementado**: `AuthModule` ahora firma tokens con `JwtModule` + `PassportModule`. Login devuelve `{ token, usuario }`.
- **JwtAuthGuard global**: todos los endpoints administrativos (`/usuarios`, `/roles`, etc.) requieren `Authorization: Bearer <token>`.
- **Eliminado bypass de contraseña**: se removió un bloque de "compatibilidad" que comparaba la contraseña en texto plano directamente contra el hash — permitía acceso sin credenciales válidas.
- **JwtStrategy** (`common/auth/jwt.strategy.ts`): extrae y valida el Bearer token, carga el usuario activo de BD.

### Cabeceras y transporte

- `helmet()` activado globalmente en `main.ts` — previene clickjacking, sniffing, XSS headers.
- CORS restringido a `WEB_BASE_URL` (variable de entorno) — sin origen abierto.
- Body parser limitado a **1 MB** — previene DoS por payload enorme.

### Rate limiting

- `ThrottlerModule` global: 120 req/min por IP.
- Login: 10 req/min por IP (`@Throttle`).
- Recuperación de contraseña: 5 req/min.

### Filtro de excepciones

- `HttpExceptionFilter` global registrado — sanitiza respuestas de error, nunca expone stack traces ni detalles internos.
- Errores inesperados solo se loguean en servidor, nunca en respuesta HTTP.

### DTOs y validación

- `archivo` en OPS documentos: `@Matches(/^[a-zA-Z0-9_\-\.]+$/)` — previene path traversal (`../../etc/passwd`).
- `datosPlantilla`: tamaño máximo 32 KB por serialización JSON.
- `ValidationPipe` global con `whitelist: true, forbidNonWhitelisted: true`.

### Credenciales y secretos

- Credenciales de PostgreSQL movidas de `docker-compose.yml` (texto plano en VCS) a `infra/docker/postgres.env` (gitignoreado).
- `.env.example` con instrucciones claras para cada variable sensible.
- `.gitignore` creado en raíz: ignora `.env`, `postgres.env`, `node_modules/`, `dist/`.

### Frontend web

- Interceptor Axios en `services/http/api.ts`: añade automáticamente `Authorization: Bearer <token>` desde `localStorage`.
- `AuthSession` tipado incluye campo `token: string`.

### Enumeración de rutas

- `GET /` ya no expone el mapa completo de endpoints — responde solo `{ status: 'ok', service: 'gestordoc-api' }`.

### SMTP

- `AuthService` y `UsuariosService`: inicialización del transporter es **lazy** (`initMailTransporter()` retorna `null` si no hay config). La app no crashea al arrancar si SMTP no está configurado; el error se lanza solo al intentar enviar un correo.

## App móvil (React Native + Expo)

La carpeta `apps/mobile/` contiene la aplicación móvil nativa para Android e iOS, con paridad funcional respecto al frontend web.

### Estructura

```
apps/mobile/
├── App.tsx                          # Punto de entrada
├── app.json                         # Config Expo (nombre, slug, scheme)
├── package.json                     # Dependencias
├── tsconfig.json                    # TypeScript standalone (sin expo/tsconfig.base)
├── babel.config.js
└── src/
    ├── config/
    │   └── api.config.ts            # API_BASE_URL, timeouts
    ├── navigation/
    │   └── index.tsx                # RootNavigator — 6 rutas
    ├── screens/
    │   ├── auth/
    │   │   ├── LoginScreen.tsx
    │   │   ├── ForgotPasswordScreen.tsx
    │   │   ├── ResetPasswordScreen.tsx
    │   │   └── FirstPasswordScreen.tsx
    │   ├── dashboard/
    │   │   └── DashboardScreen.tsx
    │   └── radicaciones/
    │       └── OpsCuentaCobroScreen.tsx
    ├── services/
    │   ├── api.ts                   # Instancia Axios + interceptor JWT (AsyncStorage)
    │   ├── auth.service.ts          # login, reset, changePassword, sesión
    │   └── radicaciones.service.ts  # OPS: solicitud, verificar, documentos
    ├── theme/
    │   └── index.ts                 # Colors, Radius, Spacing, Typography
    └── types/
        ├── role.ts
        ├── usuario.ts               # AuthSession incluye token: string
        └── radicado.ts
```

### Rutas de navegación

| Ruta | Descripción | Pública |
|---|---|---|
| `Login` | Acceso con correo y contraseña | ✓ |
| `ForgotPassword` | Solicitar enlace de recuperación | ✓ |
| `ResetPassword` | Nueva contraseña con token del correo | ✓ |
| `OpsCuentaCobro` | Wizard OPS cuenta de cobro | ✓ |
| `FirstPassword` | Cambio obligatorio de contraseña inicial | JWT |
| `Dashboard` | Panel principal con tabs y panel admin | JWT |

### Pantallas implementadas

**LoginScreen** — formulario con correo/contraseña, detección `debeCambiarPassword`, acceso directo a verificar radicado OPS.

**ForgotPasswordScreen** — envío de correo de recuperación, mensaje de confirmación genérico (no filtra si el usuario existe).

**ResetPasswordScreen** — recibe `token` via deep link (`gestordoc://`) o entrada manual. Navega a Login tras éxito.

**FirstPasswordScreen** — bloquea acceso al dashboard hasta cambio de clave temporal. Actualiza `debeCambiarPassword: false` en sesión local.

**DashboardScreen** — tres tabs: Inicio (acceso rápido según permisos), Radicaciones, Admin (lista de usuarios + stats, solo si rol = Administrador o permiso específico). Botón de cierre de sesión con confirmación.

**OpsCuentaCobroScreen** — wizard de 4 pasos con stepper visual:
1. Verificar radicado existente (por número + CC) o iniciar solicitud nueva
2. Formulario completo de solicitud (todos los campos de plantilla, turnos dinámicos con ERON, conversión automática número→pesos en letras)
3. Carga de nombres de archivo para documentos requeridos (validación regex: solo `[a-zA-Z0-9_\-\.]`)
4. Pantalla de éxito con número de radicado

### Configuración de API URL

Editar `src/config/api.config.ts`:

```ts
// Android emulador → host
export const API_BASE_URL = 'http://10.0.2.2:3001/api';

// iOS simulador → host
// export const API_BASE_URL = 'http://localhost:3001/api';

// Dispositivo físico → IP local del servidor
// export const API_BASE_URL = 'http://192.168.x.x:3001/api';
```

### Sesión y token

- Token JWT guardado en `AsyncStorage` con clave `gestordoc.auth`.
- Interceptor en `api.ts` lee el token de forma asíncrona y añade `Authorization: Bearer <token>` en cada request.
- `clearAuthSession()` limpia la sesión; en `401` se redirige automáticamente a Login.

---

## Bitácora de continuidad (OPS cuenta de cobro)

Esta sección resume de forma detallada lo implementado en el flujo OPS para que cualquier persona pueda continuar el trabajo sin depender del historial del chat.

### Objetivo funcional implementado

Se habilitó un flujo público para:

- Solicitar radicado de cuenta de cobro OPS.
- Verificar radicado con número de CC.
- Cargar documentos requeridos por radicado.
- Capturar y persistir campos de plantilla (campos marcados en verde por negocio) para futura generación de documento final.

### Restricciones y lineamientos solicitados por negocio

Estas son restricciones explícitas que se pidieron durante la implementación y deben mantenerse:

- En login debe existir un acceso visible para verificar radicado.
- La validación de solicitud debe permitir ingreso manual de radicado y cédula.
- Debe existir botón Solicitar radicado desde la misma pantalla de validación.
- Antes de crear el radicado se debe elegir el tipo de radicado.
- El campo valor a radicar es en pesos.
- Al escribir valor numérico, el valor en letras se debe generar automáticamente.
- En turnos no se usa texto libre: cada turno se registra por número, fecha y ERON.
- Todos los campos del formulario de solicitud deben ser obligatorios.
- La vista completa debe verse ordenada, amplia y usable, no alargada ni comprimida.

### Funcionalidad implementada (resumen por etapas)

1) Acceso y navegación

- Se agregó botón Verificar radicado en login.
- Se habilitó la ruta pública de radicación/verificación OPS.

2) Verificación de solicitud

- Se permite validar por número de radicado y número de CC.
- Si la validación es correcta, se habilita la carga de documentos solicitados.

3) Solicitud de radicado

- Se agregó botón Solicitar radicado en la misma página.
- Se agregó selector de tipo de radicado (actualmente con opción de cuenta de cobro).
- Se habilitó creación real de radicado OPS y notificación por correo (según flujo existente).

4) Captura de campos de plantilla (campos verdes)

Se agregaron campos para capturar los datos requeridos de plantilla:

- Establecimiento.
- Mes y año a radicar.
- Última fecha del mes.
- Nombre completo del auxiliar.
- Cédula.
- Lugar de expedición de cédula.
- Valor a radicar en número (pesos).
- Valor a radicar en letras (autogenerado).
- Objeto contractual.
- Fecha de inicio de contrato.
- Turnos realizados.
- Cantidad total de turnos (autocalculada).
- EPS o afiliación.
- Nombre de coordinadora autorizada.
- Nota aclaratoria.
- Teléfono de contacto.
- Correo de contacto.
- Confirmación de firma digital obligatoria.
- Observaciones.

5) Turnos estructurados

- Se reemplazó textarea libre por filas dinámicas.
- Cada fila exige número, fecha y ERON.
- Se puede agregar y eliminar turnos.
- Se valida que no existan filas incompletas.
- Se mantiene compatibilidad enviando también formato textual consolidado.

6) UX/UI del formulario completo

- Se amplió layout de la página OPS para evitar aspecto estrecho/alargado.
- Se reorganizó el formulario en grilla de 2 columnas.
- Secciones visuales agregadas para guiar diligenciamiento:
	- Datos personales y de radicación.
	- Contrato y valores.
	- Turnos, soporte y confirmaciones.
- Mejoras de espaciado, bloques y jerarquía visual.

### Persistencia y backend

Para soportar el almacenamiento de datos de plantilla:

- Se agregó campo `datosPlantilla` en entidad de radicados (jsonb, nullable).
- Se extendió DTO de creación OPS para aceptar `datosPlantilla`.
- Se actualizó servicio de radicados para guardar `datosPlantilla`.

Esto deja lista la base para la siguiente fase de generación automática de documento (Word/PDF).

### Archivos modificados clave

Frontend:

- `apps/web/src/features/auth/LoginPage.tsx`
- `apps/web/src/features/radicaciones/OpsCuentaCobroUploadPage.tsx`
- `apps/web/src/features/radicaciones/radicaciones.service.ts`
- `apps/web/src/styles/global.css`

Backend:

- `services/api/src/modules/radicados/radicado.entity.ts`
- `services/api/src/modules/radicados/dto/create-cuenta-cobro-ops.dto.ts`
- `services/api/src/modules/radicados/radicados.service.ts`

### Reglas de validación activas en solicitud OPS

- No se puede generar radicado con campos vacíos.
- Valor numérico y valor en letras deben existir.
- El valor en letras se autocompleta desde el número (pesos).
- Debe existir al menos un turno completo.
- Cada turno requiere número, fecha y ERON.
- Cantidad de turnos se calcula automáticamente.
- Debe confirmarse la firma digital obligatoria.

### Estado operativo observado durante despliegues

- En reinicios de contenedores se observó de forma intermitente `curl: (56) Recv failure: Conexión reinicializada por la máquina remota`.
- Este error fue transitorio durante recreación de servicios.
- Reintentos posteriores devolvieron `HTTP/1.1 200 OK` en frontend y estado `ok` en health de API.

Comandos usados de verificación:

```bash
curl -sS --retry 12 --retry-delay 1 http://127.0.0.1:3001/api/health
curl -sS --retry 12 --retry-delay 1 -I http://127.0.0.1:3002/radicacion-cuenta-cobro-ops | head -n 1
```

### Pendiente principal (siguiente fase)

Implementar generación automática del documento final (Word/PDF) usando `datosPlantilla` del radicado, con mapeo exacto de placeholders de la plantilla institucional.

### Nota para continuidad del equipo

Si se retoma el desarrollo, mantener estas premisas:

- No relajar campos obligatorios del formulario OPS sin validación con negocio.
- Conservar la captura estructurada de turnos (no volver a texto libre).
- Mantener conversión automática de valor en pesos a letras.
- Preservar el flujo completo: solicitar radicado, verificar por CC, cargar documentos.
