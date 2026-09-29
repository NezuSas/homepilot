#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib/camera-acceleration.sh"
source "$(dirname "${BASH_SOURCE[0]}")/lib/homepilot-builder.sh"
source "$(dirname "${BASH_SOURCE[0]}")/lib/homepilot-images.sh"
source "$(dirname "${BASH_SOURCE[0]}")/lib/android-display-appliance.sh"
source "$(dirname "${BASH_SOURCE[0]}")/lib/api-health.sh"

readonly ENV_FILE=".env"
profile=""
compose_file="docker-compose.office.yml"
env_template=".env.office.example"
ha_port="8123"
ha_management_label="existente, preservado"
requires_home_assistant=true

clean=false
start=false
wizard=false
assume_yes=false
api_url=""
cloud_url=""
pairing_code=""
status_only=false
install_community_integrations=false
community_integrations_only=false
runtime_failures=0
startup_failed=false
android_display_choice="${HOMEPILOT_INSTALL_ANDROID_CHOICE:-}"
android_display_desktop=false
global_install="${HOMEPILOT_GLOBAL_INSTALL:-false}"
camera_enabled="${HOMEPILOT_INSTALL_CAMERA_ENABLED:-true}"
voice_enabled="${HOMEPILOT_INSTALL_VOICE_ENABLED:-true}"
mqtt_enabled="${HOMEPILOT_INSTALL_MQTT_ENABLED:-false}"
tpm_enabled="${HOMEPILOT_INSTALL_TPM_ENABLED:-false}"

append_global_overlays() {
  [[ "$global_install" == true ]] || return 0
  [[ "$tpm_enabled" != true ]] || camera_compose_args+=(-f docker-compose.tpm.yml)
  if [[ "$mqtt_enabled" == true ]]; then
    if [[ "$profile" == ha_companion ]]; then
      camera_compose_args+=(-f docker-compose.mqtt-secure.yml)
    else
      camera_compose_args+=(-f docker-compose.pc-agents.yml)
    fi
  fi
}

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

if [[ "$global_install" == true ]]; then
  source scripts/lib/homepilot-terminal-ui.sh
  hp_color_init
  RED="$HP_RED" GREEN="$HP_GREEN" YELLOW="$HP_YELLOW"
  BLUE="$HP_AMBER" CYAN="$HP_SOFT" BOLD="$HP_BOLD" DIM="$HP_DIM" NC="$HP_RESET"
fi

divider() {
  printf '%b\n' "${DIM}────────────────────────────────────────────────────────────────────────${NC}"
}

detect_technician_environment() {
  if [[ -n "${WSL_DISTRO_NAME:-}" ]] || grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null; then
    printf '%s' 'Windows mediante WSL'
  elif [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* || "${OSTYPE:-}" == win32* ]]; then
    printf '%s' 'Windows con Docker Desktop'
  elif [[ "${OSTYPE:-}" == darwin* ]]; then
    printf '%s' 'macOS con Docker Desktop'
  elif [[ "${OSTYPE:-}" == linux* ]]; then
    printf '%s' 'Linux'
  else
    printf '%s' 'terminal compatible con Docker'
  fi
}

show_community_integration_guidance() {
  local environment container
  environment="$(detect_technician_environment)"
  container="$(home_assistant_container)"

  section 'Mantenimiento de integraciones Home Assistant'
  ok "Entorno técnico detectado: ${environment}."
  info 'Este modo no ejecuta docker compose, no recompila imágenes y no reinicia HomePilot.'
  info "Home Assistant objetivo: contenedor ${container}."
  printf '%b\n' "${DIM}  Equivalente manual: docker exec ${container} sh -lc \"wget -qO- https://get.hacs.xyz | bash\"${NC}"
  printf '%b\n' "${DIM}  Después: docker restart ${container}${NC}"
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
  printf '%b\n' "${NC}${BOLD}   N E Z U   ·   H O M E P I L O T${NC}"
  if [[ -n "$profile" ]]; then
    printf '%b\n' "${BLUE}   Instalador técnico · Perfil ${profile}${NC}"
  else
    printf '%b\n' "${BLUE}   Instalador técnico · Selección guiada${NC}"
  fi
  divider
}

