#!/usr/bin/env bash
set -euo pipefail

readonly COMPOSE_FILE="docker-compose.office.yml"
readonly ENV_FILE=".env"
readonly ENV_TEMPLATE=".env.office.example"

clean=false
start=false
assume_yes=false
api_url=""

usage() {
  cat <<'EOF'
Uso: bash scripts/install-edge-office.sh [opciones]

Prepara HomePilot en una miniPC que ya tiene Home Assistant. Nunca crea,
detiene ni borra Home Assistant, contenedores existentes, volumenes o datos.

Opciones:
  --clean              Limpia solamente cache de build e imagenes Docker colgantes.
  --start              Construye e inicia los servicios de HomePilot al finalizar.
  --api-url URL        Guarda VITE_API_URL en .env si el archivo se crea.
                       Tunel Cloudflare: http://localhost:13000
                       Red local:       http://IP_DE_LA_MINIPC:3000
  --yes                No pide confirmacion para --clean o --start.
  --help               Muestra esta ayuda.
EOF
}

log() { printf '\n== %s ==\n' "$1"; }
ok() { printf 'OK   %s\n' "$1"; }
warn() { printf 'WARN %s\n' "$1"; }
fail() { printf 'ERROR %s\n' "$1" >&2; exit 1; }

confirm() {
  local prompt="$1"
  if [[ "$assume_yes" == true ]]; then
    return 0
  fi
  local answer
  read -r -p "$prompt [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean) clean=true ;;
    --start) start=true ;;
    --yes) assume_yes=true ;;
    --api-url)
      shift
      [[ $# -gt 0 ]] || fail "--api-url necesita una URL."
      api_url="$1"
      ;;
    --help) usage; exit 0 ;;
    *) fail "Opcion desconocida: $1. Usa --help." ;;
  esac
  shift
done

[[ -f "$COMPOSE_FILE" ]] || fail "Ejecuta el script desde la raiz del repositorio HomePilot."
[[ -f "$ENV_TEMPLATE" ]] || fail "No existe $ENV_TEMPLATE."
command -v docker >/dev/null 2>&1 || fail "Docker no esta instalado o no esta disponible para este usuario."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 no esta disponible."

log "Diagnostico de espacio"
df -h .
docker system df || warn "No se pudo consultar el uso de Docker."

log "Home Assistant del cliente (solo lectura)"
ha_container="$(docker ps -a --format '{{.Names}}' | grep -Fx 'homeassistant' || true)"
if [[ -n "$ha_container" ]]; then
  ha_status="$(docker inspect --format '{{.State.Status}}' homeassistant 2>/dev/null || true)"
  ok "Contenedor homeassistant detectado (estado: ${ha_status:-desconocido}). No sera modificado."
else
  warn "No se encontro un contenedor llamado homeassistant."
fi

ha_status_code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 http://127.0.0.1:8123/ || true)"
if [[ "$ha_status_code" != "000" && -n "$ha_status_code" ]]; then
  ok "Home Assistant responde en http://127.0.0.1:8123 (HTTP $ha_status_code)."
else
  warn "No hubo respuesta HTTP en 127.0.0.1:8123. Verifica la URL local antes del onboarding."
fi

log "Puertos requeridos por HomePilot"
for port in 3000 8080 8088 8090 11434; do
  if ss -ltn 2>/dev/null | grep -q ":${port} "; then
    warn "Puerto ${port} ya esta ocupado; ajusta HOMEPILOT_*_PORT en .env si no pertenece a HomePilot."
  else
    ok "Puerto ${port} disponible."
  fi
done

if [[ "$clean" == true ]]; then
  log "Limpieza segura de Docker"
  if confirm "Se eliminaran solo cache de build e imagenes colgantes. Continuar?"; then
    docker builder prune -f
    docker image prune -f
    ok "Limpieza segura terminada."
    docker system df || true
  else
    warn "Limpieza omitida por el operador."
  fi
else
  warn "Limpieza no ejecutada. Usa --clean para habilitarla."
fi

log "Configuracion de entorno"
if [[ -f "$ENV_FILE" ]]; then
  ok ".env ya existe y se conserva sin cambios."
else
  cp "$ENV_TEMPLATE" "$ENV_FILE"
  if [[ -n "$api_url" ]]; then
    sed -i "s#^VITE_API_URL=.*#VITE_API_URL=${api_url}#" "$ENV_FILE"
  fi
  ok ".env creado desde $ENV_TEMPLATE."
fi

grep -q '^INTERNAL_HA_URL=http://host.docker.internal:8123$' "$ENV_FILE" \
  && ok "INTERNAL_HA_URL apunta al Home Assistant existente del host." \
  || warn "Revisa INTERNAL_HA_URL en .env para que apunte al Home Assistant real del cliente."

mkdir -p data backups
docker compose -f "$COMPOSE_FILE" config --quiet
ok "Compose de cliente valido: no declara un servicio Home Assistant."

env_value() {
  local key="$1"
  local fallback="$2"
  local value
  value="$(sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1)"
  printf '%s' "${value:-$fallback}"
}

if [[ "$start" == true ]]; then
  log "Inicio de HomePilot"
  if confirm "Se construiran e iniciaran los servicios HomePilot de este compose. Continuar?"; then
    docker compose -f "$COMPOSE_FILE" up --build -d
    docker compose -f "$COMPOSE_FILE" ps
  else
    warn "Inicio omitido por el operador."
  fi
fi

log "Resumen"
ui_port="$(env_value HOMEPILOT_UI_PORT 8080)"
api_port="$(env_value HOMEPILOT_API_PORT 3000)"
echo "HomePilot UI:  http://127.0.0.1:${ui_port}"
echo "HomePilot API: http://127.0.0.1:${api_port}/health"
echo "Home Assistant del cliente: http://127.0.0.1:8123"
echo "Compose: $COMPOSE_FILE (sin servicio homeassistant)"
echo "Para arrancar: docker compose -f $COMPOSE_FILE up --build -d"
