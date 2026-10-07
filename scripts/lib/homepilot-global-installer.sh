#!/usr/bin/env bash

source "$(dirname "${BASH_SOURCE[0]}")/android-display-appliance.sh"
source "$(dirname "${BASH_SOURCE[0]}")/api-health.sh"
source "$(dirname "${BASH_SOURCE[0]}")/homepilot-terminal-ui.sh"

hp_client=''
hp_installation=''
hp_hostname=''
hp_change_hostname=false
hp_profile=''
hp_cameras=false
hp_android=false
hp_android_cidrs=''
hp_mqtt=false
hp_mqtt_username=''
hp_mqtt_bind_address=''
hp_voice=true
hp_remote=true
hp_community=false
hp_edge_hostname=''
hp_pairing_changed=false

hp_valid_name() {
  # Explicit Latin letters avoid locale-dependent collating ranges (À-ÿ).
  local letters='[:alnum:]ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ'
  local pattern="^[$letters][$letters[:space:]._-]*$"
  [[ -n "$1" && ${#1} -le 80 && "$1" =~ $pattern ]]
}
hp_valid_hostname() { [[ ${#1} -le 63 && "$1" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; }
hp_valid_edge_url() { [[ "$1" =~ ^https://([a-z0-9-]+\.)+nezuecuador\.com(:[0-9]+)?$ ]]; }
hp_valid_lan_ip() {
  local a b c d octet
  [[ "$1" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || return 1
  IFS=. read -r a b c d <<< "$1"
  for octet in "$a" "$b" "$c" "$d"; do (( 10#$octet <= 255 )) || return 1; done
  (( (10#$a == 10) || (10#$a == 172 && 10#$b >= 16 && 10#$b <= 31) || (10#$a == 192 && 10#$b == 168) ))
}
hp_existing_installation() { [[ -f .env || -f data/homepilot.db ]]; }
hp_tpm_device_available() { [[ -e /dev/tpm0 && -c /dev/tpmrm0 ]]; }
hp_systemd_service_directory() { printf '%s' /etc/systemd/system; }
hp_saved_value() {
  local value=''
  if [[ -f .env ]]; then value="$(sed -n "s/^$1=//p" .env | tail -n 1)"; fi
  value="${value%$'\r'}"
  printf '%s' "${value:-$2}"
}

hp_collect_information() {
  hp_step 1 'INFORMACIÓN DEL CLIENTE'
  hp_read 'Nombre del cliente: ' || hp_fail 'Falta nombre del cliente.'
  hp_client="$REPLY"
  hp_valid_name "$hp_client" || hp_fail 'Nombre del cliente inválido.'
  hp_ui_confirm_value "$hp_client"
  hp_read 'Nombre de la instalación: ' || hp_fail 'Falta nombre de instalación.'
  hp_installation="$REPLY"
  hp_valid_name "$hp_installation" || hp_fail 'Nombre de instalación inválido.'
  hp_ui_confirm_value "$hp_installation"
  hp_read 'Hostname de la MiniPC: ' || hp_fail 'Falta hostname.'
  hp_hostname="$REPLY"
  hp_valid_hostname "$hp_hostname" || hp_fail 'Hostname Linux inválido.'
  hp_ui_confirm_value "$hp_hostname"
  if [[ "$hp_hostname" != "$(hostname)" ]]; then
    if hp_yes_no "¿Cambiar el hostname actual a ${hp_hostname}?" false; then hp_change_hostname=true; fi
  fi
}

hp_collect_architecture() {
  hp_step 4 'ARQUITECTURA DEL CLIENTE'
  hp_ui_select '¿Cómo se integrarán los dispositivos?' \
    'Home Assistant existente' 'Instalar Home Assistant' 'Solo HomePilot' \
    || hp_fail 'Falta selección Home Assistant.'
  case "$REPLY" in
    1) hp_profile=bridge_ha ;;
    2) hp_profile=ha_companion ;;
    3) hp_profile=native_only ;;
    *) hp_fail 'Selección Home Assistant inválida.' ;;
  esac
  if [[ "$hp_profile" == bridge_ha ]]; then
    if hp_yes_no '¿Autorizar instalar HACS y SonoffLAN si faltan?' false; then hp_community=true; fi
  fi
  hp_step 5 'CAPACIDADES OPCIONALES'
  hp_ui_block "$HP_SECONDARY" 'Las cámaras RTSP/ONVIF se integran directamente en HomePilot.'
  if hp_yes_no '¿El cliente tendrá cámaras administradas por HomePilot?' false; then hp_cameras=true; fi
  if hp_yes_no '¿El cliente tendrá una pizarra o pantalla Android administrada?' false; then
    hp_android=true
    hp_read 'CIDR LAN autorizado (ej. 192.168.1.0/24): ' || hp_fail 'Falta CIDR Android.'
    hp_android_cidrs="$REPLY"
    android_display_validate_cidrs "$hp_android_cidrs" || hp_fail 'CIDR Android inválido.'
    hp_ui_confirm_value "$hp_android_cidrs"
  fi
  if hp_yes_no '¿Esta instalación utilizará dispositivos o agentes MQTT?' false; then
    hp_mqtt=true
    hp_read 'IP LAN de esta MiniPC para MQTT (no 0.0.0.0): ' || hp_fail 'Falta IP LAN MQTT.'
    hp_mqtt_bind_address="$REPLY"
    hp_valid_lan_ip "$hp_mqtt_bind_address" || hp_fail 'IP LAN MQTT inválida o no privada.'
    hp_ui_confirm_value "$hp_mqtt_bind_address"
    if [[ ! -f data/mqtt/passwordfile ]]; then
      hp_read 'Usuario MQTT para Home Assistant/agentes: ' || hp_fail 'Falta usuario MQTT.'
      hp_mqtt_username="$REPLY"
      [[ "$hp_mqtt_username" =~ ^[A-Za-z0-9_-]+$ ]] || hp_fail 'Usuario MQTT inválido.'
      hp_ui_confirm_value "$hp_mqtt_username"
    fi
  fi
  if ! hp_yes_no '¿Habilitar voz local HomePilot?' true; then hp_voice=false; fi
  hp_step 6 'ACCESO REMOTO Y DIRECTORY'
  if ! hp_yes_no '¿Configurar acceso remoto administrado por NEZU?' true; then hp_remote=false; fi
  if [[ "$hp_remote" == true ]]; then
    hp_read 'URL pública HomePilot asignada por NEZU (https://...): ' || hp_fail 'Falta URL pública.'
    hp_edge_hostname="$REPLY"
    hp_valid_edge_url "$hp_edge_hostname" || hp_fail 'URL pública inválida.'
    hp_ui_confirm_value "$hp_edge_hostname"
  fi
}

hp_plan_compose() {
  local base='docker-compose.office.yml'
  [[ "$hp_profile" != ha_companion ]] || base='docker-compose.yml'
  printf '%s + docker-compose.tpm.yml' "$base"
  [[ "$hp_cameras" != true ]] || printf ' + VAAPI/libx264'
  [[ "$hp_android" != true ]] || printf ' + docker-compose.android-display.yml'
  [[ "$hp_mqtt" != true || "$hp_profile" == ha_companion ]] || printf ' + docker-compose.pc-agents.yml'
  [[ "$hp_mqtt" != true || "$hp_profile" != ha_companion ]] || printf ' + docker-compose.mqtt-secure.yml'
  [[ "$hp_voice" != true ]] || printf ' + STT/TTS'
}

hp_summary() {
  local ha_label='No requerido'
  [[ "$hp_profile" != bridge_ha ]] || ha_label='Existente'
  [[ "$hp_profile" != ha_companion ]] || ha_label='Administrado'
  hp_step 7 'REVISAR CONFIGURACIÓN'
  hp_ui_review_row 'Cliente' "$hp_client"
  hp_ui_review_row 'Instalación' "$hp_installation"
  hp_ui_review_row 'Home Assistant' "$ha_label"
  hp_ui_review_row 'Cámaras' "$(hp_ui_yes_label "$hp_cameras")"
  hp_ui_review_row 'Android Display' "$(hp_ui_yes_label "$hp_android")"
  hp_ui_review_row 'MQTT' "$(hp_ui_yes_label "$hp_mqtt")"
  hp_ui_review_row 'Voz' "$(hp_ui_yes_label "$hp_voice")"
  hp_ui_review_row 'Cloudflare' "$(hp_ui_yes_label "$hp_remote")"
  hp_ui_review_row 'TPM 2.0' 'Detectado'
  printf '\n'
  hp_ui_block "$HP_SECONDARY" 'Servicios Compose seleccionados:'
  hp_ui_wrap_block "$HP_SECONDARY" "$(hp_plan_compose)"
}

hp_preflight() {
  [[ "$(id -u)" == 0 ]] || hp_fail 'Ejecuta con sudo: sudo bash scripts/homepilot-install.sh'
  [[ "$(uname -s)" == Linux ]] || hp_fail 'Se requiere Linux.'
  [[ "$(uname -m)" == x86_64 ]] || hp_fail 'Se requiere arquitectura x86_64.'
  local ID='' VERSION_ID='' UBUNTU_CODENAME='' VERSION_CODENAME=''
  source /etc/os-release
  [[ "$ID" == ubuntu && "$VERSION_ID" =~ ^(22\.04|24\.04|26\.04)$ ]] || hp_fail 'Se requiere Ubuntu LTS compatible (22.04, 24.04 o 26.04).'
  local free_kib
  free_kib="$(df -Pk . | awk 'NR==2 {print $4}')"
  [[ "$free_kib" =~ ^[0-9]+$ ]] && (( free_kib >= 20 * 1024 * 1024 )) || hp_fail 'Se requieren al menos 20 GiB libres.'
  getent ahostsv4 download.docker.com >/dev/null \
    && timeout 8 bash -c 'exec 3<>/dev/tcp/download.docker.com/443' >/dev/null 2>&1 \
    || hp_fail 'No hay conectividad de instalación.'
  hp_ok "Ubuntu ${VERSION_ID} · x86_64 · espacio y red verificados."
  hp_tpm_device_available || hp_fail 'TPM 2.0 no disponible: faltan /dev/tpm0 o /dev/tpmrm0.'
}

hp_install_base() {
  local missing=() package
  for package in ca-certificates curl jq openssh-server; do
    dpkg-query -W -f='${Status}' "$package" 2>/dev/null | grep -q 'install ok installed' || missing+=("$package")
  done
  if (( ${#missing[@]} > 0 )); then
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing[@]}"
  fi
  systemctl enable --now ssh >/dev/null
  hp_ok 'Paquetes base y SSH local disponibles.'
}

hp_install_docker() {
  if command -v docker >/dev/null && docker info >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && docker buildx version >/dev/null 2>&1; then
    hp_ok 'Docker Engine, Compose y Buildx existentes reutilizados.'
    return
  fi
  if command -v docker >/dev/null && ! docker info >/dev/null 2>&1; then
    hp_fail 'Docker existente no está operativo; revísalo antes de instalar o reemplazar paquetes.'
    return 1
  fi
  local ID='' VERSION_ID='' UBUNTU_CODENAME='' VERSION_CODENAME=''
  source /etc/os-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' \
    "${UBUNTU_CODENAME:-$VERSION_CODENAME}" "$(dpkg --print-architecture)" >/etc/apt/sources.list.d/docker.sources
  apt-get update -qq
  if command -v docker >/dev/null; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker-buildx-plugin docker-compose-plugin
  else
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
  systemctl enable --now docker >/dev/null
  docker info >/dev/null && docker compose version >/dev/null && docker buildx version >/dev/null || hp_fail 'Docker no quedó operativo.'
  hp_ok 'Docker Engine, Compose Plugin y Buildx instalados.'
}

hp_verify_tpm() {
  hp_tpm_device_available || hp_fail 'TPM 2.0 no disponible.'
  if ! command -v tpm2_getcap >/dev/null || ! command -v tpm2_getrandom >/dev/null; then
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y tpm2-tools
  fi
  TPM2TOOLS_TCTI=device:/dev/tpmrm0 tpm2_getcap properties-fixed >/dev/null 2>&1 || hp_fail 'El TPM no responde a tpm2_getcap.'
  TPM2TOOLS_TCTI=device:/dev/tpmrm0 tpm2_getrandom 8 >/dev/null 2>&1 || hp_fail 'El TPM no genera entropía.'
  hp_ok 'TPM 2.0 funcional; sin fallback software.'
}

hp_install_cloudflared_binary() {
  command -v cloudflared >/dev/null && return
  install -m 0755 -d /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
  printf 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main\n' \
    >/etc/apt/sources.list.d/cloudflared.list
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y cloudflared
}

hp_configure_cloudflared() {
  [[ "$hp_remote" == true ]] || return 0
  local already_active=false service_dir
  systemctl is-active --quiet cloudflared && already_active=true
  hp_install_cloudflared_binary
  if ! systemctl cat cloudflared >/dev/null 2>&1; then
    hp_secret 'Cloudflare Tunnel Token (oculto): ' || hp_fail 'Falta Tunnel Token.'
    local tunnel_token="$REPLY"
    [[ -n "$tunnel_token" ]] || hp_fail 'Tunnel Token vacío.'
    cloudflared service install "$tunnel_token" >/dev/null 2>&1 || { tunnel_token=''; hp_fail 'No se pudo instalar el servicio cloudflared.'; return 1; }
    tunnel_token=''
    REPLY=''
  fi
  service_dir="$(hp_systemd_service_directory)"
  install -m 0755 -d "$service_dir/cloudflared.service.d"
  printf '[Service]\nRestart=on-failure\nRestartSec=5s\n' >"$service_dir/cloudflared.service.d/homepilot-restart.conf"
  systemctl daemon-reload
  systemctl enable --now cloudflared >/dev/null 2>&1 || hp_fail 'cloudflared no inició.'
  systemctl is-active --quiet cloudflared || hp_fail 'cloudflared no está active.'
  if [[ "$already_active" == true ]]; then
    hp_ok 'Cloudflare Tunnel existente reutilizado y supervisado.'
  else
    hp_ok 'Cloudflare Tunnel activo y configurado para reiniciar ante fallo.'
  fi
}

hp_prepare_mqtt() {
  [[ "$hp_mqtt" == true ]] || return 0
  local interfaces
  interfaces="$(ip -4 -o addr show)"
  [[ " $interfaces" == *" inet ${hp_mqtt_bind_address}/"* ]] || hp_fail 'La IP LAN MQTT no pertenece a esta MiniPC.'
  [[ ! -f data/mqtt/passwordfile ]] || return 0
  bash scripts/configure-pc-agent-mqtt.sh init --ha-username "$hp_mqtt_username" --prepare-only
}

hp_deploy() {
  export HOMEPILOT_GLOBAL_INSTALL=true HOMEPILOT_INSTALL_TPM_ENABLED=true
  export HOMEPILOT_INSTALL_CAMERA_ENABLED="$hp_cameras" HOMEPILOT_INSTALL_ANDROID_CHOICE="$hp_android"
  export HOMEPILOT_INSTALL_ANDROID_CIDRS="$hp_android_cidrs" HOMEPILOT_INSTALL_MQTT_ENABLED="$hp_mqtt"
  export HOMEPILOT_INSTALL_MQTT_BIND_ADDRESS="$hp_mqtt_bind_address"
  if [[ "$hp_mqtt" == true ]]; then export HOMEPILOT_MQTT_BIND_ADDRESS="$hp_mqtt_bind_address"; fi
  export HOMEPILOT_INSTALL_VOICE_ENABLED="$hp_voice" HOMEPILOT_INSTALL_CLIENT_NAME="$hp_client"
  export HOMEPILOT_INSTALL_NAME="$hp_installation" HOMEPILOT_BUILD_REVISION="${HOMEPILOT_BUILD_REVISION:-installer-v1}"
  local options=(--profile "$hp_profile" --start --yes)
  [[ "$hp_community" != true ]] || options+=(--with-community-integrations)
  bash scripts/install-edge-office.sh "${options[@]}"
}

hp_is_paired() {
  [[ -s data/cloud-gateway.json ]] && jq -e '
    (.url | type) == "string" and (.token | type) == "string" and
    (.homeId | type) == "string" and (.edgeId | type) == "string"
  ' data/cloud-gateway.json >/dev/null 2>&1
}
hp_binding_status() { docker exec homepilot-api node dist/scripts/enroll-edge-device.js --status | tail -n 1; }

hp_pair_directory() {
  [[ "$hp_remote" == true ]] || return 0
  if hp_is_paired; then hp_ok 'Directory Edge pairing existente reutilizado.'; return; fi
  local directory_url='https://accounts.nezuecuador.com'
  hp_secret 'Código temporal de pairing (oculto): ' || hp_fail 'Falta código de pairing.'
  local pairing_code="$REPLY"
  [[ -n "$pairing_code" ]] || hp_fail 'Código de pairing vacío.'
  printf '%s' "$pairing_code" | docker exec -i homepilot-api node scripts/claim-cloud-pairing.mjs \
    "$directory_url" --code-stdin "$hp_edge_hostname" >/dev/null 2>&1 \
    || { pairing_code=''; hp_fail 'Directory rechazó el pairing.'; return 1; }
  pairing_code='' REPLY=''
  hp_is_paired || hp_fail 'Directory no guardó el pairing.'
  hp_pairing_changed=true
  hp_ok 'Directory Edge emparejado.'
}

hp_bind_identity() {
  [[ "$hp_remote" == true ]] || { hp_warn 'Directory y binding pendientes: acceso remoto no configurado.'; return 0; }
  hp_is_paired || hp_fail 'No se puede enrolar sin Directory Edge pairing.'
  docker exec homepilot-api test -c /dev/tpmrm0 || hp_fail 'TPM inaccesible desde homepilot-api.'
  local status
  status="$(hp_binding_status)" || hp_fail 'No se pudo consultar el estado del binding.'
  if [[ "$status" == bound ]]; then
    hp_ok 'Identidad TPM ya bound; no se repite enrollment.'
    if [[ "$hp_pairing_changed" == true ]]; then
      docker restart homepilot-api >/dev/null || hp_fail 'No se pudo reiniciar la API tras el pairing.'
    fi
  else
    [[ "$status" == unbound ]] || hp_fail 'Estado de binding desconocido.'
    [[ "$(homepilot_api_health_status || true)" == 200 ]] || hp_fail 'API no saludable antes del enrollment.'
    if TPM2TOOLS_TCTI=device:/dev/tpmrm0 tpm2_getcap handles-persistent 2>/dev/null | grep -qi '0x81010090'; then
      hp_fail 'Handle TPM 0x81010090 ocupado; no se reemplazará ninguna clave.'
      return 1
    fi
    docker exec homepilot-api node dist/scripts/enroll-edge-device.js >/dev/null || hp_fail 'Enrollment TPM rechazado.'
    status="$(hp_binding_status)" || hp_fail 'No se pudo verificar el binding.'
    [[ "$status" == bound ]] || hp_fail 'El binding no quedó persistido.'
    TPM2TOOLS_TCTI=device:/dev/tpmrm0 tpm2_getcap handles-persistent 2>/dev/null | grep -qi '0x81010090' \
      || hp_fail 'No aparece el handle TPM después del enrollment.'
    docker restart homepilot-api >/dev/null || hp_fail 'No se pudo reiniciar la API.'
  fi
  local attempt
  for attempt in {1..24}; do
    if [[ "$(homepilot_api_health_status || true)" == 200 ]]; then
      hp_ok 'Identidad TPM bound; API healthy después del reinicio.'
      return 0
    fi
    sleep 5
  done
  hp_fail 'API NOT READY o DEVICE_IDENTITY_INVALID tras verificar binding.'
}

hp_lan_address() {
  local address
  address="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") {print $(i+1); exit}}')"
  [[ -n "$address" ]] || address="$(hostname -I 2>/dev/null | awk '{print $1}')"
  printf '%s' "${address:-IP-DE-LA-MINIPC}"
}

hp_complete_pending_runtime() {
  [[ "$(homepilot_api_health_status || true)" != 200 ]] || return 0
  [[ "$(hp_saved_value HOMEPILOT_GLOBAL_INSTALLER_VERSION '')" == v1 ]] \
    || hp_fail 'La instalación existente no tiene un plan global guardado; no se cambiará su perfil.'
  hp_yes_no 'La API no está saludable. ¿Reanudar el despliegue guardado?' false || return 1
  hp_profile="$(hp_saved_value HOMEPILOT_INSTALLATION_PROFILE '')"
  case "$hp_profile" in bridge_ha|ha_companion|native_only) ;; *) hp_fail 'Perfil guardado inválido.' ;; esac
  hp_client="$(hp_saved_value HOMEPILOT_CLIENT_NAME '')"
  hp_installation="$(hp_saved_value HOMEPILOT_INSTALLATION_NAME '')"
  hp_cameras="$(hp_saved_value HOMEPILOT_CAMERA_ENABLED false)"
  hp_android="$(hp_saved_value HOMEPILOT_ANDROID_DISPLAY_ENABLED false)"
  hp_android_cidrs="$(hp_saved_value HOMEPILOT_DISPLAY_ADB_CIDRS '')"
  hp_mqtt="$(hp_saved_value HOMEPILOT_MQTT_ENABLED false)"
  hp_mqtt_bind_address="$(hp_saved_value HOMEPILOT_MQTT_BIND_ADDRESS '')"
  hp_voice="$(hp_saved_value HOMEPILOT_VOICE_ENABLED true)"
  local flag
  for flag in "$hp_cameras" "$hp_android" "$hp_mqtt" "$hp_voice"; do
    [[ "$flag" == true || "$flag" == false ]] || hp_fail 'El plan guardado contiene una capacidad inválida.'
  done
  [[ "$hp_android" != true ]] || android_display_validate_cidrs "$hp_android_cidrs" \
    || hp_fail 'El CIDR Android guardado es inválido.'
  [[ "$hp_mqtt" != true ]] || hp_valid_lan_ip "$hp_mqtt_bind_address" \
    || hp_fail 'La IP MQTT guardada es inválida.'
  if [[ "$hp_mqtt" == true && ! -f data/mqtt/passwordfile ]]; then
    hp_read 'Usuario MQTT para completar el broker: ' || hp_fail 'Falta usuario MQTT.'
    hp_mqtt_username="$REPLY"
    [[ "$hp_mqtt_username" =~ ^[A-Za-z0-9_-]+$ ]] || hp_fail 'Usuario MQTT inválido.'
    hp_ui_confirm_value "$hp_mqtt_username"
  fi
  hp_verify_tpm
  hp_prepare_mqtt
  hp_deploy
}

hp_finish() {
  hp_step 8 'INSTALACIÓN FINALIZADA'
  hp_ui_center "$HP_AMBER$HP_BOLD" 'HOMEPILOT INSTALLATION READY'
  printf '\n'
  hp_ui_status '✓' "$HP_GREEN" 'API' 'Healthy'
  hp_ui_status '✓' "$HP_GREEN" 'UI' 'Online'
  if [[ "$hp_remote" == true ]]; then
    hp_ui_status '✓' "$HP_GREEN" 'TPM 2.0' 'Bound'
    hp_ui_status '✓' "$HP_GREEN" 'Directory Edge' 'Paired'
    hp_ui_status '✓' "$HP_GREEN" 'Cloudflare Tunnel' 'Connected'
  else
    hp_ui_status '●' "$HP_YELLOW" 'TPM 2.0' 'Verificado · binding pendiente'
    hp_ui_status '—' "$HP_SECONDARY" 'Directory Edge' 'Pendiente'
    hp_ui_status '—' "$HP_SECONDARY" 'Cloudflare Tunnel' 'No configurado'
  fi
  printf '\n'
  hp_ui_review_row 'Home Assistant' "$hp_profile"
  hp_ui_review_row 'Cámaras nativas' "$(hp_ui_yes_label "$hp_cameras")"
  hp_ui_review_row 'Android Display' "$(hp_ui_yes_label "$hp_android")"
  hp_ui_review_row 'MQTT' "$(hp_ui_yes_label "$hp_mqtt")"
  hp_ui_review_row 'Voz' "$(hp_ui_yes_label "$hp_voice")"
  local ui_port=8080
  if [[ -f .env ]]; then ui_port="$(sed -n 's/^HOMEPILOT_UI_PORT=//p' .env | tail -n 1)"; ui_port="${ui_port:-8080}"; fi
  printf '\n'
  hp_ui_block "$HP_PRIMARY" 'HomePilot'
  hp_ui_block "$HP_AMBER" "http://$(hp_lan_address):${ui_port}"
  hp_ui_wrap_block "$HP_SECONDARY" 'Desde ahí: crear administrador, configurar integraciones, completar onboarding y Dashboard.'
  printf '\n'
  hp_ui_center "$HP_GREEN" 'Installation completed successfully.'
}

hp_diag_api_status() { homepilot_api_health_status 2>/dev/null || true; }
hp_diag_http_status() {
  curl --silent --output /dev/null --write-out '%{http_code}' --max-time 6 "$1" 2>/dev/null || true
}
hp_diag_ha_status() {
  docker exec homepilot-api sh -c '
    url="${INTERNAL_HA_URL:-}"
    [ -n "$url" ] || exit 1
    curl --silent --output /dev/null --write-out "%{http_code}" --max-time 6 "$url"
  ' 2>/dev/null || true
}
hp_diag_container_state() {
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    "$1" 2>/dev/null || printf absent
}
hp_diag_cloudflared_state() {
  if systemctl is-active --quiet cloudflared 2>/dev/null; then
    printf active
  elif systemctl cat cloudflared >/dev/null 2>&1; then
    printf inactive
  else
    printf absent
  fi
}
hp_diag_binding_status() { hp_binding_status 2>/dev/null || true; }

hp_diag_failure() {
  hp_ui_status '✕' "$HP_RED" "$1" "$2"
  hp_diagnostic_failures=$((hp_diagnostic_failures + 1))
}

hp_global_diagnostic() {
  local profile android voice mqtt ui_port code state binding
  hp_diagnostic_failures=0
  profile="$(hp_saved_value HOMEPILOT_INSTALLATION_PROFILE '')"
  android="$(hp_saved_value HOMEPILOT_ANDROID_DISPLAY_ENABLED false)"
  voice="$(hp_saved_value HOMEPILOT_VOICE_ENABLED true)"
  mqtt="$(hp_saved_value HOMEPILOT_MQTT_ENABLED false)"
  ui_port="$(hp_saved_value HOMEPILOT_UI_PORT 8080)"

  hp_ui_view 'ESTADO / DIAGNÓSTICO'
  hp_ui_center "$HP_SOFT" 'ESTADO DEL SISTEMA'
  printf '\n'

  code="$(hp_diag_api_status)"
  if [[ "$code" == 200 ]]; then
    hp_ui_status '✓' "$HP_GREEN" 'HomePilot API' 'Healthy'
  else
    hp_diag_failure 'HomePilot API' "Unavailable (HTTP ${code:-000})"
  fi
  code="$(hp_diag_http_status "http://127.0.0.1:${ui_port}")"
  if [[ "$code" == 200 || "$code" == 301 || "$code" == 302 ]]; then
    hp_ui_status '✓' "$HP_GREEN" 'HomePilot UI' 'Online'
  else
    hp_diag_failure 'HomePilot UI' "Unavailable (HTTP ${code:-000})"
  fi

  if [[ "$profile" == bridge_ha || "$profile" == ha_companion ]]; then
    code="$(hp_diag_ha_status)"
    if [[ "$code" == 200 || "$code" == 301 || "$code" == 302 || "$code" == 401 || "$code" == 403 ]]; then
      hp_ui_status '✓' "$HP_GREEN" 'Home Assistant' 'Online'
    else
      hp_diag_failure 'Home Assistant' "Unavailable (HTTP ${code:-000})"
    fi
  else
    hp_ui_status '—' "$HP_SECONDARY" 'Home Assistant' 'Not installed'
  fi

  if [[ "$android" == true ]]; then
    state="$(hp_diag_container_state homepilot-display-bridge)"
    case "$state" in
      healthy) hp_ui_status '✓' "$HP_GREEN" 'Android Display' 'Healthy' ;;
      running) hp_ui_status '✓' "$HP_GREEN" 'Android Display' 'Running' ;;
      *) hp_diag_failure 'Android Display' 'Unavailable' ;;
    esac
  else
    hp_ui_status '—' "$HP_SECONDARY" 'Android Display' 'Not installed'
  fi

  if [[ "$voice" == true ]]; then
    code="$(hp_diag_http_status "http://127.0.0.1:$(hp_saved_value HOMEPILOT_STT_PORT 8090)/health")"
    [[ "$code" != 200 ]] && hp_diag_failure 'STT' "Unavailable (HTTP ${code:-000})" \
      || hp_ui_status '✓' "$HP_GREEN" 'STT' 'Healthy'
    code="$(hp_diag_http_status "http://127.0.0.1:$(hp_saved_value HOMEPILOT_TTS_PORT 8088)/health")"
    [[ "$code" != 200 ]] && hp_diag_failure 'TTS' "Unavailable (HTTP ${code:-000})" \
      || hp_ui_status '✓' "$HP_GREEN" 'TTS' 'Healthy'
  else
    hp_ui_status '—' "$HP_SECONDARY" 'STT' 'Not installed'
    hp_ui_status '—' "$HP_SECONDARY" 'TTS' 'Not installed'
  fi

  if hp_is_paired; then
    hp_ui_status '✓' "$HP_GREEN" 'Directory Edge' 'Paired'
  else
    hp_ui_status '—' "$HP_SECONDARY" 'Directory Edge' 'Not installed'
  fi
  if hp_tpm_device_available; then
    binding="$(hp_diag_binding_status)"
    if [[ "$binding" == bound ]]; then
      hp_ui_status '✓' "$HP_GREEN" 'TPM 2.0' 'Bound'
    else
      hp_ui_status '!' "$HP_YELLOW" 'TPM 2.0' 'Detected · binding pending'
    fi
  elif [[ "$(hp_saved_value HOMEPILOT_GLOBAL_INSTALLER_VERSION '')" == v1 ]]; then
    hp_diag_failure 'TPM 2.0' 'Unavailable'
  else
    hp_ui_status '—' "$HP_SECONDARY" 'TPM 2.0' 'Not installed'
  fi
  state="$(hp_diag_cloudflared_state)"
  case "$state" in
    active) hp_ui_status '✓' "$HP_GREEN" 'Cloudflare Tunnel' 'Connected' ;;
    inactive) hp_diag_failure 'Cloudflare Tunnel' 'Inactive' ;;
    *) hp_ui_status '—' "$HP_SECONDARY" 'Cloudflare Tunnel' 'Not installed' ;;
  esac
  if [[ "$mqtt" == true ]]; then
    state="$(hp_diag_container_state homepilot-mqtt)"
    case "$state" in
      healthy|running) hp_ui_status '✓' "$HP_GREEN" 'MQTT' 'Running' ;;
      *) hp_diag_failure 'MQTT' 'Unavailable' ;;
    esac
  else
    hp_ui_status '—' "$HP_SECONDARY" 'MQTT' 'Not installed'
  fi

  printf '\n'
  hp_ui_separator
  if (( hp_diagnostic_failures == 0 )); then
    hp_ok 'Sistema operativo correctamente'
  else
    hp_ui_status '!' "$HP_YELLOW" 'Sistema requiere atención' "$hp_diagnostic_failures módulo(s)"
  fi
  printf '\n'
  if hp_yes_no '¿Mostrar detalles técnicos?' false; then
    hp_ui_separator
    HOMEPILOT_INSTALLER_EMBEDDED=1 bash scripts/check-edge-install.sh
  fi
  (( hp_diagnostic_failures == 0 ))
}

hp_existing_menu() {
  hp_banner
  hp_ui_center "$HP_SOFT" 'Existing HomePilot installation detected'
  hp_ui_select 'Selecciona una acción' 'Estado / diagnóstico' \
    'Completar configuración pendiente' 'Reparar componentes seleccionados' 'Cancelar' \
    || hp_fail 'Falta selección.'
  case "$REPLY" in
    1) hp_global_diagnostic ;;
    2)
      [[ "$(hp_saved_value HOMEPILOT_GLOBAL_INSTALLER_VERSION '')" == v1 ]] \
        || hp_fail 'Instalación histórica: usa su procedimiento de pairing; el wizard no cambiará el perfil.'
      hp_remote=true
      hp_complete_pending_runtime
      if ! hp_is_paired; then
        hp_read 'URL pública HomePilot asignada por NEZU (https://...): ' || hp_fail 'Falta URL pública.'
        hp_edge_hostname="$REPLY"
        hp_valid_edge_url "$hp_edge_hostname" || hp_fail 'URL pública inválida.'
        hp_ui_confirm_value "$hp_edge_hostname"
      fi
      hp_verify_tpm
      hp_configure_cloudflared
      hp_pair_directory
      hp_bind_identity
      ;;
    3)
      hp_ui_select 'Selecciona un componente' 'Paquetes base y Docker' \
        'Servicio Cloudflare' 'Diagnóstico API' || hp_fail 'Falta selección.'
      case "$REPLY" in
        1) hp_yes_no '¿Reparar paquetes base y Docker?' false && { hp_install_base; hp_install_docker; } ;;
        2) hp_remote=true; hp_yes_no '¿Reparar servicio Cloudflare?' false && hp_configure_cloudflared ;;
        3) hp_global_diagnostic ;;
        *) hp_fail 'Componente inválido.' ;;
      esac
      ;;
    4) hp_ok 'Sin cambios.' ;;
    *) hp_fail 'Opción inválida.' ;;
  esac
}

hp_main() {
  hp_color_init
  if hp_existing_installation; then hp_existing_menu; return; fi
  hp_banner
  hp_ui_begin
  hp_collect_information
  hp_step 2 'SISTEMA BASE'
  hp_preflight
  hp_step 3 'TPM 2.0'
  hp_ok 'Dispositivo TPM detectado; prueba funcional después de la confirmación.'
  hp_collect_architecture
  hp_summary
  hp_yes_no '¿Aplicar esta configuración?' false || { hp_warn 'Instalación cancelada sin cambios.'; return 1; }
  if [[ "$hp_change_hostname" == true ]]; then hostnamectl set-hostname "$hp_hostname"; fi
  hp_install_base
  hp_install_docker
  hp_verify_tpm
  hp_prepare_mqtt
  hp_deploy
  hp_configure_cloudflared
  hp_pair_directory
  hp_bind_identity
  hp_finish
}