usage() {
  cat <<'EOF'
Uso: bash scripts/install-edge-office.sh [opciones]

Prepara HomePilot para un hogar nuevo o existente.

Opciones:
  --profile PERFIL      Selección técnica opcional: bridge_ha, native_only o ha_companion.
                       En una instalación nueva e interactiva el asistente pregunta
                       si el cliente ya usa Home Assistant y recomienda el camino.
  --clean              Elimina solo contenedores HomePilot que ya estén detenidos.
  --start              Construye e inicia los servicios de HomePilot al finalizar.
  --status             Consulta el estado actual sin crear, limpiar ni iniciar servicios.
  --wizard             Abre el checklist guiado para técnicos antes de preparar el appliance.
  --with-community-integrations
                       Instala HACS y SonoffLAN al finalizar el flujo de HomePilot.
  --community-integrations-only
                       Mantiene HACS y SonoffLAN sin reconstruir ni reiniciar HomePilot.
                       Detecta el entorno del técnico y usa el Home Assistant existente.
  --api-url URL        Configuracion avanzada para una API en otro origen.
  --cloud-url URL      URL pública de HomePilot Cloud para emparejar esta MiniPC.
  --pairing-code CODE  Código temporal mostrado por el propietario.
                       Por defecto se deja vacia y UI/API usan el mismo dominio.
  --yes                No pide confirmacion para --clean o --start.
  --help               Muestra esta ayuda.
EOF
}

section() {
  printf '\n%b\n' "${CYAN}${BOLD}▸ $1${NC}"
  divider
}

choose_profile_for_new_installation() {
  local answer

  if [[ -n "$profile" ]]; then
    return
  fi

  if [[ -f "$ENV_FILE" ]]; then
    profile="$(env_value HOMEPILOT_INSTALLATION_PROFILE bridge_ha)"
    return
  fi

  if [[ "$status_only" == true ]]; then
    profile="bridge_ha"
    return
  fi

  if [[ ! -t 0 ]]; then
    profile="bridge_ha"
    return
  fi

  printf '\n%b\n' "${BOLD}Configuración inicial del hogar${NC}"
  printf '%s\n' '¿Ya usas Home Assistant?'
  read_terminal_line 'Conecta tu sistema actual sin modificarlo [S/n] ' || fail "No se pudo leer la selección del técnico."
  answer="$REPLY"

  if [[ ! "$answer" =~ ^([Nn]|[Nn][Oo])$ ]]; then
    profile="bridge_ha"
    return
  fi

  printf '\n%s\n' '¿Quieres incluir Home Assistant con HomePilot?'
  printf '%s\n' '  S: Instalar Home Assistant junto a HomePilot (recomendado si quieres su ecosistema).'
  printf '%s\n' '  N: Usar solo las integraciones nativas de HomePilot.'
  read_terminal_line 'Instalar Home Assistant con HomePilot [S/n] ' || fail "No se pudo leer la selección del técnico."
  answer="$REPLY"

  if [[ "$answer" =~ ^([Nn]|[Nn][Oo])$ ]]; then
    profile="native_only"
  else
    profile="ha_companion"
  fi
}
choose_technician_profile() {
  local answer

  if [[ -n "$profile" ]]; then
    info "Perfil técnico indicado: ${profile}."
    return
  fi

  if [[ -f "$ENV_FILE" ]]; then
    profile="$(env_value HOMEPILOT_INSTALLATION_PROFILE bridge_ha)"
    info "Instalación existente detectada: se conserva el perfil ${profile}."
    return
  fi

  printf '\n%b\n' "${BOLD}Arquitectura del cliente${NC}"
  printf '%s\n' '  1. Conectar un Home Assistant existente (recomendado para clientes que ya lo usan).'
  printf '%s\n' '  2. Instalar Home Assistant junto a HomePilot (appliance completo).'
  printf '%s\n' '  3. Instalar solo HomePilot con integraciones nativas.'

  while true; do
    read_terminal_line 'Selecciona una opción [1-3] ' || fail "No se pudo leer la selección del técnico."
    answer="$REPLY"
    case "$answer" in
      1) profile="bridge_ha"; return ;;
      2) profile="ha_companion"; return ;;
      3) profile="native_only"; return ;;
      *) warn "Selecciona 1, 2 o 3." ;;
    esac
  done
}

choose_technician_action() {
  local answer

  printf '\n%b\n' "${BOLD}Acción de instalación${NC}"
  printf '%s\n' '  1. Preparar y desplegar HomePilot ahora.'
  printf '%s\n' '  2. Preparar la configuración sin iniciar servicios.'
  printf '%s\n' '  3. Ejecutar solo diagnóstico (sin modificar archivos ni servicios).'
  if [[ "$requires_home_assistant" == true ]]; then
    printf '%s\n' '  4. Instalar o reparar HACS y SonoffLAN sin reconstruir HomePilot.'
  fi

  while true; do
    read_terminal_line 'Selecciona una opción [1-4] ' || fail "No se pudo leer la acción del técnico."
    answer="$REPLY"
    case "$answer" in
      1) start=true; return ;;
      2) return ;;
      3) status_only=true; return ;;
      4)
        if [[ "$requires_home_assistant" == true ]]; then
          community_integrations_only=true
          install_community_integrations=true
          return
        fi
        warn 'Esta acción requiere un perfil con Home Assistant.'
        ;;
      *) warn "Selecciona una opción válida." ;;
    esac
  done
}

ask_technician_yes_no() {
  local prompt="$1"
  local answer

  read_terminal_line "${prompt} [y/N] " || fail "No se pudo leer la confirmación del técnico."
  answer="$REPLY"
  [[ "$answer" =~ ^[Yy]$ ]]
}

