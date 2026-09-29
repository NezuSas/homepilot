#!/usr/bin/env bash
set -euo pipefail

compose_file="${1:-docker-compose.office.yml}"
read_env() {
  local value=''
  if [[ -f .env ]]; then value="$(sed -n "s/^$1=//p" .env | tail -n 1)"; fi
  printf '%s' "${value%$'\r'}"
}

global_install=false
voice_enabled=true
ha_managed=true
ui_port=8080
compose_args=()
if [[ "$(read_env HOMEPILOT_GLOBAL_INSTALLER_VERSION)" == v1 ]]; then
  global_install=true
  case "$(read_env HOMEPILOT_INSTALLATION_PROFILE)" in
    ha_companion) compose_file=docker-compose.yml ;;
    bridge_ha|native_only) compose_file=docker-compose.office.yml; ha_managed=false ;;
    *) echo 'Invalid saved HomePilot profile' >&2; exit 1 ;;
  esac
  voice_enabled="$(read_env HOMEPILOT_VOICE_ENABLED)"
  [[ "$voice_enabled" == true || "$voice_enabled" == false ]] || { echo 'Invalid voice setting' >&2; exit 1; }
  ui_port="$(read_env HOMEPILOT_UI_PORT)"
  ui_port="${ui_port:-8080}"
  compose_args=(-f "$compose_file" -f docker-compose.tpm.yml)
  if [[ "$(read_env HOMEPILOT_MQTT_ENABLED)" == true ]]; then
    if [[ "$ha_managed" == true ]]; then
      compose_args+=(-f docker-compose.mqtt-secure.yml)
    else
      compose_args+=(-f docker-compose.pc-agents.yml)
    fi
  fi
  if [[ "$(read_env HOMEPILOT_ANDROID_DISPLAY_ENABLED)" == true ]]; then
    compose_args+=(-f docker-compose.android-display.yml)
  fi
else
  compose_args=(-f "$compose_file")
fi

echo "HomePilot Edge install check"
echo

echo "Working directory: $(pwd)"
if [[ -f "$compose_file" ]]; then
  echo "Compose file: $compose_file"
else
  echo "Compose file not found: $compose_file"
fi

echo
echo "Listening ports"
ports=(3000 "$ui_port")
if [[ "$global_install" == false ]]; then ports+=(11434 18123 13000); fi
if [[ "$voice_enabled" == true ]]; then ports+=(8088 8090); fi
if [[ "$ha_managed" == true ]]; then ports+=(8123); fi
for port in "${ports[@]}"; do
  if ss -ltn 2>/dev/null | grep -q ":${port} "; then
    echo "OK   :${port} listening"
  else
    echo "MISS :${port} not listening"
  fi
done

echo
echo "Docker containers"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

if [[ -f "$compose_file" ]]; then
  echo
  echo "HomePilot compose status"
  docker compose "${compose_args[@]}" ps
fi

echo
echo "HTTP probes"
probe() {
  local label="$1"
  local url="$2"
  if curl -fsS --max-time 5 --output /dev/null "$url" 2>/dev/null; then
    echo "OK   ${label}: ${url}"
  else
    echo "FAIL ${label}: ${url}"
  fi
}

probe "HomePilot API" "http://127.0.0.1:3000/health"
probe "HomePilot UI" "http://127.0.0.1:${ui_port}"
if [[ "$ha_managed" == true ]]; then probe "Home Assistant" "http://127.0.0.1:8123"; fi
if [[ "$voice_enabled" == true ]]; then
  probe "STT" "http://127.0.0.1:8090/health"
  probe "TTS" "http://127.0.0.1:8088/health"
fi

echo
echo "Use bash scripts/homepilot-maintenance.sh --status for the profile-aware operational check."
echo "Review docs/client-appliance-delivery.md before exposing ports or handing over an appliance."
