#!/usr/bin/env bash
set -euo pipefail

profile="bridge_ha"
compose_file="docker-compose.office.yml"
compose_files=()
compose_explicit=false
keep_storage="2GB"
deploy=false
clean_only=false
status_only=false
assume_yes=false
truncate_logs=false
runtime_failures=0

if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  BOLD='\033[1m'
  DIM='\033[2m'
  NC='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  BOLD=''
  DIM=''
  NC=''
fi

usage() {
  cat <<'EOF'
Uso: bash scripts/homepilot-maintenance.sh [opciones]

Mantiene una instalacion HomePilot en miniPC sin dejar residuos de compilacion
de Docker. No borra volumenes ni bases de datos.

Opciones:
  --deploy                 Limpia cache, construye/inicia HomePilot y limpia otra vez.
  --clean                  Solo limpia residuos seguros de Docker.
  --status                 Muestra espacio, contenedores y salud de servicios sin modificar nada.
  --profile PERFIL         bridge_ha (defecto), native_only o ha_companion.
  --compose FILE           Compose personalizado. Sobrescribe la selección automática de runtime.
  --keep-storage SIZE      Cache maximo para BuildKit/buildx. Default: 2GB
  --truncate-logs          Vacia logs json de Docker. Puede pedir sudo.
  --yes                    No pide confirmacion.
  --help                   Muestra esta ayuda.

Ejemplos:
  bash scripts/homepilot-maintenance.sh --profile bridge_ha --deploy --yes
  bash scripts/homepilot-maintenance.sh --profile native_only --deploy --yes
  bash scripts/homepilot-maintenance.sh --clean --keep-storage 1GB --yes
  bash scripts/homepilot-maintenance.sh --status
EOF
}

is_docker_desktop() {
  local operating_system
  operating_system="$(docker info --format '{{.OperatingSystem}}' 2>/dev/null || true)"
  [[ "$operating_system" =~ [Dd]ocker[[:space:]][Dd]esktop ]]
}

configure_profile() {
  case "$profile" in
    bridge_ha|native_only)
      [[ "$compose_explicit" == true ]] || compose_file="docker-compose.office.yml"
      ;;
    ha_companion)
      [[ "$compose_explicit" == true ]] || compose_file="docker-compose.yml"
      ;;
    *)
      fail "Perfil no válido: ${profile}. Usa bridge_ha, native_only o ha_companion."
      ;;
  esac

  compose_files=("$compose_file")
  if [[ "$compose_explicit" == false ]] && is_docker_desktop; then
    case "$profile" in
      bridge_ha|native_only)
        compose_files=("docker-compose.office.yml" "docker-compose.desktop.yml")
        ;;
      ha_companion)
        compose_files=("docker-compose.yml" "docker-compose.ha-companion.desktop.yml")
        ;;
    esac
  fi
}

banner() {
  printf '%b\n' "${BLUE}${BOLD}"
  printf '%s\n' '   _   _ _____ _____ _   _'
  printf '%s\n' '  | \ | | ____|__  /| | | |'
  printf '%s\n' '  |  \| |  _|   / / | | | |'
  printf '%s\n' '  | |\  | |___ / /_ | |_| |'
  printf '%s\n' '  |_| \_|_____/____| \___/'
  printf '%b\n' "${NC}${BOLD}   H O M E P I L O T   M A I N T E N A N C E${NC}"
  printf '%b\n' "${DIM}   Perfil ${profile} · limpieza segura de buildx, imágenes y contenedores detenidos${NC}"
  divider
}

divider() {
  printf '%b\n' "${DIM}------------------------------------------------------------------------${NC}"
}

section() {
  printf '\n%b\n' "${BOLD}$1${NC}"
  divider
}

ok() {
  printf '%b\n' "${GREEN}OK${NC}  $1"
}

warn() {
  printf '%b\n' "${YELLOW}WARN${NC} $1"
}

info() {
  printf '%b\n' "${BLUE}INFO${NC} $1"
}

fail() {
  printf '%b\n' "${RED}ERROR${NC} $1" >&2
  exit 1
}

confirm() {
  local message="$1"
  if [[ "$assume_yes" == true ]]; then
    return 0
  fi

  read -r -p "${message} [y/N]: " answer
  [[ "$answer" == "y" || "$answer" == "Y" || "$answer" == "yes" || "$answer" == "YES" ]]
}