read_terminal_line() {
  local prompt="$1"

  [[ -r /dev/tty ]] || return 1
  printf '%s' "$prompt" >/dev/tty
  IFS= read -r REPLY </dev/tty
}

show_technician_checklist() {
  local action_label cleanup_label community_label

  if [[ "$community_integrations_only" == true ]]; then
    action_label="Mantener HACS y SonoffLAN sin reconstruir HomePilot"
  elif [[ "$status_only" == true ]]; then
    action_label="Solo diagnóstico"
  elif [[ "$start" == true ]]; then
    action_label="Preparar y desplegar ahora"
  else
    action_label="Preparar sin iniciar servicios"
  fi

  cleanup_label="No"
  [[ "$clean" == true ]] && cleanup_label="Sí, solo contenedores HomePilot detenidos"

  community_label="No aplica"
  if [[ "$profile" == "ha_companion" ]]; then
    community_label="Automática durante el despliegue"
  elif [[ "$requires_home_assistant" == true ]]; then
    community_label="No"
    [[ "$install_community_integrations" == true ]] && community_label="Sí, HACS y SonoffLAN"
  fi

  section "Checklist técnico"
  printf '%b\n' "${BOLD}  Perfil del cliente${NC}    ${profile}"
  printf '%b\n' "${BOLD}  Home Assistant${NC}        ${ha_management_label}"
  printf '%b\n' "${BOLD}  Acción${NC}                ${action_label}"
  printf '%b\n' "${BOLD}  Limpieza segura${NC}       ${cleanup_label}"
  printf '%b\n' "${BOLD}  Integraciones HA${NC}      ${community_label}"
  printf '%b\n' "${BOLD}  Android Display${NC}       ${android_display_choice:-conservar configuración actual}"
  divider
}

run_technician_wizard() {
  [[ -t 0 && -t 1 ]] || fail "--wizard requiere una terminal interactiva."

  banner
  printf '%b\n' "${BOLD}Checklist guiado de instalación para técnicos${NC}"
  printf '%s\n' 'El cliente no necesita completar este flujo. HomePilot conserva la arquitectura existente cuando detecta un .env.'

  choose_technician_profile
  configure_profile
  choose_technician_action

  if [[ "$status_only" == false && "$community_integrations_only" == false ]]; then
    if [[ -f "$ENV_FILE" && "$(android_display_env_value HOMEPILOT_ANDROID_DISPLAY_ENABLED)" == true ]]; then
      android_display_choice=true
      info 'Android Display ya está habilitado; se conservará su configuración.'
    elif ask_technician_yes_no '¿Esta instalación utilizará pantallas inteligentes Android?'; then
      android_display_choice=true
    else
      android_display_choice=false
    fi
    if ask_technician_yes_no "¿Retirar contenedores HomePilot detenidos antes de continuar?"; then
      clean=true
    fi

    if [[ "$profile" == "ha_companion" ]]; then
      info "Home Assistant administrado: HACS y SonoffLAN se provisionarán automáticamente durante el despliegue."
    elif [[ "$profile" == "bridge_ha" ]] \
      && ask_technician_yes_no "¿Autorizar revisión e instalación de HACS y SonoffLAN si faltan?"; then
      install_community_integrations=true
    fi
  fi

  show_technician_checklist
  if [[ "$status_only" == false ]] && ! confirm "¿Aplicar este checklist técnico?"; then
    fail "Instalación cancelada por el técnico."
  fi

  # La confirmación del checklist cubre las acciones elegidas y evita prompts duplicados.
  [[ "$status_only" == false ]] && assume_yes=true
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
  # Los archivos .env creados desde Windows pueden usar CRLF. El comando
  # substitution elimina el salto de línea, pero conserva el retorno de carro.
  # Normalizarlo evita que valores como bridge_ha no coincidan en el case.
  value="${value%$'\r'}"
  printf '%s' "${value:-$fallback}"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local temporary_file
  temporary_file="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { written = 0 }
    {
      sub(/\r$/, "")
      if ($0 ~ "^[[:space:]]*" key "[[:space:]]*=") {
        if (!written) {
          print key "=" value
          written = 1
        }
        next
      }
      print
    }
    END {
      if (!written) {
        print key "=" value
      }
    }
  ' "$ENV_FILE" > "$temporary_file"
  mv "$temporary_file" "$ENV_FILE"
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
      && { [[ "$voice_enabled" != true ]] || { container_ready "homepilot-stt" true && container_ready "homepilot-tts" true; }; } \
      && { [[ "$mqtt_enabled" != true ]] || container_ready "homepilot-mqtt" "$([[ "$profile" == ha_companion ]] && printf true || printf false)"; } \
      && { [[ "$android_display_enabled" != true ]] || container_ready 'homepilot-display-bridge' true; }; then
      ok "Servicios HomePilot listos."
      return 0
    fi

    sleep "$interval_seconds"
    elapsed=$((elapsed + interval_seconds))
  done

  warn "Timeout esperando servicios saludables. Revisa el detalle con docker compose logs."
  return 1
}

