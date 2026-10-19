#!/usr/bin/env bash

# Presentation and dispatch only. Existing scripts remain the operational engines.
# Each operation runs in a fresh strict Bash process: catching its exit status in
# the menu must never disable errexit inside the installer or expose its secrets.
# shellcheck source=/dev/null
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/brand.sh"
hp_admin_execute() {
  HOMEPILOT_INSTALLER_EMBEDDED=1 bash -c '
    set -euo pipefail
    source scripts/lib/homepilot-global-installer.sh
    hp_color_init
    hp_admin_operation "$1" "${2:-}"
  ' homepilot-operation "$1" "${2:-}"
}

hp_admin_require_root() {
  [[ "$(uname -s)" == Linux && "$(id -u)" == 0 ]] \
    || { hp_fail 'Esta operación requiere Linux y sudo; no se aplicaron cambios.'; return 1; }
}

hp_admin_existing_project() {
  local project
  project="$(docker inspect homepilot-api --format '{{index .Config.Labels "com.docker.compose.project"}}')" \
    || { hp_fail 'Proyecto Compose existente no verificable.'; return 1; }
  [[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] \
    || { hp_fail 'Proyecto Compose existente inválido.'; return 1; }
  [[ -z "${COMPOSE_PROJECT_NAME:-}" || "$COMPOSE_PROJECT_NAME" == "$project" ]] \
    || { hp_fail 'El proyecto solicitado no coincide con la instalación existente.'; return 1; }
  export COMPOSE_PROJECT_NAME="$project"
}

hp_admin_operation() {
  local operation="$1" confirmation="${2:-}" options=()
  [[ -z "$confirmation" || "$confirmation" == --yes ]] || { hp_fail 'Confirmación inválida.'; return 2; }
  [[ "$confirmation" != --yes ]] || options+=(--yes)
  case "$operation" in
    status) hp_global_diagnostic ;;
    update) bash scripts/homepilot-maintenance.sh --deploy "${options[@]}" ;;
    clean) bash scripts/homepilot-maintenance.sh --clean "${options[@]}" ;;
    images) bash scripts/homepilot-maintenance.sh --gc-homepilot "${options[@]}" ;;
    storage)
      source scripts/lib/appliance-storage-report.sh
      source scripts/lib/homepilot-builder.sh
      section() { hp_ui_block "$HP_PRIMARY$HP_BOLD" "$1"; hp_ui_separator; }
      info() { hp_ui_wrap_block "$HP_SECONDARY" "$1"; }
      ok() { hp_ok "$1"; }
      warn() { hp_warn "$1"; }
      storage_report
      homepilot_builder_report
      ;;
    components)
      hp_ui_block "$HP_PRIMARY$HP_BOLD" 'Configuración conservada'
      local key label value
      for key in HOMEPILOT_INSTALLATION_PROFILE HOMEPILOT_CAMERA_ENABLED \
        HOMEPILOT_ANDROID_DISPLAY_ENABLED HOMEPILOT_MQTT_ENABLED HOMEPILOT_HOME_CHAT_ENABLED HOMEPILOT_VOICE_ENABLED HOMEPILOT_TPM_ENABLED; do
        case "$key" in
          HOMEPILOT_INSTALLATION_PROFILE) label='Perfil' ;;
          HOMEPILOT_CAMERA_ENABLED) label='Cámaras' ;;
          HOMEPILOT_ANDROID_DISPLAY_ENABLED) label='Android Display' ;;
          HOMEPILOT_MQTT_ENABLED) label='MQTT' ;;
          HOMEPILOT_HOME_CHAT_ENABLED) label='Conversar con mi casa' ;;
          HOMEPILOT_VOICE_ENABLED) label='Voz' ;;
          HOMEPILOT_TPM_ENABLED) label='TPM declarado' ;;
        esac
        value="$(hp_saved_value "$key" 'No declarado')"
        case "$value" in true) value='Habilitado' ;; false) value='Deshabilitado' ;; esac
        hp_ui_review_row "$label" "$value"
      done
      hp_ui_wrap_block "$HP_SECONDARY" 'Las capacidades no declaradas requieren diagnóstico; no se infieren ni modifican aquí.'
      ;;
    community)
      local profile
      profile="$(hp_saved_value HOMEPILOT_INSTALLATION_PROFILE '')"
      case "$profile" in bridge_ha|ha_companion) ;; *) hp_fail 'Este perfil no utiliza Home Assistant.'; return 1 ;; esac
      hp_yes_no '¿Autorizar HACS/SonoffLAN en Home Assistant? No reconstruye '"$HP_BRAND"'.' false || return 0
      bash scripts/install-edge-office.sh --profile "$profile" --community-integrations-only --yes
      ;;
    mqtt-status) hp_admin_existing_project; bash scripts/configure-pc-agent-mqtt.sh status ;;
    mqtt-device)
      [[ -f data/mqtt/passwordfile ]] || { hp_fail 'MQTT no está preparado; no se habilitará automáticamente.'; return 1; }
      hp_read 'Nombre del agente MQTT (letras, números, _ o -):' || return 1
      [[ "$REPLY" =~ ^[A-Za-z0-9_-]+$ ]] || { hp_fail 'Nombre inválido.'; return 1; }
      local device="$REPLY"
      hp_yes_no '¿Añadir su credencial y reiniciar únicamente el broker MQTT?' false || return 0
      hp_admin_existing_project
      bash scripts/configure-pc-agent-mqtt.sh add-device --device-name "$device"
      ;;
    wol)
      [[ "$(hp_saved_value HOMEPILOT_INSTALLATION_PROFILE '')" == ha_companion ]] \
        || { hp_fail 'Wake-on-LAN administrado requiere Home Assistant incluido; no se tocará un HA externo.'; return 1; }
      hp_yes_no '¿Abrir la configuración Wake-on-LAN de Home Assistant?' false || return 0
      hp_admin_existing_project
      bash scripts/configure-wol-devices.sh
      ;;
    recovery)
      docker info >/dev/null 2>&1 || { hp_fail 'Docker no disponible; no se pueden verificar las protecciones.'; return 1; }
      hp_ui_wrap_block "$HP_SECONDARY" 'Las imágenes de rollback no son un backup de SQLite. No se restauran datos ni claves TPM desde este menú.'
      if [[ -d backups ]]; then du -sh -- backups; else hp_warn 'No existe el directorio de backups.'; fi
      local service tag image pending=false
      for service in api ui stt tts display-bridge; do
        for tag in "homepilot-rollback-${service}:latest" "homepilot-rollback-pending-${service}:latest"; do
          if image="$(docker image inspect --format '{{.Id}}' "$tag" 2>/dev/null)"; then
            hp_ui_review_row "$tag" "$image"
            [[ "$tag" != *-pending-* ]] || pending=true
          fi
        done
      done
      [[ "$pending" != true ]] || hp_warn 'Hay imágenes pendientes: no las elimines ni sobrescribas sin revisar el despliegue fallido.'
      hp_ui_wrap_block "$HP_SECONDARY" 'Creación/restauración automática de backups pendiente de un procedimiento validado. No se ejecuta ninguna recuperación.'
      ;;
    repair)
      hp_admin_require_root
      hp_ui_select 'Componente a reparar' 'Paquetes base y Docker' 'Servicio Cloudflare' 'Volver' || return 1
      case "$REPLY" in
        1) hp_yes_no '¿Reparar paquetes base y Docker?' false || return 0; hp_install_base; hp_install_docker ;;
        2) hp_remote=true; hp_yes_no '¿Reparar servicio Cloudflare?' false || return 0; hp_configure_cloudflared ;;
        3) return 0 ;;
      esac
      ;;
    complete)
      [[ "$(hp_saved_value HOMEPILOT_GLOBAL_INSTALLER_VERSION '')" == v1 ]] \
        || { hp_fail 'Instalación histórica: usa su procedimiento de pairing; no se cambiará el perfil.'; return 1; }
      hp_admin_require_root
      hp_yes_no '¿Completar configuración pendiente sin reemplazar identidades existentes?' false || return 0
      hp_remote=true
      hp_complete_pending_runtime
      if ! hp_is_paired; then
        hp_read 'URL pública '"$HP_BRAND"' asignada por '"$HP_BRAND_COMPANY"' (https://...):' || return 1
        hp_edge_hostname="$REPLY"
        hp_valid_edge_url "$hp_edge_hostname" || { hp_fail 'URL pública inválida.'; return 1; }
      fi
      hp_verify_tpm
      hp_configure_cloudflared
      hp_pair_directory
      hp_bind_identity
      ;;
    *) hp_fail 'Operación no reconocida; no se ejecutó ningún comando.'; return 2 ;;
  esac
}

