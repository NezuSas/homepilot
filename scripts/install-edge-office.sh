#!/usr/bin/env bash
set -euo pipefail

readonly COMPOSE_FILE="docker-compose.office.yml"
readonly ENV_FILE=".env"
readonly ENV_TEMPLATE=".env.office.example"

clean=false
start=false
assume_yes=false
api_url=""
status_only=false
runtime_failures=0

if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  DIM='\033[2m'
  NC='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  CYAN=''
  BOLD=''
  DIM=''
  NC=''
fi

divider() {
  printf '%b\n' "${DIM}────────────────────────────────────────────────────────────────────────${NC}"
}

banner() {
  if [[ -t 1 ]]; then
    clear
  fi
  printf '%b\n' "${CYAN}${BOLD}"
  printf '%s\n' '   ███╗   ██╗███████╗███████╗██╗   ██╗'
  printf '%s\n' '   ████╗  ██║██╔════╝╚══███╔╝██║   ██║'
  printf '%s\n' '   ██╔██╗ ██║█████╗    ███╔╝ ██║   ██║'
  printf '%s\n' '   ██║╚██╗██║██╔══╝   ███╔╝  ██║   ██║'
  printf '%s\n' '   ██║ ╚████║███████╗███████╗╚██████╔╝'
  printf '%s\n' '   ╚═╝  ╚═══╝╚══════╝╚══════╝ ╚═════╝ '
  printf '%b\n' "${NC}${BOLD}   H O M E P I L O T   E D G E${NC}"
  printf '%b\n' "${BLUE}   Consola de instalación · Home Assistant existente${NC}"
  divider
}

usage() {
  cat <<'EOF'
Uso: bash scripts/install-edge-office.sh [opciones]

Prepara HomePilot en una miniPC que ya tiene Home Assistant. Nunca crea,
detiene ni borra Home Assistant, contenedores existentes, volumenes o datos.

Opciones:
  --clean              Limpia solamente cache de build e imagenes Docker colgantes.
  --start              Construye e inicia los servicios de HomePilot al finalizar.
  --status             Consulta el estado actual sin crear, limpiar ni iniciar servicios.
  --api-url URL        Guarda VITE_API_URL en .env si el archivo se crea.
                       Tunel Cloudflare: http://localhost:13000
                       Red local:       http://IP_DE_LA_MINIPC:3000
  --yes                No pide confirmacion para --clean o --start.
  --help               Muestra esta ayuda.
EOF
}

section() {
  printf '\n%b\n' "${CYAN}${BOLD}▸ $1${NC}"
  divider
}
ok() { printf '%b\n' "${GREEN}●${NC}  $1"; }
warn() { printf '%b\n' "${YELLOW}●${NC}  $1"; }
info() { printf '%b\n' "${BLUE}●${NC}  $1"; }
fail() { printf '%b\n' "${RED}● Error:${NC} $1" >&2; exit 1; }

env_value() {
  local key="$1"
  local fallback="$2"
  local value=""
  if [[ -f "$ENV_FILE" ]]; then
    value="$(sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1)"
  fi
  printf '%s' "${value:-$fallback}"
}

check_container() {
  local container="$1"
  local label="$2"
  local expects_healthcheck="$3"
  local state health

  if ! docker inspect "$container" >/dev/null 2>&1; then
    warn "$label: contenedor no encontrado."
    runtime_failures=$((runtime_failures + 1))
    return
  fi

  IFS='|' read -r state health <<< "$(docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container")"
  if [[ "$state" != "running" ]]; then
    warn "$label: estado $state."
    runtime_failures=$((runtime_failures + 1))
    return
  fi

  if [[ "$expects_healthcheck" == true && "$health" != "healthy" ]]; then
    warn "$label: en ejecución, healthcheck $health."
    runtime_failures=$((runtime_failures + 1))
    return
  fi

  if [[ "$health" == "none" ]]; then
    ok "$label: en ejecución."
  else
    ok "$label: en ejecución y $health."
  fi
}

check_endpoint() {
  local label="$1"
  local url="$2"
  local accepted_status="$3"
  local status_code
  status_code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 6 "$url" || true)"

  if [[ ",$accepted_status," == *",$status_code,"* ]]; then
    ok "$label: responde HTTP $status_code."
  else
    warn "$label: sin respuesta válida en $url (HTTP ${status_code:-000})."
    runtime_failures=$((runtime_failures + 1))
  fi
}