home_assistant_container() {
  env_value HOMEPILOT_HOME_ASSISTANT_CONTAINER homeassistant
}

home_assistant_component_installed() {
  local component="$1"
  local container
  container="$(home_assistant_container)"
  docker exec "$container" sh -lc "test -f /config/custom_components/${component}/manifest.json" >/dev/null 2>&1
}

show_home_assistant_community_status() {
  local container
  container="$(home_assistant_container)"

  if [[ "$requires_home_assistant" != true ]]; then
    return
  fi

  section "Integraciones comunitarias de Home Assistant"
  if ! docker inspect "$container" >/dev/null 2>&1; then
    warn "No se pudo inspeccionar HACS ni SonoffLAN: contenedor ${container} no encontrado."
    return
  fi

  if home_assistant_component_installed hacs; then
    ok "HACS instalado en Home Assistant."
  else
    warn "HACS no está instalado."
  fi

  if home_assistant_component_installed sonoff; then
    ok "SonoffLAN instalado. Configura la cuenta eWeLink desde Home Assistant."
  else
    warn "SonoffLAN no está instalado."
  fi
}

install_hacs() {
  local container="$1"
  info "Instalando HACS en ${container}..."
  docker exec "$container" sh -lc 'wget -qO- https://get.hacs.xyz | bash' \
    || fail "No se pudo instalar HACS. Revisa la conectividad del contenedor Home Assistant."
}

install_sonofflan() {
  local container="$1"
  info "Instalando SonoffLAN en ${container}..."
  docker exec -i "$container" python3 - <<'PY'
import io
import shutil
import tarfile
import urllib.request

source = 'https://github.com/AlexxIT/SonoffLAN/archive/refs/heads/master.tar.gz'
target = '/config/custom_components/sonoff'
with urllib.request.urlopen(source, timeout=60) as response:
    archive = response.read()
with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as bundle:
    member_prefix = 'SonoffLAN-master/custom_components/sonoff/'
    members = [entry for entry in bundle.getmembers() if entry.name.startswith(member_prefix)]
    if not members:
        raise RuntimeError('SonoffLAN custom component was not found in the downloaded archive.')
    shutil.rmtree(target, ignore_errors=True)
    for entry in members:
        relative = entry.name[len(member_prefix):]
        if not relative:
            continue
        destination = f'{target}/{relative}'
        if entry.isdir():
            __import__('os').makedirs(destination, exist_ok=True)
            continue
        __import__('os').makedirs(__import__('os').path.dirname(destination), exist_ok=True)
        extracted = bundle.extractfile(entry)
        if extracted is None:
            continue
        with extracted, open(destination, 'wb') as output:
            shutil.copyfileobj(extracted, output)
PY
  docker exec "$container" sh -lc 'test -f /config/custom_components/sonoff/manifest.json' \
    || fail "SonoffLAN no quedó instalado correctamente."
}

restart_home_assistant_after_community_install() {
  local container="$1"
  local elapsed=0
  local status_code="000"

  info "Reiniciando Home Assistant para activar las integraciones comunitarias..."
  docker restart "$container" >/dev/null
  while (( elapsed < 120 )); do
    status_code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "http://127.0.0.1:${ha_port}/" || true)"
    if [[ "$status_code" == "200" || "$status_code" == "301" || "$status_code" == "302" || "$status_code" == "401" || "$status_code" == "403" ]]; then
      ok "Home Assistant volvió a responder."
      return
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done
  warn "Home Assistant aún no responde; la instalación puede requerir unos minutos adicionales."
}