run_if_available() {
  local label="$1"
  shift

  if "$@"; then
    ok "$label"
  else
    warn "$label no se pudo completar. Revisa permisos o estado de Docker."
  fi
}

show_disk() {
  section "Espacio disponible"
  df -h .

  if command -v docker >/dev/null 2>&1; then
    section "Uso de Docker"
    docker system df || warn "Docker no respondio a docker system df."
  fi
}

check_requirements() {
  command -v docker >/dev/null 2>&1 || fail "Docker no esta instalado o no esta en PATH."
  docker version >/dev/null 2>&1 || fail "Docker no responde. Verifica que el daemon este activo."
  docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 no esta disponible."
  local file
  for file in "${compose_files[@]}"; do
    [[ -f "$file" ]] || fail "No existe ${file} en el directorio actual."
  done
}

validate_profile_environment() {
  [[ -f .env ]] || fail "No existe .env. Ejecuta primero scripts/install-edge-office.sh con el perfil deseado."

  local configured_profile
  configured_profile="$(sed -n 's/^HOMEPILOT_INSTALLATION_PROFILE=//p' .env | tail -n 1)"
  configured_profile="${configured_profile:-bridge_ha}"
  configured_profile="${configured_profile%$'\r'}"

  [[ "$configured_profile" == "$profile" ]] || fail ".env declara el perfil ${configured_profile}; ejecuta este comando con --profile ${configured_profile}."
}
env_value() {
  local key="$1"
  local fallback="$2"
  local value

  value="$(sed -n "s/^${key}=//p" .env | tail -n 1)"
  value="${value%$'\r'}"
  printf '%s' "${value:-$fallback}"
}

compose_args() {
  local file
  for file in "${compose_files[@]}"; do
    printf '%s\n' '-f' "$file"
  done
}

check_container() {
  local service="$1"
  local label="$2"
  local -a args=()

  mapfile -t args < <(compose_args)
  if docker compose "${args[@]}" ps --status running -q "$service" | grep -q '.'; then
    ok "${label} en ejecución."
  else
    warn "${label} no está en ejecución."
    runtime_failures=$((runtime_failures + 1))
  fi
}

check_endpoint() {
  local label="$1"
  local url="$2"
  local expected_codes="$3"
  local status_code

  status_code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "$url" || true)"
  if [[ ",$expected_codes," == *",$status_code,"* ]]; then
    ok "${label} responde (HTTP ${status_code})."
  else
    warn "${label} no responde como se esperaba (HTTP ${status_code:-000})."
    runtime_failures=$((runtime_failures + 1))
  fi
}

verify_runtime_once() {
  local api_port ui_port stt_port tts_port ha_port

  api_port="$(env_value HOMEPILOT_API_PORT 3000)"
  if is_docker_desktop && [[ "$api_port" == "3000" ]]; then
    api_port="13000"
  fi
  ui_port="$(env_value HOMEPILOT_UI_PORT 8080)"
  stt_port="$(env_value HOMEPILOT_STT_PORT 8090)"
  tts_port="$(env_value HOMEPILOT_TTS_PORT 8088)"
  ha_port="$(env_value HOMEPILOT_HOME_ASSISTANT_PORT 8123)"

  runtime_failures=0
  check_container "homepilot-api" "API HomePilot"
  check_container "homepilot-ui" "UI HomePilot"
  check_container "ollama" "Ollama"
  check_container "homepilot-stt" "STT Whisper"
  check_container "homepilot-tts" "TTS Piper"
  check_endpoint "API HomePilot · puerto ${api_port}" "http://127.0.0.1:${api_port}/health" "200"
  check_endpoint "UI HomePilot · puerto ${ui_port}" "http://127.0.0.1:${ui_port}" "200"
  check_endpoint "STT Whisper · puerto ${stt_port}" "http://127.0.0.1:${stt_port}/health" "200"
  check_endpoint "TTS Piper · puerto ${tts_port}" "http://127.0.0.1:${tts_port}/health" "200"

  if [[ "$profile" == "bridge_ha" ]]; then
    check_endpoint "Home Assistant existente · puerto ${ha_port}" "http://127.0.0.1:${ha_port}/" "200,301,302,401,403"
  fi
}