hp_admin_present() {
  hp_ui_view "$1"
  local result=0
  hp_admin_execute "$2" || result=$?
  HP_ADMIN_LAST_RESULT="$result"
  printf '\n'
  if (( result == 0 )); then
    hp_ok 'Operación finalizada. Revisa los resultados y pendientes indicados.'
  else
    hp_warn "Operación no completada (código ${result}). No se declara éxito."
  fi
  if [[ "$HP_UI_TTY" == true ]]; then hp_ui_read_raw 'Pulsa ENTER para volver: ' || return 1; fi
}

hp_admin_submenu() {
  local menu="$1"
  while true; do
    hp_ui_view "$menu"
    case "$menu" in
      COMPONENTES)
        hp_ui_block "$HP_SECONDARY" '1. Configuración actual · solo lectura'
        hp_ui_block "$HP_SECONDARY" '2. Estado MQTT · solo lectura'
        hp_ui_block "$HP_SECONDARY" '3. Añadir agente MQTT'
        hp_ui_block "$HP_SECONDARY" '4. Wake-on-LAN · HA administrado'
        hp_ui_block "$HP_SECONDARY" '5. HACS / SonoffLAN'
        ;;
      ALMACENAMIENTO)
        hp_ui_block "$HP_SECONDARY" '1. Informe de espacio · solo lectura'
        hp_ui_block "$HP_SECONDARY" '2. Limpiar imágenes '"$HP_BRAND"' verificadas'
        hp_ui_block "$HP_SECONDARY" '3. Retirar contenedores detenidos'
        hp_ui_wrap_block "$HP_SECONDARY" 'La limpieza requiere confirmación. No elimina datos, backups, volúmenes ni caché global.'
        ;;
    esac
    hp_ui_block "$HP_SECONDARY" '0. Volver'
    hp_ui_read_raw 'Selecciona: ' || return 1
    case "$menu:$REPLY" in
      *:0) return 0 ;;
      COMPONENTES:1) hp_admin_present 'CONFIGURACIÓN ACTUAL' components ;;
      COMPONENTES:2) hp_admin_present 'ESTADO MQTT' mqtt-status ;;
      COMPONENTES:3) hp_admin_present 'AGENTE MQTT' mqtt-device ;;
      COMPONENTES:4) hp_admin_present 'WAKE-ON-LAN' wol ;;
      COMPONENTES:5) hp_admin_present 'INTEGRACIONES HOME ASSISTANT' community ;;
      ALMACENAMIENTO:1) hp_admin_present 'INFORME DE ESPACIO' storage ;;
      ALMACENAMIENTO:2) hp_admin_present 'LIMPIEZA DE IMÁGENES' images ;;
      ALMACENAMIENTO:3) hp_admin_present 'CONTENEDORES DETENIDOS' clean ;;
      *) hp_warn 'Selecciona una opción válida.' ;;
    esac
  done
}

