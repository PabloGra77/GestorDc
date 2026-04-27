# Migraciones TypeORM — GestorDoc CO

Guía operativa para crear, ejecutar y revertir migraciones de base de datos.

---

## Regla fundamental

> **Nunca usar `DB_SYNCHRONIZE=true` en test ni en producción.**
> El esquema de la base de datos lo controlan las migraciones versionadas en Git,
> no el ORM automático.

| Ambiente | `DB_SYNCHRONIZE` | Fuente de verdad del esquema |
|---|---|---|
| `local` (prototipado) | `true` (tolerable) | TypeORM auto-sync |
| `local` (estable) | `false` | Migraciones |
| `test` | `false` | Migraciones |
| `producción` | `false` | Migraciones |

---

## Comandos disponibles

```bash
# Generar migración comparando entidades vs BD actual
npm run migration:generate -- src/db/migrations/NombreDeLaMigracion

# Ejecutar todas las migraciones pendientes
npm run migration:run

# Revertir la última migración aplicada
npm run migration:revert

# Ver estado de migraciones (ejecutadas y pendientes)
npm run migration:show
```

---

## Flujo: agregar un módulo nuevo (ej. expedientes)

### Paso 1 — Crear la entidad

```ts
// src/modules/expedientes/expediente.entity.ts
@Entity('expedientes')
export class Expediente {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  codigo: string;
  // ...
}
```

### Paso 2 — Generar la migración

```bash
npm run migration:generate -- src/db/migrations/CreateExpedientes
```

Esto crea un archivo como `src/db/migrations/1714000000000-CreateExpedientes.ts`.
**Revisar el archivo generado** antes de commitear — asegurarse que el SQL es el esperado.

### Paso 3 — Commitear entidad + migración juntos

```bash
git add src/modules/expedientes/expediente.entity.ts
git add src/db/migrations/1714000000000-CreateExpedientes.ts
git commit -m "feat(expedientes): entidad y migración inicial"
```

> ⚠️ **Nunca** subas código que espere columnas nuevas sin la migración correspondiente
> en el mismo commit o PR. De lo contrario la app rompe en el momento de despliegue.

### Paso 4 — Ejecutar en el servidor

```bash
docker compose exec api npm run migration:run
```

---

## Migraciones manuales (SQL puro)

Para cambios complejos se puede escribir la migración a mano:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexExpedientes1714000000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX idx_expedientes_codigo ON expedientes (codigo)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_expedientes_codigo`,
    );
  }
}
```

---

## Migraciones seguras vs peligrosas

### ✅ Seguras (bajo riesgo)
- Crear tabla nueva
- Agregar columna `nullable` o con `DEFAULT`
- Agregar índice
- Agregar FK nueva

### ⚠️ Requieren cuidado
- Renombrar columna → hacerlo en dos migraciones (agregar nueva, migrar datos, eliminar vieja)
- Cambiar tipo de columna → verificar conversión de datos existentes
- Volver NOT NULL una columna que tenía nulos → limpiar datos primero

### 🔴 Peligrosas (requieren backup previo obligatorio)
- Eliminar columna
- Eliminar tabla
- Truncar datos

---

## Naming convention

```
<timestamp>-<PascalCase descripción>.ts

Ejemplos:
1714000000000-CreateExpedientes.ts
1714000000001-AddIndexExpedientesCodigo.ts
1714000000002-AddColumnExpedientesFechaArchivo.ts
1714000000003-DropColumnExpedientesLegado.ts
```

---

## Verificar migraciones en el servidor

```bash
# Ver qué migraciones están ejecutadas
docker compose exec api npm run migration:show

# Ver la tabla de migraciones en PostgreSQL
docker compose exec postgres psql -U gestordoc_app -d gestordoc \
  -c "SELECT name, timestamp FROM typeorm_migrations ORDER BY timestamp;"
```

---

## Próximas migraciones previstas

| Módulo | Tablas esperadas | Estado |
|---|---|---|
| `dependencias` | `dependencias` | Pendiente |
| `documentos` | `documentos`, `versiones_documento` | Pendiente |
| `expedientes` | `expedientes`, `expediente_documentos` | Pendiente |
| `series` / `subseries` | `series`, `subseries`, `tipos_documentales` | Pendiente |
| `trd-tvd` | `trd`, `tvd`, `trd_series` | Pendiente |
| `flujos` / `tareas` | `flujos`, `etapas_flujo`, `tareas` | Pendiente |
| `firmas` | `firmas_digitales` | Pendiente |
| `transferencias` | `transferencias`, `transferencia_docs` | Pendiente |
| `prestamos` | `prestamos`, `prestamo_docs` | Pendiente |
| `auditoria` | `log_auditoria` | Pendiente |
