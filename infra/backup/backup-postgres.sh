#!/usr/bin/env bash
# =============================================================================
# GestorDoc CO — Script de backup de PostgreSQL
# =============================================================================
# USO:
#   bash infra/backup/backup-postgres.sh [opciones]
#
# OPCIONES:
#   --env-file PATH   Ruta al archivo con variables de entorno (default: ./infra/docker/postgres.env)
#   --output-dir DIR  Directorio de salida (default: ./infra/backup/dumps)
#   --retention DAYS  Días de retención de backups (default: 30)
#   --dry-run         Mostrar qué haría sin ejecutar
#
# EJEMPLOS:
#   # Backup normal desde raíz del proyecto:
#   bash infra/backup/backup-postgres.sh
#
#   # Backup con retención de 7 días:
#   bash infra/backup/backup-postgres.sh --retention 7
#
#   # Backup pre-despliegue manual:
#   bash infra/backup/backup-postgres.sh --output-dir /srv/backups/pre-release
#
# CRON sugerido (backup diario a las 2 AM):
#   0 2 * * * /srv/devapps/gestion-documental/infra/backup/backup-postgres.sh >> /var/log/gestordoc-backup.log 2>&1
# =============================================================================
set -euo pipefail

# ── Valores por defecto ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/infra/docker/postgres.env"
OUTPUT_DIR="${SCRIPT_DIR}/dumps"
RETENTION_DAYS=30
DRY_RUN=false

# ── Parsear argumentos ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)   ENV_FILE="$2"; shift 2 ;;
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    --retention)  RETENTION_DAYS="$2"; shift 2 ;;
    --dry-run)    DRY_RUN=true; shift ;;
    *) echo "[ERROR] Argumento desconocido: $1"; exit 1 ;;
  esac
done

# ── Colores ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Cargar variables de entorno ────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  log_error "Archivo de entorno no encontrado: $ENV_FILE"
  log_error "Copia infra/docker/postgres.env.example y completa las credenciales."
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${POSTGRES_DB:?Variable POSTGRES_DB no definida en $ENV_FILE}"
: "${POSTGRES_USER:?Variable POSTGRES_USER no definida en $ENV_FILE}"
: "${POSTGRES_PASSWORD:?Variable POSTGRES_PASSWORD no definida en $ENV_FILE}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"

# ── Preparar directorio de salida ──────────────────────────────────────────────
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
FILEPATH="${OUTPUT_DIR}/${FILENAME}"
LATEST_LINK="${OUTPUT_DIR}/${POSTGRES_DB}_latest.sql.gz"

log_info "═══════════════════════════════════════════════════════"
log_info "  GestorDoc CO — Backup PostgreSQL"
log_info "  Base de datos : $POSTGRES_DB"
log_info "  Servidor      : $PGHOST:$PGPORT"
log_info "  Destino       : $FILEPATH"
log_info "  Retención     : ${RETENTION_DAYS} días"
log_info "═══════════════════════════════════════════════════════"

if [[ "$DRY_RUN" == "true" ]]; then
  log_warn "MODO DRY-RUN — no se ejecutará nada."
  exit 0
fi

mkdir -p "$OUTPUT_DIR"

# ── Ejecutar pg_dump ───────────────────────────────────────────────────────────
log_info "Iniciando pg_dump..."

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$POSTGRES_USER" \
  --no-password \
  --format=plain \
  --verbose \
  "$POSTGRES_DB" \
  | gzip > "$FILEPATH"

DUMP_SIZE="$(du -sh "$FILEPATH" | cut -f1)"
log_info "Backup completado: $FILEPATH ($DUMP_SIZE)"

# ── Enlace simbólico al último backup ──────────────────────────────────────────
ln -sf "$FILEPATH" "$LATEST_LINK"
log_info "Enlace latest actualizado: $LATEST_LINK"

# ── Limpieza por retención ─────────────────────────────────────────────────────
log_info "Eliminando backups con más de ${RETENTION_DAYS} días..."
find "$OUTPUT_DIR" -name "${POSTGRES_DB}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete -print \
  | while read -r f; do log_warn "Eliminado: $f"; done

log_info "Backups disponibles:"
ls -lh "$OUTPUT_DIR"/*.sql.gz 2>/dev/null || log_warn "No hay backups previos."

log_info "✔ Backup finalizado correctamente."

# ── Instrucciones de restauración ─────────────────────────────────────────────
echo ""
log_info "Para restaurar este backup:"
echo "  gunzip -c $FILEPATH | PGPASSWORD=<clave> psql -h $PGHOST -p $PGPORT -U $POSTGRES_USER $POSTGRES_DB"