hp_admin_menu() {
  local HP_ADMIN_LAST_RESULT=0
  hp_banner
  while true; do
    hp_ui_view 'ADMINISTRACIÓN DE LA INSTALACIÓN'
    hp_ui_review_row 'Perfil guardado' "$(hp_saved_value HOMEPILOT_INSTALLATION_PROFILE 'No declarado')"
    hp_ui_block "$HP_SECONDARY" '1. Estado y diagnóstico · solo lectura'
    hp_ui_block "$HP_SECONDARY" '2. Actualizar instalación existente'
    hp_ui_block "$HP_SECONDARY" '3. Componentes'
    hp_ui_block "$HP_SECONDARY" '4. Almacenamiento y limpieza'
    hp_ui_block "$HP_SECONDARY" '5. Backups y recuperación · consultar'
    hp_ui_block "$HP_SECONDARY" '6. Reparar componentes'
    hp_ui_block "$HP_SECONDARY" '7. Completar configuración pendiente'
    hp_ui_block "$HP_SECONDARY" "8. Salida técnica: $([[ "${HOMEPILOT_VERBOSE:-0}" == 1 ]] && printf detallada || printf resumida)"
    hp_ui_block "$HP_SECONDARY" '0. Salir'
    hp_ui_read_raw 'Selecciona: ' || return 1
    case "$REPLY" in
      0) hp_ok 'Consola cerrada. No se realizan acciones adicionales.'; return "$HP_ADMIN_LAST_RESULT" ;;
      1) hp_admin_present 'ESTADO / DIAGNÓSTICO' status ;;
      2) hp_admin_present 'ACTUALIZAR INSTALACIÓN' update ;;
      3) hp_admin_submenu COMPONENTES ;;
      4) hp_admin_submenu ALMACENAMIENTO ;;
      5) hp_admin_present 'BACKUPS Y RECUPERACIÓN' recovery ;;
      6) hp_admin_present 'REPARAR COMPONENTES' repair ;;
      7) hp_admin_present 'COMPLETAR CONFIGURACIÓN' complete ;;
      8) if [[ "${HOMEPILOT_VERBOSE:-0}" == 1 ]]; then export HOMEPILOT_VERBOSE=0; else export HOMEPILOT_VERBOSE=1; fi ;;
      *) hp_warn 'Selecciona una opción entre 0 y 8.' ;;
    esac
  done
}

