#!/usr/bin/env bash
# shellcheck source=/dev/null
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/brand.sh"
set -euo pipefail
readonly HOMEPILOT_MAINTENANCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HOMEPILOT_MAINTENANCE_ROOT"
source "$HOMEPILOT_MAINTENANCE_ROOT/scripts/lib/camera-acceleration.sh"
source "$HOMEPILOT_MAINTENANCE_ROOT/scripts/lib/appliance-storage-report.sh"
source "$HOMEPILOT_MAINTENANCE_ROOT/scripts/lib/homepilot-builder.sh"
source "$HOMEPILOT_MAINTENANCE_ROOT/scripts/lib/homepilot-images.sh"
source "$HOMEPILOT_MAINTENANCE_ROOT/scripts/lib/android-display-appliance.sh"
source "$HOMEPILOT_MAINTENANCE_ROOT/scripts/lib/api-health.sh"
source "$HOMEPILOT_MAINTENANCE_ROOT/scripts/lib/homepilot-runtime-preservation.sh"
source "$HOMEPILOT_MAINTENANCE_ROOT/scripts/lib/homepilot-terminal-ui.sh"

profile="bridge_ha"
compose_file="docker-compose.office.yml"
compose_files=()
compose_explicit=false
profile_explicit=false
deploy=false
clean_only=false
status_only=false
gc_homepilot=false
assume_yes=false
truncate_logs=false
runtime_failures=0
global_installer_v1=false
home_chat_enabled=true
voice_enabled=true
camera_enabled=true
mqtt_enabled=false
tpm_enabled=false

hp_color_init
trap 'hp_ui_shutdown' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
RED="$HP_RED" GREEN="$HP_GREEN" YELLOW="$HP_YELLOW" BLUE="$HP_AMBER"
BOLD="$HP_BOLD" DIM="$HP_DIM" NC="$HP_RESET"

usage() {
  cat <<EOF
Uso: bash scripts/homepilot-maintenance.sh [opciones]

Mantiene una instalación ${HP_BRAND} en miniPC sin tocar recursos de otros proyectos Docker.
No borra volúmenes ni bases de datos. RECLAIMABLE es una cifra global de Docker.

Opciones:
  --deploy                 Construye/inicia ${HP_BRAND} y retira solo contenedores detenidos del proyecto.
  --clean                  Retira solo contenedores detenidos del proyecto ${HP_BRAND}.
  --status                 Muestra uso del filesystem y Docker, contenedores y salud sin modificar nada.
  --gc-homepilot           Previsualiza y, tras confirmar, elimina solo imágenes antiguas ${HP_BRAND} verificadas.
  --profile PERFIL         bridge_ha (defecto), native_only o ha_companion.
  --compose FILE           Compose personalizado. Sobrescribe la selección automática de runtime.
  --truncate-logs          Vacía únicamente logs de contenedores ${HP_BRAND}. Puede pedir sudo.
  --yes                    No pide confirmacion.
  --help                   Muestra esta ayuda.

Ejemplos:
  bash scripts/homepilot-maintenance.sh --profile bridge_ha --deploy --yes
  bash scripts/homepilot-maintenance.sh --profile native_only --deploy --yes
  bash scripts/homepilot-maintenance.sh --status
EOF
}

is_docker_desktop() {
  local operating_system
  operating_system="$(docker info --format '{{.OperatingSystem}}' 2>/dev/null || true)"
  [[ "$operating_system" =~ [Dd]ocker[[:space:]][Dd]esktop ]]
}
load_saved_profile() {
  if [[ "$profile_explicit" == true || ! -f .env ]]; then
    return
  fi

  local saved_profile
  saved_profile="$(sed -n 's/^HOMEPILOT_INSTALLATION_PROFILE=//p' .env | tail -n 1)"
  saved_profile="${saved_profile%$'\r'}"

  case "$saved_profile" in
    bridge_ha|native_only|ha_companion)
      profile="$saved_profile"
      ;;
    '')
      ;;
    *)
      warn ".env declara un perfil no válido (${saved_profile}); se usará bridge_ha."
      ;;
  esac
}

