#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.yml}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: No existe el archivo $COMPOSE_FILE"
  exit 1
fi

reserved_ports=(80 443 22 81 9443)
db_ports=(3306 5432)
errors=0

echo "[INFO] Validando politicas de puertos sobre $COMPOSE_FILE"

mapfile -t mappings < <(
  awk '
    /^[[:space:]]*ports:[[:space:]]*$/ { in_ports=1; next }
    in_ports && /^[[:space:]]*-[[:space:]]*"[^"]+"[[:space:]]*$/ {
      line=$0
      sub(/^[[:space:]]*-[[:space:]]*"/, "", line)
      sub(/"[[:space:]]*$/, "", line)
      print line
      next
    }
    in_ports && !/^[[:space:]]*-[[:space:]]*"[^"]+"[[:space:]]*$/ && !/^[[:space:]]*$/ { in_ports=0 }
  ' "$COMPOSE_FILE"
)

extract_host_ip() {
  local mapping="$1"
  mapping="${mapping%%/*}"

  if [[ "$mapping" =~ ^([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):[0-9]+:[0-9]+$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi

  echo ""
}

extract_host_port() {
  local mapping="$1"
  mapping="${mapping%%/*}"

  if [[ "$mapping" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:([0-9]+):([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi

  if [[ "$mapping" =~ ^([0-9]+):([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi

  if [[ "$mapping" =~ ^([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi

  echo ""
}

# Regla: no usar puertos reservados.
for mapping in "${mappings[@]}"; do
  host_port="$(extract_host_port "$mapping")"
  if [[ -z "$host_port" ]]; then
    continue
  fi

  for p in "${reserved_ports[@]}"; do
    if [[ "$host_port" == "$p" ]]; then
      echo "ERROR: Se detecto publicacion de puerto reservado $p en mapping '$mapping'."
      errors=1
    fi
  done
done

# Regla: DB no expuesta publicamente.
for mapping in "${mappings[@]}"; do
  host_port="$(extract_host_port "$mapping")"
  host_ip="$(extract_host_ip "$mapping")"

  if [[ -z "$host_port" ]]; then
    continue
  fi

  for dbp in "${db_ports[@]}"; do
    if [[ "$host_port" == "$dbp" ]]; then
      if [[ "$host_ip" != "127.0.0.1" ]]; then
        echo "ERROR: Puerto de base de datos $dbp expuesto sin bind local (mapping '$mapping')."
        errors=1
      fi
    fi
  done
done

# Regla: postgres puede publicar solo localhost:5432.
mapfile -t postgres_ports < <(
  awk '
    /^[[:space:]]*postgres:[[:space:]]*$/ { in_postgres=1; next }
    in_postgres && /^[[:space:]]{2}[A-Za-z0-9_-]+:[[:space:]]*$/ && $0 !~ /^[[:space:]]*ports:[[:space:]]*$/ { in_ports=0 }
    in_postgres && /^[^[:space:]]/ { in_postgres=0; in_ports=0 }
    in_postgres && /^[[:space:]]*ports:[[:space:]]*$/ { in_ports=1; next }
    in_postgres && in_ports && /^[[:space:]]*-[[:space:]]*"[^"]+"[[:space:]]*$/ {
      line=$0
      sub(/^[[:space:]]*-[[:space:]]*"/, "", line)
      sub(/"[[:space:]]*$/, "", line)
      print line
      next
    }
    in_postgres && in_ports && !/^[[:space:]]*-[[:space:]]*"[^"]+"[[:space:]]*$/ && !/^[[:space:]]*$/ { in_ports=0 }
  ' "$COMPOSE_FILE"
)

if [[ "${#postgres_ports[@]}" -gt 0 ]]; then
  for pmap in "${postgres_ports[@]}"; do
    if [[ "$pmap" != "127.0.0.1:5432:5432" ]]; then
      echo "ERROR: postgres solo permite ports '127.0.0.1:5432:5432'. Detectado '$pmap'."
      errors=1
    fi
  done
fi

if [[ "$errors" -ne 0 ]]; then
  echo "[FAIL] Preflight VPS: incumplimientos detectados."
  exit 1
fi

echo "[OK] Preflight VPS: reglas de puertos cumplidas."