provision_home_assistant_community_integrations() {
  local container should_install=false
  container="$(home_assistant_container)"

  if [[ "$requires_home_assistant" != true ]] || ! docker inspect "$container" >/dev/null 2>&1; then
    return
  fi

  if [[ "$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || true)" != "running" ]]; then
    warn "No se instalaron integraciones comunitarias: Home Assistant aún no está en ejecución."
    return
  fi

  if [[ "$profile" == ha_companion && "$status_only" == false ]]; then
    should_install=true
    info "Home Assistant administrado: se provisionarán HACS y SonoffLAN si faltan."
  elif [[ "$install_community_integrations" == true ]]; then
    should_install=true
  elif [[ "$profile" == bridge_ha && "$global_install" != true ]] \
    && { ! home_assistant_component_installed hacs || ! home_assistant_component_installed sonoff; }; then
    info "Home Assistant existente: HACS/SonoffLAN se detectan en modo lectura."
    if [[ "$status_only" == false ]] && [[ -t 0 ]]; then
      local answer
      read_terminal_line "¿Autoriza instalar HACS y SonoffLAN en el Home Assistant existente? [y/N] " || fail "No se pudo leer la confirmación del técnico."
      answer="$REPLY"
      [[ "$answer" =~ ^[Yy]$ ]] && should_install=true
    fi
  fi

  if [[ "$should_install" != true ]]; then
    return
  fi

  if ! home_assistant_component_installed hacs; then
    install_hacs "$container"
  else
    ok "HACS ya estaba instalado."
  fi

  if ! home_assistant_component_installed sonoff; then
    install_sonofflan "$container"
  else
    ok "SonoffLAN ya estaba instalado."
  fi

  restart_home_assistant_after_community_install "$container"
}
show_runtime_status() {
  local ui_port tts_port stt_port api_status
  ui_port="$(env_value HOMEPILOT_UI_PORT 8080)"
  tts_port="$(env_value HOMEPILOT_TTS_PORT 8088)"
  stt_port="$(env_value HOMEPILOT_STT_PORT 8090)"

  runtime_failures=0
  section "Estado operativo de servicios"
  check_container "homepilot-api" "API HomePilot" true
  check_container "homepilot-ui" "UI HomePilot · puerto ${ui_port}" false
  if [[ "$voice_enabled" == true ]]; then
    check_container "homepilot-stt" "STT Whisper · puerto ${stt_port}" true
    check_container "homepilot-tts" "TTS Piper · puerto ${tts_port}" true
  else
    ok 'Voz local: deshabilitada; STT/TTS no son servicios requeridos.'
  fi
  if [[ "$mqtt_enabled" == true ]]; then
    check_container "homepilot-mqtt" 'MQTT Mosquitto' "$([[ "$profile" == ha_companion ]] && printf true || printf false)"
  fi
  if [[ "$android_display_enabled" == true ]]; then
    check_container 'homepilot-display-bridge' 'Android Display Bridge' true
  fi

  section "Conectividad de servicios"
  api_status="$(homepilot_api_health_status || true)"
  if [[ "$api_status" == "200" ]]; then
    ok "API HomePilot: responde desde el contenedor (HTTP 200)."
  else
    warn "API HomePilot: sin respuesta desde el contenedor (HTTP ${api_status:-000})."
    runtime_failures=$((runtime_failures + 1))
  fi
  check_endpoint "UI HomePilot · puerto ${ui_port}" "http://127.0.0.1:${ui_port}" "200"
  if [[ "$voice_enabled" == true ]]; then
    check_endpoint "STT Whisper · puerto ${stt_port}" "http://127.0.0.1:${stt_port}/health" "200"
    check_endpoint "TTS Piper · puerto ${tts_port}" "http://127.0.0.1:${tts_port}/health" "200"
  fi
  if [[ "$android_display_enabled" == true ]]; then
    android_display_check_network
    android_display_check_api_config
    if [[ "$android_display_desktop" == false ]]; then
      check_endpoint 'Android Display Bridge · loopback' \
        "http://127.0.0.1:$(android_display_env_value HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT)/health" '200'
    fi
  fi
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
  read_terminal_line "$prompt [y/N] " || fail "No se pudo leer la confirmación del técnico."
  answer="$REPLY"
  [[ "$answer" =~ ^[Yy]$ ]]
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean) clean=true ;;
    --start) start=true ;;
    --status) status_only=true ;;
    --wizard) wizard=true ;;
    --with-community-integrations) install_community_integrations=true ;;
    --community-integrations-only)
      community_integrations_only=true
      install_community_integrations=true
      ;;
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

if [[ "$community_integrations_only" == true && ( "$clean" == true || "$start" == true || "$status_only" == true || -n "$api_url" ) ]]; then
  fail "--community-integrations-only no se combina con --clean, --start, --status ni --api-url."
fi

if [[ "$status_only" == true && ( "$clean" == true || "$start" == true || -n "$api_url" ) ]]; then
  fail "--status no se combina con --clean, --start ni --api-url."
fi

if [[ "$wizard" == true && ( "$clean" == true || "$start" == true || "$status_only" == true || "$install_community_integrations" == true || "$community_integrations_only" == true || "$assume_yes" == true || -n "$api_url" ) ]]; then
  fail "--wizard elige las acciones dentro del checklist; no lo combines con opciones de ejecución."
fi

if [[ "$wizard" == true ]]; then
  run_technician_wizard
else
  choose_profile_for_new_installation
  configure_profile
fi
if [[ -f "$ENV_FILE" ]]; then
  if [[ "$global_install" != true ]]; then
    voice_enabled="$(env_value HOMEPILOT_VOICE_ENABLED true)"
    camera_enabled="$(env_value HOMEPILOT_CAMERA_ENABLED true)"
    mqtt_enabled="$(env_value HOMEPILOT_MQTT_ENABLED false)"
  fi
  case "$(android_display_env_value HOMEPILOT_ANDROID_DISPLAY_ENABLED)" in
    ''|true|false) ;;
    *) fail 'HOMEPILOT_ANDROID_DISPLAY_ENABLED debe ser true o false; no se cambiará silenciosamente.' ;;
  esac
