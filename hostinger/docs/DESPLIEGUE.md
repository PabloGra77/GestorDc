# Despliegue — Payops

Frontend React compilado (Vite) + Backend PHP 8 puro sobre Hostinger shared (LiteSpeed) con MariaDB.

**URL pública:** https://payops.ipsgoleman.com
**SSH:** `<SSH_HOST>` puerto `65002`
**Web root:** `/home/<USER>/websites/<SITE>/public_html/`

---

## 1. Layout en el servidor

```
public_html/
├── .htaccess                 HTTPS + headers de seguridad
├── index.html                SPA entry (regenerado en cada build)
├── assets/                   bundles JS/CSS con hash de Vite
├── sw.js, manifest.webmanifest, icon-app.png, logo-payops*.png
└── api/
    ├── .env                  credenciales (chmod 600, NO subir al repo)
    ├── .htaccess
    ├── index.php             router PATH_INFO
    ├── bootstrap.php
    ├── lib/
    └── endpoints/
```

---

## 2. Frontend — build + subida

```bash
cd apps/web
npm run build
```

El build genera `dist/index.html` y `dist/assets/*.{js,css}` con hashes nuevos cada vez.

Subir al servidor:

```bash
# index.html siempre
pscp -P 65002 -pw "<password>" dist/index.html \
  <SSH_USER>@<SSH_HOST>:websites/<SITE>/public_html/

# nuevos assets/*.js y *.css
pscp -P 65002 -pw "<password>" dist/assets/index-*.js dist/assets/index-*.css dist/assets/index.es-*.js \
  <SSH_USER>@<SSH_HOST>:websites/<SITE>/public_html/assets/
```

Después limpiar bundles anteriores del servidor (no se sobrescriben porque tienen hashes distintos):

```bash
plink -P 65002 -pw "<password>" <SSH_USER>@<SSH_HOST> \
  "cd websites/<SITE>/public_html/assets && rm -f index-<hash_viejo>.js index-<hash_viejo>.css"
```

---

## 3. Backend — subida selectiva

Subir solo los archivos modificados:

```bash
pscp -P 65002 -pw "<password>" \
  hostinger/public_html/api/endpoints/<modulo>/<archivo>.php \
  <SSH_USER>@<SSH_HOST>:websites/<SITE>/public_html/api/endpoints/<modulo>/
```

Verificar sintaxis remota tras cada subida:

```bash
plink -P 65002 -pw "<password>" <SSH_USER>@<SSH_HOST> \
  "php -l websites/<SITE>/public_html/api/endpoints/<modulo>/<archivo>.php"
```

---

## 4. Migraciones SQL

Cada cambio de esquema se versiona como un archivo `hostinger/sql/00X_<descripcion>.sql`.

Aplicar:

```bash
plink -P 65002 -pw "<password>" <SSH_USER>@<SSH_HOST> \
  "mysql -h localhost -u '<DB_USER>' -p'<db_password>' <DB_NAME> < /home/<USER>/websites/<SITE>/public_html/<archivo>.sql"
```

O subir el archivo SQL al servidor primero y ejecutarlo desde la consola SSH.

---

## 5. `.env` en producción

`/home/<USER>/websites/<SITE>/public_html/api/.env`:

```
APP_ENV=production
APP_DEBUG=false

DB_HOST=localhost
DB_PORT=3306
DB_NAME=<DB_NAME>
DB_USER=<DB_USER>
DB_PASSWORD=<db_password>

JWT_ACCESS_SECRET=<32+ bytes hex>
JWT_TTL_MINUTES=480

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=notificaciones@notigoleman.com.co
SMTP_PASS=<app_password_gmail>
SMTP_FROM=Payops <notificaciones@notigoleman.com.co>

WEB_BASE_URL=https://payops.ipsgoleman.com
```

Permisos: `chmod 600 .env`. El `.htaccess` ya bloquea acceso público.

---

## 6. Crear/resetear administrador

```bash
plink -P 65002 -pw "<password>" <SSH_USER>@<SSH_HOST> \
  "GD_ENV_PATH=/home/<USER>/websites/<SITE>/public_html/api/.env \
   php /home/<USER>/private_seed/seed-admin.php 'admin@ipsgoleman.com.co' '<NuevaPassword>'"
```

El script:
- Crea el usuario si no existe
- Resetea la password si ya existe
- Asigna rol Administrador
- Marca `must_change_password=1` para forzar cambio en el primer login

---

## 7. Verificación post-deploy

```bash
# Health del API
curl -sI https://payops.ipsgoleman.com/api/index.php/health

# Frontend
curl -sI https://payops.ipsgoleman.com/

# Login funcional
curl -sS -X POST https://payops.ipsgoleman.com/api/index.php/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin@ipsgoleman.com.co","password":"<password>"}'
```

Las tres deben devolver 200 OK con respuesta JSON válida.

---

## 8. Logs y diagnóstico

```bash
# PHP error log de Hostinger
plink ... "tail -100 /home/<USER>/websites/<SITE>/.h5g/php_error.log"

# Estado del filesystem
plink ... "ls -la websites/<SITE>/public_html/assets/"
```

---

## 9. Rollback

Mantener una copia local de la última versión estable de `assets/` y los PHP modificados antes de cada deploy. Si algo falla, restaurar esos archivos directamente con `pscp`.

Para migraciones SQL destructivas, restaurar desde el backup automático diario de Hostinger (hPanel → Backups).

---

## 10. Errores comunes

| Error | Causa | Solución |
|---|---|---|
| 500 en `/api/...` | `.env` mal configurado o credenciales DB | Revisar `php_error.log` |
| 401 en login válido | Hash bcrypt corrupto | Ejecutar `seed-admin.php` |
| Correos no llegan | App password Gmail expirada | Generar nueva en Google Account |
| Bundle no carga | Hash viejo cacheado | `Ctrl+Shift+R` o limpiar caché Hostinger |
| Ruta `/dashboard` devuelve 404 al refrescar | `.htaccess` raíz faltante | Verificar que existe en `public_html/` |

---

## Routing

Hostinger no aplica los rewrites de `.htaccess` de forma confiable, por lo que el frontend usa PATH_INFO:

```
/api/index.php/<ruta>
```

El cliente axios tiene configurado `baseURL = '/api/index.php'`. No tocar.

---

## Convenciones de versión

- Frontend: `apps/web/dist/` se regenera completo en cada build
- Backend: solo se suben archivos modificados
- Migraciones: nuevo archivo `00X_*.sql` por cada cambio de esquema
- `NOTAS_PRIVADAS.md` contiene credenciales y permanece fuera del repo
