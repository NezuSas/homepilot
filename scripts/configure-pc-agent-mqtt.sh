#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

readonly credentials_dir="data/mqtt"
readonly password_file="${credentials_dir}/passwordfile"
readonly acl_file="${credentials_dir}/aclfile"
readonly compose_base="docker-compose.office.yml"
readonly compose_agents="docker-compose.pc-agents.yml"

usage() {
  cat <<'EOF'
Uso:
  bash scripts/configure-pc-agent-mqtt.sh init --ha-username USUARIO [--prepare-only]
  bash scripts/configure-pc-agent-mqtt.sh add-device --device-name NOMBRE
  bash scripts/configure-pc-agent-mqtt.sh status

Configura el broker MQTT seguro para computadoras remotas.
Los secretos se solicitan de forma oculta y se guardan solo en data/mqtt/ (modo 0600).
EOF
}

fail() { printf 'ERROR %s\n' "$1" >&2; exit 1; }
ok() { printf 'OK %s\n' "$1"; }
is_name() { [[ "$1" =~ ^[A-Za-z0-9_-]+$ ]]; }
compose() { docker compose -f "$compose_base" -f "$compose_agents" "$@"; }

readonly mosquitto_image="eclipse-mosquitto:2.0.22"
readonly broker_uid="1883"

# Mosquitto 2.1 reads its credentials as the unprivileged broker user, so the directory and both files
# must belong to it. Mode 0600 keeps everyone else out.
protect_credentials() {
  chmod 600 "$password_file" "$acl_file"
  chown "${broker_uid}:${broker_uid}" "$credentials_dir" "$password_file" "$acl_file" 2>/dev/null \
    || fail 'Ejecuta con sudo: el broker necesita ser propietario de las credenciales MQTT.'
}

command_name="${1:-}"
[[ -n "$command_name" ]] || { usage; exit 2; }
shift || true

case "$command_name" in
  init)
    ha_username=""
    prepare_only=false
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --ha-username) [[ $# -ge 2 && -n "$2" ]] || fail 'Falta valor para --ha-username.'; ha_username="$2"; shift 2 ;;
        --prepare-only) prepare_only=true; shift ;;
        --help) usage; exit 0 ;;
        *) fail "Opción no reconocida: $1" ;;
      esac
    done
    is_name "$ha_username" || fail 'ha-username solo admite letras, números, _ y -.'
    [[ ! -e "$password_file" ]] || fail 'MQTT ya está inicializado. No se sobrescriben credenciales existentes.'
    command -v docker >/dev/null || fail 'Docker no está disponible.'
    docker compose version >/dev/null || fail 'Docker Compose v2 no está disponible.'
    [[ -f "$compose_base" && -f "$compose_agents" ]] || fail 'Faltan archivos Compose de MQTT.'
    umask 077
    mkdir -p "$credentials_dir"
    docker_tty=()
    [[ ! -t 0 || ! -t 1 ]] || docker_tty=(-t)
    docker run --rm -i "${docker_tty[@]}" -v "$(pwd)/${credentials_dir}:/mqtt" "$mosquitto_image" \
      mosquitto_passwd -c /mqtt/passwordfile "$ha_username"
    cat > "$acl_file" <<EOF
user ${ha_username}
topic readwrite hass.agent/#
EOF
    protect_credentials
    if [[ "$prepare_only" == true ]]; then
      ok 'Credenciales MQTT seguras preparadas; el instalador iniciará el broker.'
    else
      compose up -d homepilot-mqtt
      ok 'Broker MQTT seguro iniciado.'
    fi
    printf 'Configura MQTT en Home Assistant con host IP_DE_LA_MINIPC, puerto 1883 y usuario %s.\n' "$ha_username"
    ;;
  add-device)
    device_name=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --device-name) [[ $# -ge 2 && -n "$2" ]] || fail 'Falta valor para --device-name.'; device_name="$2"; shift 2 ;;
        --help) usage; exit 0 ;;
        *) fail "Opción no reconocida: $1" ;;
      esac
    done
    is_name "$device_name" || fail 'device-name solo admite letras, números, _ y -.'
    [[ -f "$password_file" && -f "$acl_file" ]] || fail 'Inicializa primero MQTT con el comando init.'
    if grep -q "^user ${device_name}$" "$acl_file"; then
      fail "Ya existe una ACL para ${device_name}."
    fi
    docker_tty=()
    [[ ! -t 0 || ! -t 1 ]] || docker_tty=(-t)
    docker run --rm -i "${docker_tty[@]}" -v "$(pwd)/${credentials_dir}:/mqtt" "$mosquitto_image" \
      mosquitto_passwd /mqtt/passwordfile "$device_name"
    cat >> "$acl_file" <<EOF

user ${device_name}
topic write hass.agent/devices/${device_name}
topic write hass.agent/media_player/${device_name}/state
topic read hass.agent/media_player/${device_name}/cmd
EOF
    protect_credentials
    compose restart homepilot-mqtt
    ok "Credencial creada para ${device_name}."
    printf 'Usa usuario %s y la contraseña indicada solo en el agente de esa computadora.\n' "$device_name"
    ;;
  status)
    [[ -f "$password_file" && -f "$acl_file" ]] || fail 'MQTT seguro no está inicializado.'
    compose ps homepilot-mqtt
    ok 'Credenciales y ACL locales presentes.'
    ;;
  --help|help)
    usage
    ;;
  *)
    usage
    exit 2
    ;;
esac
