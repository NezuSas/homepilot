#!/usr/bin/env bash
set -euo pipefail

mode="mini-pc"
failures=0

usage() {
  cat <<'EOF'
Uso: bash scripts/check-pc-integration-readiness.sh [--mode mini-pc|linux-target]

Modos:
  mini-pc       Comprueba requisitos no destructivos de la miniPC HomePilot.
  linux-target  Comprueba si esta PC Linux puede ejecutar HomePilot Linux Agent.

Este comando no instala paquetes, no cambia servicios y no imprime secretos.
EOF
}

ok() { printf 'OK   %s\n' "$1"; }
warn() { printf 'WARN %s\n' "$1"; failures=$((failures + 1)); }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) mode="${2:-}"; shift 2 ;;
    --help) usage; exit 0 ;;
    *) printf 'ERROR opción no reconocida: %s\n' "$1" >&2; exit 2 ;;
  esac
done

case "$mode" in
  mini-pc)
    command -v docker >/dev/null 2>&1 && ok 'Docker está disponible.' || warn 'Docker no está disponible.'
    docker compose version >/dev/null 2>&1 && ok 'Docker Compose v2 está disponible.' || warn 'Docker Compose v2 no está disponible.'
    [[ -f .env ]] && ok 'Existe .env de HomePilot.' || warn 'No existe .env; ejecute primero el instalador de HomePilot.'
    curl --silent --fail --max-time 5 http://127.0.0.1:8123/ >/dev/null && ok 'Home Assistant responde localmente.' || warn 'Home Assistant no responde en 127.0.0.1:8123.'
    if ss -lnt 2>/dev/null | grep -qE '(:1883[[:space:]])'; then
      ok 'Hay un broker MQTT escuchando en el puerto 1883.'
    else
      warn 'No se detectó un broker MQTT en el puerto 1883.'
    fi
    printf '%s\n' 'Nota: para agentes remotos, MQTT debe usar credenciales por instalación y acceso restringido a la LAN; el broker anónimo/local de desarrollo no sirve para clientes.'
    ;;
  linux-target)
    command -v python3 >/dev/null 2>&1 && ok 'Python 3 está disponible.' || warn 'Falta Python 3.'
    command -v playerctl >/dev/null 2>&1 && ok 'playerctl está disponible.' || warn 'Falta playerctl (Debian/Ubuntu: sudo apt install playerctl).'
    command -v pactl >/dev/null 2>&1 && ok 'pactl está disponible.' || warn 'Falta pactl (Debian/Ubuntu: sudo apt install pulseaudio-utils).'
    command -v systemctl >/dev/null 2>&1 && ok 'systemd está disponible.' || warn 'Falta systemd; este agente no es compatible.'
    if systemctl --user is-enabled homepilot-linux-agent.service >/dev/null 2>&1; then
      ok 'El servicio HomePilot Linux Agent está habilitado.'
    else
      warn 'El servicio HomePilot Linux Agent no está habilitado todavía.'
    fi
    ;;
  *) printf 'ERROR modo no válido: %s\n' "$mode" >&2; exit 2 ;;
esac

if (( failures > 0 )); then
  printf 'Resultado: %s requisito(s) pendiente(s).\n' "$failures" >&2
  exit 1
fi

printf 'Resultado: preparación verificada.\n'
