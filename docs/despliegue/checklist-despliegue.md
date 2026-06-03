# Checklist de despliegue — GestorDoc CO

Ejecutar esta lista completa antes de cada despliegue a **producción** o **test**.
Marcar cada ítem. No desplegar si algún ítem crítico (🔴) no está completo.

---

## Pre-despliegue

### Código
- [ ] 🔴 El PR fue revisado y aprobado (al menos una revisión)
- [ ] 🔴 Las pruebas básicas pasan en local (login, módulo afectado, permisos)
- [ ] 🔴 No hay secrets ni .env reales en el commit (`git diff HEAD~1 -- '*.env'`)
- [ ] 🔴 Si hubo cambios en entidades, la migración está incluida en el commit
- [ ] 🟡 El CHANGELOG o commit describe qué cambió exactamente
- [ ] 🟡 La rama fue probada en el ambiente test/preproducción

### Base de datos
- [ ] 🔴 Se ejecutó backup manual previo al despliegue:
  ```bash
  bash infra/backup/backup-postgres.sh --output-dir /srv/backups/pre-release-$(date +%Y%m%d)
  ```
- [ ] 🔴 El backup se verificó (el archivo existe y tiene tamaño > 0)
- [ ] 🟡 Si es una migración destructiva, se definió el plan de rollback de BD

### Infraestructura
- [ ] 🟡 Las variables de entorno del servidor están actualizadas si hubo nuevas
- [ ] 🟡 El `docker-compose.yml` no usa `--volumes` que pudieran borrar datos

---

## Durante el despliegue

```bash
# 1. Ir a la rama main (producción)
git checkout main
git merge --no-ff develop

# 2. Hacer tag de versión
git tag -a v0.X.0 -m "release: descripción breve"
git push origin main --tags

# 3. En el servidor: bajar y levantar sin destruir volúmenes
docker compose pull
docker compose up -d --build

# 4. Ejecutar migraciones pendientes
docker compose exec api npm run migration:run

# 5. Verificar health check
curl -sf http://127.0.0.1:3001/api/health
```

---

## Post-despliegue

### Validación funcional
- [ ] 🔴 `GET /api/health` devuelve `200 OK`
- [ ] 🔴 Login con usuario real funciona
- [ ] 🔴 El módulo afectado por el despliegue funciona correctamente
- [ ] 🔴 Los permisos por rol no se rompieron
- [ ] 🟡 El frontend web carga sin errores de consola críticos
- [ ] 🟡 La app móvil conecta a la API correctamente (si aplica)

### Monitoreo
- [ ] 🟡 No hay errores 500 en logs durante los primeros 5 minutos
  ```bash
  docker compose logs api --tail=100 --since=5m
  ```
- [ ] 🟡 Conexión a BD estable (sin errores de pool)

---

## Leyenda

| Símbolo | Significado |
|---|---|
| 🔴 | Crítico — no desplegar sin completarlo |
| 🟡 | Recomendado — completar si aplica |