verify_runtime() {
  local timeout_seconds="${1:-0}"
  local elapsed=0

  section "Verificación operativa"
  while true; do
    verify_runtime_once
    if (( runtime_failures == 0 )); then
      ok "Instalación saludable: todos los servicios requeridos respondieron."
      return 0
    fi

    if (( elapsed >= timeout_seconds )); then
      warn "La instalación requiere atención: ${runtime_failures} comprobación(es) no está(n) saludable(s)."
      return 1
    fi

    info "Esperando servicios: ${elapsed}/${timeout_seconds}s."
    sleep 5

    elapsed=$((elapsed + 5))
  done
}
clean_docker_residue() {
  section "Limpieza segura de residuos Docker"
  info "BuildKit/buildx conservara hasta ${keep_storage} de cache util."
  run_if_available "Cache de buildx/BuildKit limpiado" docker builder prune -af --keep-storage "$keep_storage"
  run_if_available "Imagenes Docker no usadas eliminadas" docker image prune -af
  run_if_available "Contenedores detenidos eliminados" docker container prune -f
  run_if_available "Redes Docker no usadas eliminadas" docker network prune -f

  if [[ "$truncate_logs" == true ]]; then
    section "Limpieza de logs Docker"
    if confirm "Esto vaciara logs json de Docker, sin borrar contenedores ni volumenes. Continuar?"; then
      if command -v sudo >/dev/null 2>&1; then
        sudo find /var/lib/docker/containers -name '*-json.log' -type f -exec truncate -s 0 {} \; \
          && ok "Logs json de Docker truncados"
      else
        find /var/lib/docker/containers -name '*-json.log' -type f -exec truncate -s 0 {} \; \
          && ok "Logs json de Docker truncados"
      fi
    else
      warn "Limpieza de logs omitida."
    fi
  fi
}

deploy_homepilot() {
  section "Despliegue HomePilot"
  info "Compose: ${compose_files[*]}"
  info "Perfil: ${profile}"
  info "COMPOSE_BAKE=false evita que Compose use bake si no hace falta."

  local max_attempts=3
  local attempt=1
  local retry_delay=10
  local compose_args=()
  local file

  for file in "${compose_files[@]}"; do
    compose_args+=( -f "$file" )
  done

  while (( attempt <= max_attempts )); do
    info "Construcción e inicio: intento ${attempt}/${max_attempts}."
    if COMPOSE_BAKE=false docker compose "${compose_args[@]}" up -d --build; then
      ok "HomePilot construido e iniciado."
      break
    fi

    if (( attempt == max_attempts )); then
      fail "Docker no pudo descargar o construir las imágenes después de ${max_attempts} intentos. Verifica la conexión a Docker Hub e inténtalo más tarde."
    fi

    warn "El despliegue falló. Puede ser un error temporal de Docker Hub; se reintentará en ${retry_delay}s."
    sleep "$retry_delay"
    attempt=$((attempt + 1))
    retry_delay=$((retry_delay * 2))
  done

  docker compose "${compose_args[@]}" ps
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy)
      deploy=true
      ;;
    --profile)
      shift
      [[ $# -gt 0 ]] || fail "--profile requiere bridge_ha, native_only o ha_companion."
      profile="$1"
      ;;
    --clean)
      clean_only=true
      ;;
    --status)
      status_only=true
      ;;
    --compose)
      shift
      [[ $# -gt 0 ]] || fail "--compose requiere un archivo."
      compose_file="$1"
      compose_explicit=true
      ;;
    --keep-storage)
      shift
      [[ $# -gt 0 ]] || fail "--keep-storage requiere un valor, por ejemplo 2GB."
      keep_storage="$1"
      ;;
    --truncate-logs)
      truncate_logs=true
      ;;
    --yes)
      assume_yes=true
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      fail "Opcion no reconocida: $1"
      ;;
  esac
  shift
done

if [[ "$deploy" == false && "$clean_only" == false && "$status_only" == false ]]; then
  status_only=true
fi

configure_profile
banner
check_requirements
validate_profile_environment
show_disk

if [[ "$status_only" == true ]]; then
  verify_runtime
  exit 0
fi

if [[ "$clean_only" == true && "$deploy" == false ]]; then
  if confirm "Limpiar residuos seguros de Docker ahora?"; then
    clean_docker_residue
    show_disk
  else
    warn "Limpieza cancelada."
  fi
  exit 0
fi

if [[ "$deploy" == true ]]; then
  if confirm "Limpiar, construir e iniciar HomePilot ahora?"; then
    clean_docker_residue
    deploy_homepilot
    clean_docker_residue
    show_disk
    verify_runtime 180
  else
    warn "Despliegue cancelado."
  fi
fi
