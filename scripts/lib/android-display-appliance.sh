#!/usr/bin/env bash

readonly HOMEPILOT_DISPLAY_OVERLAY='docker-compose.android-display.yml'
readonly HOMEPILOT_DISPLAY_DESKTOP_OVERLAY='docker-compose.android-display.desktop.yml'
readonly HOMEPILOT_DISPLAY_ADB_DIR='data/android-display/adb-home/.android'
android_display_enabled=false

android_display_is_desktop() {
  local system
  system="$(docker info --format '{{.OperatingSystem}}' 2>/dev/null || true)"
  [[ "$system" =~ [Dd]ocker[[:space:]][Dd]esktop ]]
}

android_display_env_value() {
  local value
  value="$(sed -n "s/^$1=//p" .env | tail -n 1)"
  printf '%s' "${value%$'\r'}"
}

android_display_validate_cidrs() {
  command -v python3 >/dev/null 2>&1 || return 1
  python3 - "$1" <<'PY'
import ipaddress
import sys

raw = sys.argv[1]
private = [ipaddress.ip_network(value) for value in
           ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')]
try:
    values = raw.split(',')
    if not values or not all(value and value == value.strip() for value in values):
        raise ValueError('Empty or padded CIDR')
    networks = [ipaddress.ip_network(value, strict=True) for value in values]
    if not all(isinstance(net, ipaddress.IPv4Network) and net.prefixlen >= 16
               and any(net.subnet_of(lan) for lan in private) for net in networks):
        raise ValueError('CIDR must be narrow RFC1918 IPv4')
except ValueError:
    sys.exit(1)
PY
}

android_display_load() {
  local flag token cidrs port adb_home
  flag="$(android_display_env_value HOMEPILOT_ANDROID_DISPLAY_ENABLED)"
  case "$flag" in
    ''|false) android_display_enabled=false; return ;;
    true) android_display_enabled=true ;;
    *) fail 'HOMEPILOT_ANDROID_DISPLAY_ENABLED debe ser true o false.' ;;
  esac

  token="$(android_display_env_value HOMEPILOT_DISPLAY_BRIDGE_TOKEN)"
  cidrs="$(android_display_env_value HOMEPILOT_DISPLAY_ADB_CIDRS)"
  port="$(android_display_env_value HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT)"
  adb_home="$(android_display_env_value HOMEPILOT_DISPLAY_ADB_HOME)"
  [[ "$token" =~ ^[A-Za-z0-9_-]{32,}$ ]] || fail 'Android Display habilitado sin token interno válido; no se desplegará.'
  android_display_validate_cidrs "$cidrs" || fail 'Android Display habilitado con CIDR inválido o sin python3.'
  [[ "$port" =~ ^[0-9]+$ ]] && (( 10#$port >= 1 && 10#$port <= 65535 )) \
    || fail 'Android Display habilitado sin puerto HTTP válido.'
  [[ -z "$adb_home" || "$adb_home" == "./$HOMEPILOT_DISPLAY_ADB_DIR" ]] \
    || fail 'Android Display requiere el directorio ADB administrado por HomePilot.'
  export HOMEPILOT_DISPLAY_BRIDGE_TOKEN="$token"
  export HOMEPILOT_DISPLAY_ADB_CIDRS="$cidrs"
  export HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT="$port"
  export HOMEPILOT_DISPLAY_ADB_HOME="./$HOMEPILOT_DISPLAY_ADB_DIR"
  [[ -f "$HOMEPILOT_DISPLAY_OVERLAY" ]] || fail 'Falta el overlay Android Display.'
}

android_display_generate_token_if_missing() {
  [[ -n "$(android_display_env_value HOMEPILOT_DISPLAY_BRIDGE_TOKEN)" ]] && return
  command -v openssl >/dev/null 2>&1 || fail 'Se requiere openssl para generar el token Android Display.'
  local token
  token="$(openssl rand -hex 32)" || fail 'No se pudo generar el token Android Display.'
  [[ ${#token} -eq 64 ]] || fail 'La generación del token Android Display falló.'
  set_env_value HOMEPILOT_DISPLAY_BRIDGE_TOKEN "$token"
  chmod 600 .env || fail 'No se pudo proteger .env.'
  ok 'Token interno de Android Display generado y protegido; no se mostrará.'
}

android_display_python() {
  printf '%s' /usr/bin/python3
}

android_display_prepare_adb_home() {
  [[ "$(uname -s)" == Linux ]] || return 0 # Desktop uses its named volume.
  local helper="$(dirname "${BASH_SOURCE[0]}")/android-display-adb-home.py" python_bin
  python_bin="$(android_display_python)"
  [[ -f "$helper" && -x "$python_bin" ]] || fail 'Falta el helper ADB o /usr/bin/python3 en Linux.'
  if [[ "$(id -u)" == 0 ]]; then
    "$python_bin" "$helper" "$(pwd -P)" || fail 'No se pudo preparar o validar el ADB home persistente.'
  else
    command -v sudo >/dev/null 2>&1 || fail 'Se requiere sudo para inspeccionar el ADB home protegido.'
    sudo "$python_bin" "$helper" "$(pwd -P)" || fail 'No se pudo preparar o validar el ADB home persistente.'
  fi
}

android_display_add_overlays() {
  [[ "$android_display_enabled" == true ]] || return 0
  compose_files+=("$HOMEPILOT_DISPLAY_OVERLAY")
  if [[ "${android_display_desktop:-false}" == true ]]; then
    compose_files+=("$HOMEPILOT_DISPLAY_DESKTOP_OVERLAY")
  fi
}

android_display_check_network() {
  [[ "$android_display_enabled" == true ]] || return 0
  local ports expected port
  port="$(android_display_env_value HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT)"
  ports="$(docker port homepilot-display-bridge 2>/dev/null)" || { warn 'No se pudieron inspeccionar los puertos del bridge.'; runtime_failures=$((runtime_failures + 1)); return; }
  if [[ "${android_display_desktop:-false}" == true ]]; then
    [[ -z "$ports" ]] || { warn 'El bridge Desktop no debe publicar HTTP ni ADB.'; runtime_failures=$((runtime_failures + 1)); }
    return
  fi
  expected="5002/tcp -> 127.0.0.1:${port}"
  if [[ "$ports" == "$expected" ]]; then
    ok 'Bridge publicado únicamente en loopback; TCP 5037 no publicado.'
  else
    warn 'Publicación del bridge inesperada; se requiere loopback HTTP y ningún TCP 5037.'
    runtime_failures=$((runtime_failures + 1))
  fi
}

android_display_check_api_config() {
  [[ "$android_display_enabled" == true ]] || return 0
  local expected_url actual_url actual_token expected_token
  expected_url="http://127.0.0.1:$(android_display_env_value HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT)"
  [[ "${android_display_desktop:-false}" == true ]] && expected_url='http://homepilot-display-bridge:5002'
  expected_token="$(android_display_env_value HOMEPILOT_DISPLAY_BRIDGE_TOKEN)"
  actual_url="$(docker exec homepilot-api printenv HOMEPILOT_DISPLAY_BRIDGE_URL 2>/dev/null || true)"
  actual_token="$(docker exec homepilot-api printenv HOMEPILOT_DISPLAY_BRIDGE_TOKEN 2>/dev/null || true)"
  if [[ "$actual_url" == "$expected_url" && "$actual_token" == "$expected_token" ]]; then
    ok 'API recibe la URL y autenticación interna del bridge.'
  else
    warn 'API no recibió la configuración esperada del bridge.'
    runtime_failures=$((runtime_failures + 1))
  fi
}
