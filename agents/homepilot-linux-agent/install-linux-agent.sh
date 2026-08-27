#!/usr/bin/env bash
set -euo pipefail

source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/homepilot-linux-agent"
config_file="$config_dir/config.json"
service_dir="$HOME/.config/systemd/user"
service_file="$service_dir/homepilot-linux-agent.service"
venv_dir="$config_dir/venv"

usage() {
  cat <<'EOF'
Uso: bash install-linux-agent.sh --mqtt-host IP --mqtt-username USUARIO --device-name NOMBRE [opciones]

Opciones:
  --mqtt-port PUERTO       Puerto MQTT (defecto: 1883)
  --mqtt-ca ARCHIVO        CA PEM para MQTT TLS
  --poll-seconds SEGUNDOS  Intervalo de estado (defecto: 2)
  --help                   Muestra esta ayuda

La contraseña MQTT se solicita de forma oculta y nunca se acepta como argumento.
EOF
}

fail() { printf 'ERROR %s\n' "$1" >&2; exit 1; }

mqtt_host=''
mqtt_username=''
device_name=''
mqtt_port='1883'
mqtt_ca=''
poll_seconds='2'

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mqtt-host) mqtt_host="${2:-}"; shift 2 ;;
    --mqtt-username) mqtt_username="${2:-}"; shift 2 ;;
    --device-name) device_name="${2:-}"; shift 2 ;;
    --mqtt-port) mqtt_port="${2:-}"; shift 2 ;;
    --mqtt-ca) mqtt_ca="${2:-}"; shift 2 ;;
    --poll-seconds) poll_seconds="${2:-}"; shift 2 ;;
    --help) usage; exit 0 ;;
    *) fail "Opción no reconocida: $1" ;;
  esac
done

[[ -n "$mqtt_host" && -n "$mqtt_username" && -n "$device_name" ]] || fail 'mqtt-host, mqtt-username y device-name son obligatorios.'
[[ "$device_name" =~ ^[A-Za-z0-9_-]+$ ]] || fail 'device-name solo admite letras, números, _ y -.'
[[ "$mqtt_port" =~ ^[0-9]{1,5}$ ]] && (( mqtt_port >= 1 && mqtt_port <= 65535 )) || fail 'mqtt-port inválido.'
[[ "$poll_seconds" =~ ^[0-9]+([.][0-9]+)?$ ]] || fail 'poll-seconds inválido.'
[[ -z "$mqtt_ca" || -f "$mqtt_ca" ]] || fail 'No existe el archivo indicado en --mqtt-ca.'
command -v python3 >/dev/null || fail 'Python 3 no está instalado.'
command -v playerctl >/dev/null || fail 'Instale playerctl antes de continuar (Debian/Ubuntu: sudo apt install playerctl).'
command -v pactl >/dev/null || fail 'Instale pactl/PipeWire-Pulse antes de continuar (Debian/Ubuntu: sudo apt install pulseaudio-utils).'
command -v systemctl >/dev/null || fail 'systemd es obligatorio para este instalador.'

read -r -s -p 'Contraseña MQTT: ' mqtt_password
printf '\n'
[[ -n "$mqtt_password" ]] || fail 'La contraseña MQTT no puede estar vacía.'

umask 077
mkdir -p "$config_dir" "$service_dir"
python3 -m venv "$venv_dir"
"$venv_dir/bin/pip" install --disable-pip-version-check --no-input -r "$source_dir/requirements.txt"

python3 - "$config_file" "$device_name" "$mqtt_host" "$mqtt_port" "$mqtt_username" "$mqtt_password" "$mqtt_ca" "$poll_seconds" <<'PY'
import json
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
payload = {
    "device_name": sys.argv[2], "mqtt_host": sys.argv[3], "mqtt_port": int(sys.argv[4]),
    "mqtt_username": sys.argv[5], "mqtt_password": sys.argv[6],
    "mqtt_ca": sys.argv[7] or None, "poll_interval_seconds": float(sys.argv[8]),
}
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
path.chmod(0o600)
PY

cat > "$service_file" <<EOF
[Unit]
Description=HomePilot Linux Media Agent
After=graphical-session.target

[Service]
Type=simple
ExecStart=$venv_dir/bin/python $source_dir/homepilot_linux_agent.py --config $config_file
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now homepilot-linux-agent.service
printf 'OK HomePilot Linux Agent instalado para %s.\n' "$device_name"
printf 'Ver estado: systemctl --user status homepilot-linux-agent.service\n'
printf 'Ver registros: journalctl --user -u homepilot-linux-agent.service -f\n'
printf 'Para que permanezca activo tras cerrar sesión: sudo loginctl enable-linger %s\n' "$USER"