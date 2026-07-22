#!/usr/bin/env bash
set -euo pipefail

readonly ENV_FILE=".env"
profile="bridge_ha"
compose_file="docker-compose.office.yml"
env_template=".env.office.example"
ha_port="8123"
ha_management_label="existente, preservado"
requires_home_assistant=true

clean=false
start=false
assume_yes=false
api_url=""
status_only=false
runtime_failures=0
startup_failed=false

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

configure_profile() {
  case "$profile" in
    bridge_ha)
      compose_file="docker-compose.office.yml"
      env_template=".env.office.example"
      ha_port="8123"
      ha_management_label="existente, preservado"
      requires_home_assistant=true
      ;;
    native_only)
      compose_file="docker-compose.office.yml"
      env_template=".env.native.example"
      ha_port=""
      ha_management_label="no requerido"
      requires_home_assistant=false
      ;;
    ha_companion)
      compose_file="docker-compose.yml"
      env_template=".env.example"
      ha_port="18123"
      ha_management_label="companion administrado por este compose"
      requires_home_assistant=true
      ;;
    *) fail "Perfil no válido: ${profile}. Usa bridge_ha, native_only o ha_companion." ;;
  esac
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
  printf '%b\n' "${BLUE}   Consola de instalación · Perfil ${profile}${NC}"
  divider
}

usage() {
  cat <<'EOF'
Uso: bash scripts/install-edge-office.sh [opciones]

Prepara HomePilot con un perfil de instalación explícito.

Opciones:
  --profile PERFIL      bridge_ha (defecto), native_only o ha_companion.
                       bridge_ha conserva HA existente; native_only no exige HA;
                       ha_companion inicia el HA incluido en docker-compose.yml.
  --clean              Limpia solamente cache de build e imagenes Docker colgantes.
  --start              Construye e inicia los servicios de HomePilot al finalizar.
  --status             Consulta el estado actual sin crear, limpiar ni iniciar servicios.
  --api-url URL        Configuracion avanzada para una API en otro origen.
                       Por defecto se deja vacia y UI/API usan el mismo dominio.
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

container_ready() {
  local container="$1"
  local expects_healthcheck="$2"
  local state health

  if ! docker inspect "$container" >/dev/null 2>&1; then
    return 1
  fi

  IFS='|' read -r state health <<< "$(docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container")"
  [[ "$state" == "running" ]] || return 1

  if [[ "$expects_healthcheck" == true ]]; then
    [[ "$health" == "healthy" ]] || return 1
  fi

  return 0
}

wait_for_runtime_ready() {
  local timeout_seconds interval_seconds elapsed
  timeout_seconds="$(env_value HOMEPILOT_STARTUP_TIMEOUT_SECONDS 180)"
  interval_seconds=5
  elapsed=0

  section "Espera de salud de HomePilot"
  info "Esperando servicios saludables hasta ${timeout_seconds}s..."

  while (( elapsed <= timeout_seconds )); do
    if container_ready "homepilot-api" true \
      && container_ready "homepilot-ui" false \
      && container_ready "homepilot-ollama" false \
      && container_ready "homepilot-stt" true \
      && container_ready "homepilot-tts" true; then
      ok "Servicios HomePilot listos."
      return 0
    fi

    sleep "$interval_seconds"
    elapsed=$((elapsed + interval_seconds))
  done

  warn "Timeout esperando servicios saludables. Revisa el detalle con docker compose logs."
  return 1
}