load_installer_capabilities() {
  [[ -f .env ]] || return 0
  if [[ "$(env_value HOMEPILOT_GLOBAL_INSTALLER_VERSION '')" == v1 ]]; then
    global_installer_v1=true
    home_chat_enabled="$(env_value HOMEPILOT_HOME_CHAT_ENABLED true)"
    voice_enabled="$(env_value HOMEPILOT_VOICE_ENABLED true)"
    camera_enabled="$(env_value HOMEPILOT_CAMERA_ENABLED true)"
    mqtt_enabled="$(env_value HOMEPILOT_MQTT_ENABLED false)"
    for value in "$home_chat_enabled" "$voice_enabled" "$camera_enabled" "$mqtt_enabled" "$tpm_enabled"; do
      [[ "$value" == true || "$value" == false ]] || fail 'Capacidad del instalador inválida en .env.'
    done
    # Voice needs the chat: a hand-edited .env cannot turn voice on without it.
    [[ "$home_chat_enabled" == true ]] || voice_enabled=false
  fi
  tpm_enabled="$(env_value HOMEPILOT_TPM_ENABLED "$global_installer_v1")"
  [[ "$tpm_enabled" == true || "$tpm_enabled" == false ]] || fail 'Capacidad TPM inválida en .env.'
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

  if [[ "$compose_explicit" == false && "$profile" == "bridge_ha" && -f data/mqtt/passwordfile && -f docker-compose.pc-agents.yml ]]; then
    if [[ "$global_installer_v1" != true ]]; then compose_files+=("docker-compose.pc-agents.yml"); fi
  fi
  if [[ "$global_installer_v1" == true ]]; then
    if [[ "$mqtt_enabled" == true ]]; then
      if [[ "$profile" == ha_companion ]]; then
        compose_files+=("docker-compose.mqtt-secure.yml")
      else
        compose_files+=("docker-compose.pc-agents.yml")
      fi
    fi
  fi
  [[ "$tpm_enabled" != true ]] || compose_files+=("docker-compose.tpm.yml")
  if [[ -f .env ]]; then
    android_display_load
    if [[ "$android_display_enabled" == true ]]; then
      [[ "$compose_explicit" == false ]] || fail 'Android Display habilitado requiere selección automática de Compose; omite --compose.'
      android_display_desktop=false
      is_docker_desktop && android_display_desktop=true
      android_display_add_overlays
      homepilot_image_enable_display
    fi
  fi
}

banner() {
  [[ "${HOMEPILOT_INSTALLER_EMBEDDED:-0}" != 1 ]] || return 0
  printf '%b\n' "${BOLD}${HP_BRAND} · mantenimiento${NC}"
  printf '%b\n' "${DIM}   Perfil ${profile} · mantenimiento acotado al proyecto ${HP_BRAND}${NC}"
  divider
}

divider() {
  hp_ui_separator
}

section() {
  printf '\n'
  hp_ui_block "$HP_PRIMARY$HP_BOLD" "$1"
  divider
}

ok() {
  hp_ok "$1"
}

warn() {
  hp_warn "$1"
}

info() {
  hp_ui_wrap_block "$HP_SECONDARY" "$1"
}

