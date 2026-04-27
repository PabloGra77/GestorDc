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
│   │   ├── .env.example                     # EXPO_PUBLIC_API_BASE_URL
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
│       ├── .env.example                     # VITE_API_BASE_URL
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
│   ├── base-datos/
│   │   └── migraciones.md                   # Guía completa TypeORM: comandos, flujo, naming
│   ├── despliegue/
│   │   ├── checklist-despliegue.md          # Checklist pre/durante/post deploy
│   │   └── checklist-rollback.md            # Protocolo rollback código + BD
│   ├── normativa/                           # (vacío)
│   └── seguridad/
│       └── protocolo-vps-preproduccion.md
│
├── infra/
│   ├── backup/
│   │   └── backup-postgres.sh               # Backup con retención, logs y restore cmd
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
            │   ├── data-source.ts           # DataSource para TypeORM CLI (migrations)
            │   ├── migrations/              # (vacío — usar migration:generate)
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

## Flujo de trabajo Git

### Ramas

| Rama | Propósito |
|---|---|
| `main` | Código en producción — solo recibe merges desde `develop` |
| `develop` | Integración de funcionalidades — rama base de trabajo |
| `feature/<nombre>` | Desarrollo de cada módulo o funcionalidad nueva |

### Ciclo completo de un módulo nuevo

```bash
# 1. Partir siempre de develop actualizado
git checkout develop && git pull origin develop
git checkout -b feature/expedientes

# 2. Desarrollar: entidad + servicio + controlador + DTOs + migración

# 3. Commit (entidad y migración juntos — nunca separados)
git add .
git commit -m "feat(expedientes): entidad, CRUD y migración inicial"
git push -u origin feature/expedientes

# 4. PR a develop → merge
git checkout develop
git merge --no-ff feature/expedientes -m "feat(expedientes): CRUD completo"
git branch -d feature/expedientes

# 5. Probar en test, luego merge a main
git checkout main
git merge --no-ff develop -m "release: v0.2.0"
git tag -a v0.2.0 -m "Expedientes y dependencias"
git push origin main --tags
```

### Convención de commits

```
feat(módulo):     nueva funcionalidad
fix(módulo):      corrección de bug
refactor(módulo): cambio sin nueva funcionalidad
docs:             solo documentación
chore:            mantenimiento (deps, config, build)
```

---

## Protocolo operativo

> Esta sección resume las reglas para trabajar de forma segura con versiones,
> base de datos, backups y despliegues. Leer antes de tocar `main` o producción.

### Regla principal

Código, base de datos y archivos **no se promueven a producción de la misma manera**:

| Artefacto | Cómo se promueve |
|---|---|
| Código | Por Git (ramas → PR → merge → tag) |
| Esquema de BD | Por migraciones TypeORM versionadas |
| Archivos de usuarios | Volumen dedicado, respaldo independiente |

**Nunca mezcles estas tres cosas.**

### Ambientes

| Ambiente | Base de datos | Sincronizar (`DB_SYNCHRONIZE`) |
|---|---|---|
| `local` (prototipado) | Local Docker | `true` (tolerable) |
| `local` (estable) | Local Docker | `false` |
| `test / preproducción` | BD propia de test | `false` |
| `producción` | BD real | `false` — siempre |

Nunca apuntes test a la BD de producción.

### Variables de entorno por ambiente

Cada ambiente tiene su propio archivo `.env` (nunca en Git):

```
services/api/.env.local
services/api/.env.test
services/api/.env.prod
services/api/.env.example   ← este sí va a Git
```

Para generar secretos JWT:
```bash
openssl rand -hex 32
```

### Migraciones de base de datos

Ver guía completa: `docs/base-datos/migraciones.md`

```bash
# Generar migración (ejecutar en el contenedor o con ts-node local)
npm run migration:generate -- src/db/migrations/NombreMigracion

# Ejecutar pendientes
npm run migration:run

# Revertir última
npm run migration:revert

# Ver estado
npm run migration:show
```

**Regla crítica:** todo commit que cambie entidades debe incluir su migración.
Nunca subas código que espere columnas que la BD aún no tiene.

### Backups

Antes de cada despliegue a producción, hacer backup manual:

```bash
bash infra/backup/backup-postgres.sh \
  --output-dir /srv/backups/pre-release-$(date +%Y%m%d)
```

Cron diario sugerido:
```
0 2 * * * /srv/devapps/gestion-documental/infra/backup/backup-postgres.sh >> /var/log/gestordoc-backup.log 2>&1
```

> Un backup que nunca fue restaurado no sirve.
> Probar la restauración en un servidor alterno al menos una vez antes de producción.

