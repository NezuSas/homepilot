#!/usr/bin/env bash
set -euo pipefail

profile="bridge_ha"
compose_file="docker-compose.office.yml"
compose_explicit=false
keep_storage="2GB"
deploy=false
clean_only=false
status_only=false
assume_yes=false
truncate_logs=false

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
  --status                 Solo muestra espacio y consumo de Docker.
  --profile PERFIL         bridge_ha (defecto), native_only o ha_companion.
  --compose FILE           Compose personalizado. Sobrescribe el compose del perfil.
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
  [[ -f "$compose_file" ]] || fail "No existe ${compose_file} en el directorio actual."
}

validate_profile_environment() {
  [[ -f .env ]] || fail "No existe .env. Ejecuta primero scripts/install-edge-office.sh con el perfil deseado."

  local configured_profile
  configured_profile="$(sed -n 's/^HOMEPILOT_INSTALLATION_PROFILE=//p' .env | tail -n 1)"
  configured_profile="${configured_profile:-bridge_ha}"

  [[ "$configured_profile" == "$profile" ]] || fail ".env declara el perfil ${configured_profile}; ejecuta este comando con --profile ${configured_profile}."
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
  info "Compose: ${compose_file}"
  info "Perfil: ${profile}"
  info "COMPOSE_BAKE=false evita que Compose use bake si no hace falta."
  COMPOSE_BAKE=false docker compose -f "$compose_file" up -d --build
  docker compose -f "$compose_file" ps
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
  else
    warn "Despliegue cancelado."
  fi
fi