show_runtime_status() {
  local api_port ui_port ollama_port tts_port stt_port
  api_port="$(env_value HOMEPILOT_API_PORT 3000)"
  ui_port="$(env_value HOMEPILOT_UI_PORT 8080)"
  ollama_port="$(env_value HOMEPILOT_OLLAMA_PORT 11434)"
  tts_port="$(env_value HOMEPILOT_TTS_PORT 8088)"
  stt_port="$(env_value HOMEPILOT_STT_PORT 8090)"

  runtime_failures=0
  section "Estado operativo de servicios"
  check_container "homepilot-api" "API HomePilot · puerto ${api_port}" true
  check_container "homepilot-ui" "UI HomePilot · puerto ${ui_port}" false
  check_container "homepilot-ollama" "Ollama · puerto ${ollama_port}" false
  check_container "homepilot-stt" "STT Whisper · puerto ${stt_port}" true
  check_container "homepilot-tts" "TTS Piper · puerto ${tts_port}" true

  section "Conectividad de servicios"
  check_endpoint "API HomePilot · puerto ${api_port}" "http://127.0.0.1:${api_port}/health" "200"
  check_endpoint "UI HomePilot · puerto ${ui_port}" "http://127.0.0.1:${ui_port}" "200"
  check_endpoint "STT Whisper · puerto ${stt_port}" "http://127.0.0.1:${stt_port}/health" "200"
  check_endpoint "TTS Piper · puerto ${tts_port}" "http://127.0.0.1:${tts_port}/health" "200"
  if [[ "$requires_home_assistant" == true ]]; then
    check_endpoint "Home Assistant · puerto ${ha_port}" "http://127.0.0.1:${ha_port}/" "200,301,302,401,403"
  else
    ok "Home Assistant: no requerido por el perfil native_only."
  fi

  if (( runtime_failures == 0 )); then
    ok "Sistema operativo: todos los servicios verificados correctamente."
  else
    warn "Sistema requiere atención: ${runtime_failures} comprobación(es) falló/fallaron."
    info "Diagnóstico detallado: docker compose -f ${compose_file} logs --tail=100 <servicio>"
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
    --profile)
      shift
      [[ $# -gt 0 ]] || fail "--profile requiere un perfil."
      profile="$1"
      ;;
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

configure_profile
[[ -f "$compose_file" ]] || fail "Ejecuta el script desde la raiz del repositorio HomePilot."
[[ -f "$env_template" ]] || fail "No existe $env_template."
command -v docker >/dev/null 2>&1 || fail "Docker no esta instalado o no esta disponible para este usuario."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 no esta disponible."

banner
info "Directorio de instalación: $(pwd)"
info "Compose: $compose_file · Home Assistant: $ha_management_label"

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

if [[ "$requires_home_assistant" == true ]]; then
  section "Home Assistant · solo lectura"
  ha_container="$(docker ps -a --format '{{.Names}}' | grep -Fx 'homeassistant' || true)"
  if [[ -n "$ha_container" ]]; then
    ha_status="$(docker inspect --format '{{.State.Status}}' homeassistant 2>/dev/null || true)"
    ok "Contenedor homeassistant detectado (estado: ${ha_status:-desconocido})."
  else
    warn "No se encontró un contenedor llamado homeassistant."
  fi

  ha_status_code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "http://127.0.0.1:${ha_port}/" || true)"
  if [[ "$ha_status_code" != "000" && -n "$ha_status_code" ]]; then
    ok "Home Assistant responde en http://127.0.0.1:${ha_port} (HTTP $ha_status_code)."
  else
    warn "No hubo respuesta HTTP en 127.0.0.1:${ha_port}. Verifica la URL local antes del onboarding."
  fi
else
  section "Perfil nativo"
  ok "No se requiere Home Assistant. Las integraciones se añaden desde HomePilot."
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
  cp "$env_template" "$ENV_FILE"
  if [[ -n "$api_url" ]]; then
    sed -i "s#^VITE_API_URL=.*#VITE_API_URL=${api_url}#" "$ENV_FILE"
  fi
  ok ".env creado desde $env_template."
fi

configured_profile="$(env_value HOMEPILOT_INSTALLATION_PROFILE '')"
if [[ "$configured_profile" != "$profile" ]]; then
  fail ".env declara ${configured_profile:-ningún perfil}; ajusta HOMEPILOT_INSTALLATION_PROFILE=${profile} antes de continuar."
fi
ok "Perfil de instalación configurado: ${profile}."

if [[ "$profile" == bridge_ha ]]; then
  grep -q '^INTERNAL_HA_URL=http://host.docker.internal:8123$' "$ENV_FILE" \
    && ok "INTERNAL_HA_URL apunta al Home Assistant existente del host." \
    || warn "Revisa INTERNAL_HA_URL en .env para que apunte al Home Assistant real del cliente."
fi

mkdir -p data backups
docker compose -f "$compose_file" config --quiet
if [[ "$profile" == ha_companion ]]; then
  ok "Compose companion válido: administra Home Assistant junto a HomePilot."
else
  ok "Compose válido: no declara un servicio Home Assistant."
fi

if [[ "$start" == true ]]; then
  section "Inicio de HomePilot"
  if confirm "Se construiran e iniciaran los servicios HomePilot de este compose. Continuar?"; then
    docker compose -f "$compose_file" up --build -d
    docker compose -f "$compose_file" ps
    if ! wait_for_runtime_ready; then
      startup_failed=true
    fi
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
if [[ "$requires_home_assistant" == true ]]; then
  printf '%b\n' "${BOLD}  Home Assistant${NC}     http://127.0.0.1:${ha_port} ${DIM}(${ha_management_label})${NC}"
else
  printf '%b\n' "${BOLD}  Home Assistant${NC}     ${DIM}(no requerido por native_only)${NC}"
fi
printf '%b\n' "${BOLD}  Compose${NC}            ${compose_file} ${DIM}(${profile})${NC}"
printf '%b\n' "${DIM}  Inicio manual: docker compose -f ${compose_file} up --build -d${NC}"
divider

if [[ "$start" == true && ( "$startup_failed" == true || "$runtime_failures" -gt 0 ) ]]; then
  exit 1
fi
