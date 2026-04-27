# GestorDoc CO — Plataforma de gestión documental

Sistema institucional de gestión documental: radicación, expedientes, préstamos, transferencias y gestión de usuarios/roles.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | NestJS 11 · TypeORM · PostgreSQL 17 |
| Frontend Web | React 19 · React Router 7 · Vite 6 |
| App Móvil | React Native 0.76 · Expo SDK 52 |
| Infraestructura | Docker Compose · Nginx |

## Servicios

| Servicio | Puerto |
|---|---|
| API (`gestordoc-api`) | `127.0.0.1:3001` |
| Frontend web (`gestordoc-web`) | `0.0.0.0:3002` |
| PostgreSQL (`gestordoc-postgres`) | `127.0.0.1:5432` |

## Estructura del proyecto

```
gestion-documental/
├── apps/
│   ├── mobile/          # React Native + Expo
│   └── web/             # React + Vite
├── docs/
│   ├── base-datos/      # Guía de migraciones
│   ├── despliegue/      # Checklists deploy y rollback
│   └── seguridad/       # Protocolo VPS preproducción
├── infra/
│   ├── backup/          # Script backup PostgreSQL
│   ├── docker/          # postgres.env (gitignoreado)
│   └── scripts/         # preflight-vps.sh
├── packages/            # shared-types, shared-ui, shared-validation
└── services/
    └── api/             # NestJS — módulos, entidades, DTOs
```

### Módulos backend

| Módulo | Estado |
|---|---|
| `auth` | ✅ Completo |
| `usuarios` | ✅ Completo |
| `roles` | ✅ Completo |
| `radicados` | ✅ Completo (flujo OPS cuenta de cobro) |
| `dependencias`, `documentos`, `expedientes` | ❌ Scaffolding |
| `series`, `flujos`, `tareas`, `firmas` | ❌ Scaffolding |
| `transferencias`, `prestamos`, `auditoria` | ❌ Scaffolding |

## Inicio rápido

```bash
# Variables de entorno
cp services/api/.env.example services/api/.env
cp infra/docker/postgres.env.example infra/docker/postgres.env
# editar ambos archivos con credenciales reales

# Levantar servicios
docker compose up -d

# App móvil
cd apps/mobile && npm install --legacy-peer-deps && npx expo start
```

> Ver `NOTAS_PRIVADAS.md` (local, no en Git) para protocolo de producción, bugs conocidos y credenciales.

## Git

| Rama | Propósito |
|---|---|
| `main` | Producción — solo merges desde `develop` |
| `develop` | Integración |
| `feature/<nombre>` | Desarrollo de cada módulo |

```
feat(módulo):    nueva funcionalidad
fix(módulo):     corrección de bug
docs:            documentación
chore:           mantenimiento
```

## Módulos pendientes (ramas sugeridas)

| Rama | Prioridad |
|---|---|
| `feature/fix-mobile-ops` | 🔴 Antes de producción |
| `feature/migraciones-db` | 🔴 Antes de producción |
| `feature/dependencias` | Alta |
| `feature/documentos` | Alta |
| `feature/expedientes` | Alta |
| `feature/series-trd` | Media |
| `feature/flujos-tareas` | Media |
| `feature/firmas`, `feature/transferencias` | Media |
| `feature/prestamos`, `feature/auditoria` | Baja |