hp_admin_cli() {
  local operation confirmation="${2:-}"
  if (( $# > 2 )) || [[ -n "$confirmation" && "$confirmation" != --yes ]]; then
    hp_fail 'Argumentos inválidos; usa --help.'; return 2
  fi
  case "$1" in
    --help)
      printf '%s\n' ''"$HP_BRAND"' · Administración de la instalación' \
        'Sin argumentos: asistente nuevo o menú de instalación existente.' \
        '--status: diagnóstico de solo lectura.' '--deploy: actualizar, con confirmación.' \
        '--clean: retirar contenedores detenidos, con confirmación.' \
        '--gc-homepilot: limpiar imágenes verificadas, con confirmación.' \
        '--components: consultar configuración.' '--storage: consultar espacio.' \
        '--recovery: consultar protecciones; no restaura datos.' \
        '--yes: solo para --deploy, --clean o --gc-homepilot.'
      printf '%s\n' '--verbose: salida técnica de operaciones; sin TTY se conserva la salida completa.'
      return 0 ;;
    --status) operation=status ;;
    --deploy) operation=update ;;
    --clean) operation=clean ;;
    --gc-homepilot) operation=images ;;
    --components) operation=components ;;
    --storage) operation=storage ;;
    --recovery) operation=recovery ;;
    *) hp_fail 'Opción desconocida; usa --help.'; return 2 ;;
  esac
  if [[ -n "$confirmation" && "$operation" != update && "$operation" != clean && "$operation" != images ]]; then
    hp_fail '--yes solo se admite para operaciones con confirmación.'; return 2
  fi
  hp_banner
  hp_admin_execute "$operation" "$confirmation"
}