fi
[[ -f "$compose_file" ]] || fail "Ejecuta el script desde la raiz del repositorio HomePilot."
[[ -f "$env_template" ]] || fail "No existe $env_template."
command -v docker >/dev/null 2>&1 || fail "Docker no esta instalado o no esta disponible para este usuario."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 no esta disponible."

if [[ "$community_integrations_only" == true ]]; then
  [[ "$requires_home_assistant" == true ]] || fail "Este perfil no usa Home Assistant; no hay integraciones comunitarias que mantener."
  show_community_integration_guidance
  if [[ "$assume_yes" == false ]] && ! confirm "¿Instalar o reparar HACS y SonoffLAN sin reconstruir HomePilot?"; then
    fail "Mantenimiento de integraciones cancelado por el técnico."
  fi
  provision_home_assistant_community_integrations
  show_home_assistant_community_status
  exit 0
fi

if [[ "$wizard" != true && "$global_install" != true ]]; then
  banner
fi
info "Directorio de instalación: $(pwd)"
info "Compose: $compose_file · Home Assistant: $ha_management_label"
if [[ "$status_only" == true && -f "$ENV_FILE" ]]; then
  android_display_load
  if android_display_is_desktop; then
    android_display_desktop=true
  fi
fi

if [[ "$status_only" == true ]]; then
  section 'Builder de HomePilot'
  homepilot_builder_report
  section 'Aceleración HLS de cámaras'
  [[ "$camera_enabled" != true ]] || camera_acceleration_report_running
  show_runtime_status
  show_home_assistant_community_status
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
required_ports=(3000 8080 11434)
[[ "$voice_enabled" != true ]] || required_ports+=(8088 8090)
for port in "${required_ports[@]}"; do
  if ss -ltn 2>/dev/null | grep -q ":${port} "; then
    warn "Puerto ${port} ya esta ocupado; ajusta HOMEPILOT_*_PORT en .env si no pertenece a HomePilot."
  else
    ok "Puerto ${port} disponible."
  fi
done

if [[ "$clean" == true ]]; then
  section "Limpieza acotada a HomePilot"
  if confirm "Se retirarán solo contenedores detenidos del proyecto HomePilot. Continuar?"; then
    docker compose -f "$compose_file" rm --force || true
    ok "Limpieza acotada terminada; no se ejecutó ningún prune global de Docker."
    docker system df || true
  else
    warn "Limpieza omitida por el operador."
  fi
else
  warn "Limpieza no ejecutada. Usa --clean para retirar solo contenedores detenidos de HomePilot."
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
if [[ -z "$configured_profile" ]]; then
  if [[ "$status_only" == true ]]; then
    warn "Instalación existente sin perfil; el diagnóstico usa ${profile} sin modificar .env."
  else
    set_env_value HOMEPILOT_INSTALLATION_PROFILE "$profile"
    ok "Instalación existente normalizada con el perfil ${profile}."
  fi
elif [[ "$configured_profile" != "$profile" ]]; then
  fail ".env declara ${configured_profile:-ningún perfil}; ajusta HOMEPILOT_INSTALLATION_PROFILE=${profile} antes de continuar."
fi
ok "Perfil de instalación configurado: ${profile}."
if [[ "$global_install" == true ]]; then
  set_env_value HOMEPILOT_GLOBAL_INSTALLER_VERSION v1
  set_env_value HOMEPILOT_TPM_ENABLED "$tpm_enabled"
  set_env_value HOMEPILOT_CLIENT_NAME "${HOMEPILOT_INSTALL_CLIENT_NAME:-}"
  set_env_value HOMEPILOT_INSTALLATION_NAME "${HOMEPILOT_INSTALL_NAME:-}"
  set_env_value HOMEPILOT_CAMERA_ENABLED "$camera_enabled"
  set_env_value HOMEPILOT_VOICE_ENABLED "$voice_enabled"
  set_env_value HOMEPILOT_MQTT_ENABLED "$mqtt_enabled"
  if [[ "$mqtt_enabled" == true ]]; then
    set_env_value HOMEPILOT_MQTT_BIND_ADDRESS "${HOMEPILOT_INSTALL_MQTT_BIND_ADDRESS:-127.0.0.1}"
  fi
fi

if [[ -z "$android_display_choice" ]]; then
  if [[ "$(android_display_env_value HOMEPILOT_ANDROID_DISPLAY_ENABLED)" == true ]]; then
    android_display_choice=true
  elif [[ -t 0 && "$assume_yes" == false ]] \
    && ask_technician_yes_no '¿Esta instalación utilizará pantallas inteligentes Android?'; then
    android_display_choice=true
  else
    android_display_choice=false
  fi
