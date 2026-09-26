#!/usr/bin/env bash
set -euo pipefail

compose_file="${1:-docker-compose.office.yml}"

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
for port in 3000 8080 8088 8090 8123 11434 18123 13000; do
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
  docker compose -f "$compose_file" ps
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
probe "HomePilot UI" "http://127.0.0.1:8080"
probe "Home Assistant" "http://127.0.0.1:8123"
probe "STT" "http://127.0.0.1:8090/health"
probe "TTS" "http://127.0.0.1:8088/health"

echo
echo "Use bash scripts/homepilot-maintenance.sh --status for the profile-aware operational check."
echo "Review docs/client-appliance-delivery.md before exposing ports or handing over an appliance."