### Despliegue a producción (resumen)

1. Verificar checklist: `docs/despliegue/checklist-despliegue.md`
2. Hacer backup de BD
3. `git checkout main && git merge --no-ff develop`
4. `docker compose up -d --build`
5. `docker compose exec api npm run migration:run`
6. Validar `GET /api/health` → `200 OK`
7. Crear tag: `git tag -a v0.X.0`

### Rollback

Ver procedimiento completo: `docs/despliegue/checklist-rollback.md`

```bash
# Rollback de código
git reset --hard v0.X-1.0 && docker compose up -d --build

# Rollback de migración reversible
docker compose exec api npm run migration:revert

# Rollback de migración destructiva → restaurar backup pre-despliegue
gunzip -c /srv/backups/pre-release-YYYYMMDD/gestordoc_*.sql.gz \
  | PGPASSWORD=<clave> psql -h 127.0.0.1 -U gestordoc_app gestordoc
```

### Reglas de oro — no perder datos

1. No compartas BD entre test y producción
2. No subas secretos a Git
3. No uses `DB_SYNCHRONIZE=true` en test ni producción
4. No hagas cambios manuales en la BD de producción sin migración
5. No despliegues sin backup previo
6. No hagas push directo a `main`
7. No separes código y migración en commits distintos
8. No asumas que el backup sirve si nunca lo restauraste
9. No borres columnas sin plan de rollback
10. No promociones a producción lo que no pasó por test

### Documentación operativa

| Documento | Ubicación |
|---|---|
| Guía de migraciones | `docs/base-datos/migraciones.md` |
| Checklist de despliegue | `docs/despliegue/checklist-despliegue.md` |
| Checklist de rollback | `docs/despliegue/checklist-rollback.md` |
| Protocolo VPS preproducción | `docs/seguridad/protocolo-vps-preproduccion.md` |

---

## Backlog de módulos — ramas sugeridas

Los siguientes módulos ya tienen carpeta scaffolded en `services/api/src/modules/`. Cada uno debe desarrollarse en su propia rama `feature/`:

| Rama | Módulos | Prioridad |
|---|---|---|
| `feature/fix-mobile-ops` | Corrección de bugs en `OpsCuentaCobroScreen.tsx` | 🔴 Alta |
| `feature/migraciones-db` | Migrar de `synchronize:true` a migraciones TypeORM | 🔴 Alta |
| `feature/dependencias` | Gestión de dependencias/unidades organizacionales | 🟡 Alta |
| `feature/documentos` | Registro y metadatos de documentos | 🟡 Alta |
| `feature/expedientes` | Creación y gestión de expedientes documentales | 🟡 Alta |
| `feature/series-trd` | Series, subseries, tipos documentales, TRD/TVD | Media |
| `feature/flujos-tareas` | Flujos de trabajo y asignación de tareas | Media |
| `feature/firmas` | Firma digital de documentos | Media |
| `feature/transferencias` | Transferencias documentales primarias/secundarias | Media |
| `feature/prestamos` | Préstamos y consultas de documentos físicos | Baja |
| `feature/auditoria` | Log de auditoría de acciones | Baja |

> 🔴 = prioritarios antes de cualquier despliegue estable a producción.

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

## Seguridad — medidas activas

| Capa | Medida |
|---|---|
| Autenticación | JWT (Bearer token) · JwtAuthGuard global |
| Cabeceras | `helmet()` global · CORS restringido a `WEB_BASE_URL` |
| Body | Límite 1 MB — previene DoS por payload |
| Rate limiting | 120 req/min global · 10 login · 5 reset-password |
| Errores | `HttpExceptionFilter` — sin stack traces en respuestas |
| Validación | `ValidationPipe` con `whitelist: true` · regex en nombres de archivo |
| Secretos | Credenciales en `.env` y `postgres.env` — ambos gitignoreados |
| SMTP | Inicialización lazy — la app no crashea si SMTP no está configurado |

> Historial completo de vulnerabilidades corregidas: `NOTAS_PRIVADAS.md` (local, no en Git)

---

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

## Módulo OPS — Cuenta de cobro

El flujo OPS permite a auxiliares externos solicitar y verificar radicados de cuenta de cobro
sin necesidad de cuenta en el sistema.

**Pantalla principal:** `OpsCuentaCobroScreen` (mobile) / `OpsCuentaCobroUploadPage` (web)

Flujo: verificar radicado → solicitar nuevo radicado → cargar documentos → confirmación.

> Bitácora técnica completa, restricciones de negocio y bugs conocidos: `NOTAS_PRIVADAS.md` (local, no en Git)