fi
set_env_value HOMEPILOT_ANDROID_DISPLAY_ENABLED "$android_display_choice"
if [[ "$android_display_choice" == true ]]; then
  if [[ -z "$(android_display_env_value HOMEPILOT_DISPLAY_ADB_CIDRS)" ]]; then
    if [[ -n "${HOMEPILOT_INSTALL_ANDROID_CIDRS:-}" ]]; then
      REPLY="$HOMEPILOT_INSTALL_ANDROID_CIDRS"
    else
      read_terminal_line 'CIDR privado autorizado para pantallas (ej. 192.168.1.0/24): ' \
        || fail 'Android Display requiere un CIDR privado; configúralo en .env antes de usar modo no interactivo.'
    fi
    android_display_validate_cidrs "$REPLY" || fail 'CIDR inválido; usa una subred RFC1918 /16 o más estrecha.'
    set_env_value HOMEPILOT_DISPLAY_ADB_CIDRS "$REPLY"
  fi
  if [[ -z "$(android_display_env_value HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT)" ]]; then
    set_env_value HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT 5002
  fi
  android_display_generate_token_if_missing
  chmod 600 "$ENV_FILE" || fail 'No se pudo proteger .env.'
  android_display_load
  if android_display_is_desktop; then
    android_display_desktop=true
  fi
  android_display_prepare_adb_home
  homepilot_image_enable_display
  ok 'Android Display habilitado; configuración persistente protegida.'
else
  ok 'Android Display deshabilitado; no se crea token ni identidad ADB.'
fi

if [[ "$profile" == bridge_ha ]]; then
  grep -q '^INTERNAL_HA_URL=http://host.docker.internal:8123$' "$ENV_FILE" \
    && ok "INTERNAL_HA_URL apunta al Home Assistant existente del host." \
    || warn "Revisa INTERNAL_HA_URL en .env para que apunte al Home Assistant real del cliente."
fi

mkdir -p data backups
if [[ -n "$cloud_url" || -n "$pairing_code" ]]; then
  [[ -n "$cloud_url" && -n "$pairing_code" ]] || fail "Usa --cloud-url y --pairing-code juntos."
  command -v node >/dev/null 2>&1 || fail "Node.js es necesario para reclamar el código de HomePilot Cloud."
  node scripts/claim-cloud-pairing.mjs "$cloud_url" "$pairing_code" || fail "No se pudo reclamar el código de emparejamiento."
  ok "HomePilot Cloud quedó configurado sin variables .env."
fi
camera_compose_args=(-f "$compose_file")
if [[ "$android_display_desktop" == true ]]; then
  if [[ "$profile" == ha_companion ]]; then
    camera_compose_args+=(-f docker-compose.ha-companion.desktop.yml)
  else
    camera_compose_args+=(-f docker-compose.desktop.yml)
  fi
fi
append_global_overlays
if [[ "$start" == true ]]; then
  export HOMEPILOT_BUILD_REVISION="$(homepilot_image_revision)"
  section 'Builder de HomePilot'
  homepilot_builder_ensure
  if [[ "$camera_enabled" == true ]]; then
    section 'Aceleración HLS de cámaras'
    camera_acceleration_select
    if [[ -n "$camera_acceleration_overlay" ]]; then
      camera_compose_args+=(-f "$camera_acceleration_overlay")
    fi
    camera_acceleration_report
  else
    camera_acceleration_overlay=''
    ok 'Cámaras nativas no seleccionadas; se omite el probe VAAPI.'
  fi
fi
if [[ "$android_display_enabled" == true ]]; then
  camera_compose_args+=(-f "$HOMEPILOT_DISPLAY_OVERLAY")
  [[ "$android_display_desktop" != true ]] || camera_compose_args+=(-f "$HOMEPILOT_DISPLAY_DESKTOP_OVERLAY")
fi
docker compose "${camera_compose_args[@]}" config --quiet
if [[ "$profile" == ha_companion ]]; then
  ok "Compose companion válido: administra Home Assistant junto a HomePilot."
else
  ok "Compose válido: no declara un servicio Home Assistant."
fi