show_runtime_status() {
  local api_port ui_port tts_port stt_port
  api_port="$(env_value HOMEPILOT_API_PORT 3000)"
  ui_port="$(env_value HOMEPILOT_UI_PORT 8080)"
  tts_port="$(env_value HOMEPILOT_TTS_PORT 8088)"
  stt_port="$(env_value HOMEPILOT_STT_PORT 8090)"

  runtime_failures=0
  section "Estado operativo de servicios"
  check_container "homepilot-api" "API HomePilot" true
  check_container "homepilot-ui" "UI HomePilot" false
  check_container "homepilot-ollama" "Ollama" false
  check_container "homepilot-stt" "STT Whisper" true
  check_container "homepilot-tts" "TTS Piper" true

  section "Conectividad de servicios"
  check_endpoint "API HomePilot" "http://127.0.0.1:${api_port}/health" "200"
  check_endpoint "UI HomePilot" "http://127.0.0.1:${ui_port}" "200"
  check_endpoint "STT Whisper" "http://127.0.0.1:${stt_port}/health" "200"
  check_endpoint "TTS Piper" "http://127.0.0.1:${tts_port}/health" "200"
  check_endpoint "Home Assistant existente" "http://127.0.0.1:8123/" "200,301,302,401,403"

  if (( runtime_failures == 0 )); then
    ok "Sistema operativo: todos los servicios verificados correctamente."
  else
    warn "Sistema requiere atención: ${runtime_failures} comprobación(es) falló/fallaron."
    info "Diagnóstico detallado: docker compose -f ${COMPOSE_FILE} logs --tail=100 <servicio>"
  fi
}

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
    --status) status_only=true ;;
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

if [[ "$status_only" == true && ( "$clean" == true || "$start" == true || -n "$api_url" ) ]]; then
  fail "--status no se combina con --clean, --start ni --api-url."
fi

[[ -f "$COMPOSE_FILE" ]] || fail "Ejecuta el script desde la raiz del repositorio HomePilot."
[[ -f "$ENV_TEMPLATE" ]] || fail "No existe $ENV_TEMPLATE."
command -v docker >/dev/null 2>&1 || fail "Docker no esta instalado o no esta disponible para este usuario."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 no esta disponible."

banner
info "Directorio de instalación: $(pwd)"
info "Compose de cliente: $COMPOSE_FILE · Home Assistant no se gestiona aquí"

if [[ "$status_only" == true ]]; then
  show_runtime_status
  if (( runtime_failures > 0 )); then
    exit 1
  fi
  exit 0
fi

section "Diagnóstico de espacio"
df -h .
docker system df || warn "No se pudo consultar el uso de Docker."

section "Home Assistant del cliente · solo lectura"
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

section "Puertos requeridos por HomePilot"
for port in 3000 8080 8088 8090 11434; do
  if ss -ltn 2>/dev/null | grep -q ":${port} "; then
    warn "Puerto ${port} ya esta ocupado; ajusta HOMEPILOT_*_PORT en .env si no pertenece a HomePilot."
  else
    ok "Puerto ${port} disponible."
  fi
done

if [[ "$clean" == true ]]; then
  section "Limpieza segura de Docker"
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

section "Configuración de entorno"
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

if [[ "$start" == true ]]; then
  section "Inicio de HomePilot"
  if confirm "Se construiran e iniciaran los servicios HomePilot de este compose. Continuar?"; then
    docker compose -f "$COMPOSE_FILE" up --build -d
    docker compose -f "$COMPOSE_FILE" ps
  else
    warn "Inicio omitido por el operador."
  fi
fi

show_runtime_status

section "Instalación preparada"
ui_port="$(env_value HOMEPILOT_UI_PORT 8080)"
api_port="$(env_value HOMEPILOT_API_PORT 3000)"
printf '%b\n' "${BOLD}  HomePilot UI${NC}       http://127.0.0.1:${ui_port}"
printf '%b\n' "${BOLD}  HomePilot API${NC}      http://127.0.0.1:${api_port}/health"
printf '%b\n' "${BOLD}  Home Assistant${NC}     http://127.0.0.1:8123 ${DIM}(existente, preservado)${NC}"
printf '%b\n' "${BOLD}  Compose${NC}            ${COMPOSE_FILE} ${DIM}(sin servicio homeassistant)${NC}"
printf '%b\n' "${DIM}  Inicio manual: docker compose -f ${COMPOSE_FILE} up --build -d${NC}"
divider
