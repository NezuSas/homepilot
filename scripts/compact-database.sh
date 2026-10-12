#!/usr/bin/env bash
# Compacts the HomePilot SQLite database: SQLite never returns freed space to the disk by itself, so after a large
# cleanup (for example the activity log) the file keeps its old size. The API is stopped for a minute or two, a compact
# copy is written and verified table by table, and only then is it swapped in. The previous file is kept.
#
#   bash scripts/compact-database.sh          asks before stopping the API
#   bash scripts/compact-database.sh --yes    does not ask
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_CONTAINER="${HOMEPILOT_API_CONTAINER:-homepilot-api}"
DATA_DIR="$ROOT/data"
assume_yes=false
api_stopped=false

for argument in "$@"; do
  case "$argument" in
    --yes) assume_yes=true ;;
    -h|--help) sed -n '2,10p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Opción desconocida: $argument" >&2; exit 2 ;;
  esac
done

restart_api() {
  if [[ "$api_stopped" == true ]]; then
    docker start "$API_CONTAINER" >/dev/null 2>&1 || echo "ATENCIÓN: no se pudo iniciar $API_CONTAINER; ejecuta: docker start $API_CONTAINER" >&2
    api_stopped=false
  fi
}
trap restart_api EXIT

command -v docker >/dev/null 2>&1 || { echo 'Docker no está disponible.' >&2; exit 1; }
[[ -f "$DATA_DIR/homepilot.db" ]] || { echo "No existe $DATA_DIR/homepilot.db" >&2; exit 1; }
image="$(docker inspect "$API_CONTAINER" --format '{{.Config.Image}}' 2>/dev/null)" \
  || { echo "No existe el contenedor $API_CONTAINER." >&2; exit 1; }

free_kb="$(df -Pk "$DATA_DIR" | awk 'NR == 2 { print $4 }')"
if (( free_kb < 2097152 )); then
  echo "Hace falta al menos 2 GB libres junto a la base de datos; hay $((free_kb / 1024)) MB." >&2
  exit 1
fi

echo "Base de datos actual: $(du -h "$DATA_DIR/homepilot.db" | cut -f1)   Espacio libre: $(df -Ph "$DATA_DIR" | awk 'NR == 2 { print $4 }')"
if [[ "$assume_yes" != true ]]; then
  read -r -p "Se detendrá $API_CONTAINER durante 1 o 2 minutos. ¿Continuar? [s/N] " answer
  [[ "$answer" =~ ^[sSyY]$ ]] || { echo 'Cancelado; no se cambió nada.'; exit 0; }
fi

docker stop "$API_CONTAINER" >/dev/null
api_stopped=true

if docker run --rm --user "$(id -u):$(id -g)" -v "$DATA_DIR:/app/data" \
    -v "$ROOT/scripts/lib/compact-sqlite.cjs:/tmp/compact-sqlite.cjs:ro" -w /app "$image" node /tmp/compact-sqlite.cjs; then
  mv "$DATA_DIR/homepilot.db" "$DATA_DIR/homepilot.old.db"
  rm -f "$DATA_DIR/homepilot.db-wal" "$DATA_DIR/homepilot.db-shm"
  mv "$DATA_DIR/homepilot.compact.db" "$DATA_DIR/homepilot.db"
  echo 'INTERCAMBIADO: la base anterior queda en data/homepilot.old.db'
else
  rm -f "$DATA_DIR/homepilot.compact.db"
  echo 'FALLO la verificación: la base original no se tocó.' >&2
  restart_api
  exit 1
fi

restart_api
for _ in $(seq 1 24); do
  state="$(docker inspect "$API_CONTAINER" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
  [[ "$state" == healthy || "$state" == running ]] && break
  sleep 5
done
echo "API: ${state:-desconocido}"
echo "Base de datos nueva: $(du -h "$DATA_DIR/homepilot.db" | cut -f1)   Espacio libre: $(df -Ph "$DATA_DIR" | awk 'NR == 2 { print $4 }')"
echo "Cuando confirmes que todo funciona, libera espacio con: rm data/homepilot.old.db"
