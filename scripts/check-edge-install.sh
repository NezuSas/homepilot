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
  if curl -fsS --max-time 5 "$url" >/tmp/homepilot-edge-check.out 2>/tmp/homepilot-edge-check.err; then
    echo "OK   ${label}: ${url}"
  else
    echo "FAIL ${label}: ${url}"
    sed 's/^/     /' /tmp/homepilot-edge-check.err || true
  fi
}

probe "HomePilot API" "http://127.0.0.1:3000/health"
probe "HomePilot UI" "http://127.0.0.1:8080"
probe "Home Assistant" "http://127.0.0.1:8123"
probe "STT" "http://127.0.0.1:8090/health"
probe "TTS" "http://127.0.0.1:8088/health"

echo
echo "Recommended SSH tunnels from the client workstation"
echo "HomePilot UI/API:"
echo "ssh -i ~/.ssh/codex_nezu_tmp -o ProxyCommand=\"cloudflared access ssh --hostname %h\" -L 8080:127.0.0.1:8080 nezu@ssh.nezuecuador.com"
echo
echo "Existing Home Assistant:"
echo "ssh -i ~/.ssh/codex_nezu_tmp -o ProxyCommand=\"cloudflared access ssh --hostname %h\" -L 18123:127.0.0.1:8123 nezu@ssh.nezuecuador.com"
echo
echo "Use http://localhost:8080 for HomePilot. UI, API and WebSocket share this origin. Use http://localhost:18123 only for the customer's existing Home Assistant."