fail() {
  hp_fail "$1"
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

show_disk() {
  storage_report
  section 'Builder de '"$HP_BRAND"''
  homepilot_builder_report
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

check_api_health() {
  local status_code
  status_code="$(homepilot_api_health_status || true)"
  if [[ "$status_code" == "200" ]]; then
    ok "API ${HP_BRAND} responde desde el contenedor (HTTP 200)."
  else
    warn "API ${HP_BRAND} no responde desde el contenedor (HTTP ${status_code:-000})."
    runtime_failures=$((runtime_failures + 1))
  fi
}

verify_runtime_once() {
  local ui_port stt_port tts_port ha_port

  ui_port="$(env_value HOMEPILOT_UI_PORT 8080)"
  stt_port="$(env_value HOMEPILOT_STT_PORT 8090)"
  tts_port="$(env_value HOMEPILOT_TTS_PORT 8088)"
  ha_port="$(env_value HOMEPILOT_HOME_ASSISTANT_PORT 8123)"

  runtime_failures=0
  check_container "homepilot-api" "API ${HP_BRAND}"
  check_container "homepilot-ui" "UI ${HP_BRAND}"
  if [[ "$voice_enabled" == true ]]; then
    check_container "homepilot-stt" "STT Whisper"
    check_container "homepilot-tts" "TTS Piper"
  fi
  check_api_health
  check_endpoint "UI ${HP_BRAND} · puerto ${ui_port}" "http://127.0.0.1:${ui_port}" "200"
  if [[ "$voice_enabled" == true ]]; then
    check_endpoint "STT Whisper · puerto ${stt_port}" "http://127.0.0.1:${stt_port}/health" "200"
    check_endpoint "TTS Piper · puerto ${tts_port}" "http://127.0.0.1:${tts_port}/health" "200"
  fi
  if [[ "$mqtt_enabled" == true ]]; then
    check_container 'homepilot-mqtt' 'MQTT Mosquitto'
  fi

  if [[ "$profile" == "bridge_ha" || "$profile" == "ha_companion" ]]; then
    [[ "$profile" != ha_companion ]] || check_container 'homeassistant' 'Home Assistant administrado'
    check_endpoint "Home Assistant existente · puerto ${ha_port}" "http://127.0.0.1:${ha_port}/" "200,301,302,401,403"
  fi
  if [[ "$android_display_enabled" == true ]]; then
    check_container 'homepilot-display-bridge' 'Android Display Bridge'
    android_display_check_network
    android_display_check_api_config
    if [[ "$android_display_desktop" == false ]]; then
      check_endpoint 'Android Display Bridge · loopback' \
        "http://127.0.0.1:$(android_display_env_value HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT)/health" '200'
    fi
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
  local compose_command=()
  local container_id log_path

  section "Limpieza acotada a ${HP_BRAND}"
  info "No se ejecutan limpiezas globales de Docker (system, builder, image, container, network o volume)."
  mapfile -t compose_command < <(compose_args)

  if docker compose "${compose_command[@]}" rm --force; then
    ok "Contenedores detenidos del proyecto ${HP_BRAND} eliminados."
  else
    warn "No se pudieron eliminar contenedores detenidos del proyecto ${HP_BRAND}."
  fi

  if [[ "$truncate_logs" == true ]]; then
    section "Limpieza de logs de ${HP_BRAND}"
    while IFS= read -r container_id; do
      [[ -n "$container_id" ]] || continue
      log_path="$(docker inspect --format '{{.LogPath}}' "$container_id" 2>/dev/null || true)"
      [[ -n "$log_path" && -f "$log_path" ]] || continue
      if command -v sudo >/dev/null 2>&1; then
        sudo truncate -s 0 "$log_path"
      else
        truncate -s 0 "$log_path"
      fi
    done < <(docker compose "${compose_command[@]}" ps -a -q)
    ok "Solo los logs de contenedores ${HP_BRAND} fueron truncados."
  fi
}
select_camera_acceleration_for_deploy() {
  if [[ "$camera_enabled" != true ]]; then
    info 'Cámaras deshabilitadas; se omite el probe VAAPI.'
    return
  fi
  section 'Aceleración HLS de cámaras'
  if [[ "$compose_explicit" == true ]]; then
    info 'Compose personalizado: se conserva sin overrides automáticos de cámara.'
    return
  fi
  camera_acceleration_select
  if [[ -n "$camera_acceleration_overlay" ]]; then
    compose_files+=("$camera_acceleration_overlay")
  fi
  camera_acceleration_report
}

maintenance_build_and_up() {
  local -a compose_options=("$@")
  if [[ "$global_installer_v1" == true ]]; then
    if [[ "$voice_enabled" != true ]]; then
      # Turning voice off on an installation that had it must not leave the old speech services running.
      docker compose "${compose_options[@]}" rm -sf homepilot-stt homepilot-tts >/dev/null
    fi
    COMPOSE_BAKE=false hp_ui_run 'Construyendo servicios '"$HP_BRAND"'' docker compose "${compose_options[@]}" build --builder "$HOMEPILOT_BUILDER_NAME" "${build_services[@]}" \
      && hp_ui_run 'Iniciando servicios '"$HP_BRAND"'' docker compose "${compose_options[@]}" up -d --no-build --no-deps "${runtime_services[@]}"
  else
    COMPOSE_BAKE=false hp_ui_run 'Construyendo servicios '"$HP_BRAND"'' docker compose "${compose_options[@]}" build --builder "$HOMEPILOT_BUILDER_NAME" \
      && hp_ui_run 'Iniciando servicios '"$HP_BRAND"'' docker compose "${compose_options[@]}" up -d --no-build
  fi
}

deploy_homepilot() {
  section "Despliegue ${HP_BRAND}"
  info "Compose: ${compose_files[*]}"
  info "Perfil: ${profile}"
  info "Los servicios se construyen con ${HOMEPILOT_BUILDER_NAME}; Compose los inicia sin reconstruir."

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
    if maintenance_build_and_up "${compose_args[@]}"; then
      ok "${HP_BRAND} construido e iniciado."
      break
    fi

    if [[ -n "${camera_acceleration_overlay:-}" ]]; then
      warn 'El inicio con VAAPI falló; se reintentará inmediatamente con libx264.'
      unset "compose_files[$((${#compose_files[@]} - 1))]"
      camera_acceleration_overlay=''
      camera_acceleration_encoder='libx264'
      camera_acceleration_fallback='software (libx264)'
      camera_acceleration_reason='falló el inicio con el override VAAPI'
      camera_acceleration_report
      compose_args=()
      for file in "${compose_files[@]}"; do
        compose_args+=( -f "$file" )
      done
      if maintenance_build_and_up "${compose_args[@]}"; then
        ok ''"$HP_BRAND"' construido e iniciado con codificación por software.'
        break
      fi
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
      profile_explicit=true
      ;;
    --clean)
      clean_only=true
      ;;
    --status)
      status_only=true
      ;;
    --gc-homepilot)
      gc_homepilot=true
      ;;
    --compose)
      shift
      [[ $# -gt 0 ]] || fail "--compose requiere un archivo."
      compose_file="$1"
      compose_explicit=true
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

if [[ "$gc_homepilot" == true && ( "$deploy" == true || "$clean_only" == true || "$status_only" == true || "$truncate_logs" == true ) ]]; then
  fail '--gc-homepilot debe ejecutarse solo; no se combina con deploy, clean, status ni truncate-logs.'
fi

if [[ "$deploy" == false && "$clean_only" == false && "$status_only" == false && "$gc_homepilot" == false ]]; then
  status_only=true
fi

load_saved_profile
load_installer_capabilities
if [[ "$deploy" == true ]]; then
  homepilot_runtime_preflight
fi
configure_profile
banner
check_requirements
validate_profile_environment
show_disk

if [[ "$gc_homepilot" == true ]]; then
  section 'Imágenes '"$HP_BRAND"' · limpieza explícita'
  homepilot_image_gc_scan
  homepilot_image_gc_report
  if (( ${#HOMEPILOT_GC_CANDIDATES[@]} == 0 )); then
    exit 0
  fi
  if confirm 'Eliminar solo las imágenes candidatas verificadas arriba?'; then
    homepilot_image_gc_remove
    ok 'Limpieza de imágenes '"$HP_BRAND"' terminada sin prune global.'
  else
    warn 'Limpieza de imágenes cancelada.'
  fi
  exit 0
fi

if [[ "$status_only" == true ]]; then
  if [[ "$camera_enabled" == true ]]; then
    section 'Aceleración HLS de cámaras'
    camera_acceleration_report_running
  fi
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
  if confirm "Limpiar, construir e iniciar ${HP_BRAND} ahora?"; then
    if [[ "$global_installer_v1" == true ]]; then
      HOMEPILOT_IMAGE_SERVICES=(api ui)
      build_services=(homepilot-api homepilot-ui)
      runtime_services=()
      [[ "$mqtt_enabled" != true ]] || runtime_services+=(homepilot-mqtt)
      [[ "$profile" != ha_companion ]] || runtime_services+=(homeassistant)
      if [[ "$voice_enabled" == true ]]; then
        HOMEPILOT_IMAGE_SERVICES+=(stt tts)
        build_services+=(homepilot-stt homepilot-tts)
        runtime_services+=(homepilot-stt homepilot-tts)
      fi
      runtime_services+=(homepilot-api homepilot-ui)
      if [[ "$android_display_enabled" == true ]]; then
        HOMEPILOT_IMAGE_SERVICES+=(display-bridge)
        build_services+=(homepilot-display-bridge)
        runtime_services+=(homepilot-display-bridge)
      fi
    fi
    [[ "$android_display_enabled" != true ]] || android_display_prepare_adb_home
    export HOMEPILOT_BUILD_REVISION="$(homepilot_image_revision)"
    section 'Builder de '"$HP_BRAND"''
    homepilot_builder_ensure
    select_camera_acceleration_for_deploy
    mapfile -t image_compose_args < <(compose_args)
    homepilot_image_prepare_rollback "${image_compose_args[@]}"
    clean_docker_residue
    deploy_homepilot
    clean_docker_residue
    show_disk
    verify_runtime 180
    mapfile -t image_compose_args < <(compose_args)
    homepilot_image_finalize_rollback "${image_compose_args[@]}"
  else
    warn "Despliegue cancelado."
  fi
fi