if [[ "$start" == true ]]; then
  if [[ "$global_install" == true ]]; then
    HOMEPILOT_IMAGE_SERVICES=(api ui)
    build_services=(homepilot-api homepilot-ui)
    runtime_services=()
    if [[ "$mqtt_enabled" == true ]]; then
      runtime_services+=(homepilot-mqtt)
    fi
    if [[ "$profile" == ha_companion ]]; then
      runtime_services+=(homeassistant)
    fi
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
  section "Inicio de HomePilot"
  if confirm "Se construiran e iniciaran los servicios HomePilot de este compose. Continuar?"; then
    homepilot_image_prepare_rollback "${camera_compose_args[@]}"
    if [[ "$global_install" == true ]]; then
      if ! (COMPOSE_BAKE=false docker compose "${camera_compose_args[@]}" build --builder "$HOMEPILOT_BUILDER_NAME" "${build_services[@]}" \
        && docker compose "${camera_compose_args[@]}" up --no-build --no-deps -d "${runtime_services[@]}"); then
        if [[ -z "$camera_acceleration_overlay" ]]; then
          fail 'No se pudo iniciar el conjunto modular HomePilot; se conservan las imágenes de rollback.'
        fi
        warn 'El inicio con VAAPI falló; se reintentará con libx264.'
        camera_compose_args=(-f "$compose_file")
        if [[ "$android_display_desktop" == true ]]; then
          if [[ "$profile" == ha_companion ]]; then
            camera_compose_args+=(-f docker-compose.ha-companion.desktop.yml)
          else
            camera_compose_args+=(-f docker-compose.desktop.yml)
          fi
        fi
        append_global_overlays
        if [[ "$android_display_enabled" == true ]]; then
          camera_compose_args+=(-f "$HOMEPILOT_DISPLAY_OVERLAY")
          [[ "$android_display_desktop" != true ]] || camera_compose_args+=(-f "$HOMEPILOT_DISPLAY_DESKTOP_OVERLAY")
        fi
        camera_acceleration_overlay=''
        camera_acceleration_encoder='libx264'
        camera_acceleration_fallback='software (libx264)'
        camera_acceleration_reason='falló el inicio con el override VAAPI'
        camera_acceleration_report
        COMPOSE_BAKE=false docker compose "${camera_compose_args[@]}" build --builder "$HOMEPILOT_BUILDER_NAME" "${build_services[@]}"
        docker compose "${camera_compose_args[@]}" up --no-build --no-deps -d "${runtime_services[@]}"
      fi
    elif ! (COMPOSE_BAKE=false docker compose "${camera_compose_args[@]}" build --builder "$HOMEPILOT_BUILDER_NAME" \
      && docker compose "${camera_compose_args[@]}" up --no-build -d); then
      if [[ -z "$camera_acceleration_overlay" ]]; then
        fail 'No se pudo iniciar HomePilot.'
      fi
      warn 'El inicio con VAAPI falló; se reintentará con libx264.'
      camera_compose_args=(-f "$compose_file")
      if [[ "$android_display_desktop" == true ]]; then
        if [[ "$profile" == ha_companion ]]; then
          camera_compose_args+=(-f docker-compose.ha-companion.desktop.yml)
        else
          camera_compose_args+=(-f docker-compose.desktop.yml)
        fi
      fi
      if [[ "$android_display_enabled" == true ]]; then
        camera_compose_args+=(-f "$HOMEPILOT_DISPLAY_OVERLAY")
        [[ "$android_display_desktop" != true ]] || camera_compose_args+=(-f "$HOMEPILOT_DISPLAY_DESKTOP_OVERLAY")
      fi
      append_global_overlays
      camera_acceleration_overlay=''
      camera_acceleration_encoder='libx264'
      camera_acceleration_fallback='software (libx264)'
      camera_acceleration_reason='falló el inicio con el override VAAPI'
      camera_acceleration_report
      COMPOSE_BAKE=false docker compose "${camera_compose_args[@]}" build --builder "$HOMEPILOT_BUILDER_NAME"
      docker compose "${camera_compose_args[@]}" up --no-build -d
    fi
    docker compose "${camera_compose_args[@]}" ps
    if ! wait_for_runtime_ready; then
      startup_failed=true
    fi
  else
    warn "Inicio omitido por el operador."
  fi
fi

show_runtime_status
provision_home_assistant_community_integrations
show_home_assistant_community_status
if [[ "$start" == true && "$startup_failed" == false && "$runtime_failures" -eq 0 ]]; then
  homepilot_image_finalize_rollback "${camera_compose_args[@]}"
fi

section "Instalación preparada"
ui_port="$(env_value HOMEPILOT_UI_PORT 8080)"
printf '%b\n' "${BOLD}  HomePilot UI${NC}       http://127.0.0.1:${ui_port}"
printf '%b\n' "${BOLD}  HomePilot API${NC}      http://127.0.0.1:${ui_port}/health ${DIM}(vía UI)${NC}"
if [[ "$requires_home_assistant" == true ]]; then
  printf '%b\n' "${BOLD}  Home Assistant${NC}     http://127.0.0.1:${ha_port} ${DIM}(${ha_management_label})${NC}"
else
  printf '%b\n' "${BOLD}  Home Assistant${NC}     ${DIM}(no requerido por native_only)${NC}"
fi
printf '%b\n' "${BOLD}  Compose${NC}            ${compose_file} ${DIM}(${profile})${NC}"
printf '%b\n' "${DIM}  Despliegues siguientes: bash scripts/homepilot-maintenance.sh --deploy (selecciona aceleración automáticamente)${NC}"
divider

if [[ "$start" == true && ( "$startup_failed" == true || "$runtime_failures" -gt 0 ) ]]; then
  exit 1
fi
