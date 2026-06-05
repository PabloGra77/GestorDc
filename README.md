# Payops — Goleman IPS

Plataforma documental y de radicación de cuentas de cobro para Goleman IPS.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 · Vite 6 · TypeScript |
| Backend | PHP 8 (sin framework) |
| Base de datos | MariaDB 10 |
| Autenticación | JWT · bcrypt |

## Estructura

```
gestion-documental/
├── apps/web/          Frontend React (código fuente)
├── hostinger/         Backend PHP y archivos del servidor
│   ├── public_html/api/   Router, librerías y endpoints
│   └── sql/               Esquema y migraciones
└── docs/              Documentación interna
```

## Desarrollo

```bash
cd apps/web
npm install
npm run dev      # http://localhost:3002
npm run build    # genera apps/web/dist/
```

Variable de entorno (`apps/web/.env`):

```
VITE_API_BASE_URL=/api/index.php
```

## Funcionamiento

- El frontend es una SPA que consume la API en `/api/index.php/<ruta>`.
- El backend resuelve cada ruta contra una tabla de endpoints y responde en JSON.
- Las solicitudes pasan por un flujo de aprobación por niveles y cada validador firma desde su dispositivo.
- Hay un formulario público (sin login) para radicar cuentas de cobro y consultar su estado.

## Despliegue

Procedimiento detallado en `hostinger/docs/DESPLIEGUE.md`.

Resumen:

```bash
cd apps/web && npm run build   # construir frontend
# Subir el contenido de dist/ y los cambios de api/ al servidor.
```

## Convenciones de commits

```
feat:   nueva funcionalidad
fix:    corrección
docs:   documentación
style:  UI / estilos
chore:  mantenimiento
```
