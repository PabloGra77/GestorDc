# Checklist de rollback — GestorDoc CO

Usar cuando un despliegue falla o se detecta un problema crítico en producción.
El rollback tiene **dos capas**: código y base de datos. Siempre evaluarlas juntas.

---

## 1. Evaluar el problema

- [ ] ¿El problema es de código (lógica, rutas, permisos)?
- [ ] ¿El problema es de base de datos (esquema, datos corruptos)?
- [ ] ¿El problema es de infraestructura (red, volúmenes, recursos)?

---

## 2. Rollback de código

```bash
# Ver commits recientes
git log --oneline -10

# Volver al commit o tag anterior
git checkout main
git reset --hard v0.X-1.0    # o el tag anterior al que falla
git push origin main --force-with-lease

# En el servidor: reconstruir y levantar con la versión anterior
docker compose up -d --build
```

> ⚠️ Si ya se ejecutaron migraciones, el rollback de código solo no es suficiente.
> Ver sección 3.

---

## 3. Rollback de base de datos

### 3a. Si la migración es reversible (TypeORM revert)

```bash
# Revertir la última migración aplicada
docker compose exec api npm run migration:revert

# Verificar estado de migraciones
docker compose exec api npm run migration:show
```

### 3b. Si la migración no es reversible (destructiva)

Restaurar desde el backup pre-despliegue:

```bash
# Detener API para evitar escrituras durante la restauración
docker compose stop api

# Restaurar backup
BACKUP_FILE=/srv/backups/pre-release-YYYYMMDD/gestordoc_TIMESTAMP.sql.gz
gunzip -c "$BACKUP_FILE" | PGPASSWORD=<clave> psql \
  -h 127.0.0.1 -p 5432 \
  -U gestordoc_app gestordoc

# Verificar que la BD está operativa
PGPASSWORD=<clave> psql -h 127.0.0.1 -U gestordoc_app -d gestordoc -c "\dt"

# Levantar API con la versión de código anterior
docker compose up -d api
```

> ⚠️ Al restaurar un backup **se pierden todos los datos escritos después del backup**.
> Por eso el backup pre-despliegue es obligatorio.

---

## 4. Validación post-rollback

- [ ] 🔴 `GET /api/health` devuelve `200 OK`
- [ ] 🔴 Login funciona
- [ ] 🔴 El módulo afectado responde correctamente
- [ ] 🔴 No hay errores 500 en logs

```bash
docker compose logs api --tail=50
```

---

## 5. Post-mortem

- [ ] Documentar qué falló y por qué
- [ ] Agregar prueba para el caso que falló
- [ ] Revisar si la migración era reversible y cómo hacerla segura
- [ ] Actualizar el checklist de despliegue si faltó algún control

---

## Reglas de rollback de BD

| Tipo de cambio | Reversible con `migration:revert` | Requiere backup |
|---|---|---|
| Crear tabla nueva | ✅ | No crítico |
| Agregar columna nullable | ✅ | No crítico |
| Agregar índice | ✅ | No crítico |
| Renombrar columna | ⚠️ Parcial | Sí |
| Borrar columna | ❌ No | Sí — obligatorio |
| Borrar tabla | ❌ No | Sí — obligatorio |
| Cambiar tipo de columna | ⚠️ Depende | Sí |
