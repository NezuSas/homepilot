#!/usr/bin/env bash
# shellcheck source=/dev/null
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/brand.sh"
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

usage() {
  cat <<EOF
Uso: sudo HOMEPILOT_MATRIX_CONFIRM=wipe-this-machine bash scripts/test-installer-matrix.sh [matrix|extras|all] [escenario...]

Instala ${HP_BRAND} con el asistente (respuestas por la entrada estándar) en cada combinación de opciones y comprueba que se
levanta exactamente lo elegido. Es una herramienta de verificación para una MiniPC Ubuntu de PRUEBAS:
BORRA todos los contenedores, imágenes y volúmenes de Docker, y en "extras" desinstala Docker.

  matrix   9 escenarios de opciones (por defecto). Con nombres, solo esos.
  extras   Docker ausente con fuente apt vieja, Docker ausente limpio, segunda ejecución y puerto ocupado.
  all      extras y matriz.

El acceso remoto siempre se contesta que no. Resultados en \${HOMEPILOT_MATRIX_RESULTS:-/var/tmp/homepilot-installer-matrix.txt}.
EOF
}

fail() { printf 'ERROR %s\n' "$1" >&2; exit 2; }

mode="${1:-matrix}"
[[ $# -eq 0 ]] || shift
case "$mode" in
  -h|--help|help) usage; exit 0 ;;
  matrix|extras|all) ;;
  *) usage; exit 2 ;;
esac
[[ "${HOMEPILOT_MATRIX_CONFIRM:-}" == wipe-this-machine ]] \
  || fail 'Esta herramienta borra Docker por completo. Confirma con HOMEPILOT_MATRIX_CONFIRM=wipe-this-machine en una MiniPC de pruebas.'
[[ "$(id -u)" == 0 ]] || fail 'Ejecuta con sudo.'

repo="$(pwd)"
results="${HOMEPILOT_MATRIX_RESULTS:-/var/tmp/homepilot-installer-matrix.txt}"
logs="$(dirname "$results")/homepilot-installer-matrix"
mkdir -p "$logs"
: > "$results"

say() { printf '%s\n' "$*" | tee -a "$results"; }
strip() { sed 's/\x1b\[[0-9;?]*[A-Za-z]//g'; }

lan_ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") {print $(i+1); exit}}')"
[[ -n "$lan_ip" ]] || fail 'No se pudo determinar la IP de la LAN.'
lan_cidr="${lan_ip%.*}.0/24"
mqtt_password='MqttMatrix-2026x'

# Wizard answers after client, installation and hostname (native_only unless the first one says otherwise).
declare -A ANSWERS EXPECT
ANSWERS[S1_minimo]="3 n n n n n s"
EXPECT[S1_minimo]="homepilot-api homepilot-ui"
ANSWERS[S2_solo_chat]="3 n n n s n n s"
EXPECT[S2_solo_chat]="homepilot-api homepilot-ui"
ANSWERS[S3_chat_voz]="3 n n n s s n s"
EXPECT[S3_chat_voz]="homepilot-api homepilot-stt homepilot-tts homepilot-ui"
ANSWERS[S4_camaras]="3 s n n n n s"
EXPECT[S4_camaras]="homepilot-api homepilot-ui"
ANSWERS[S5_android]="3 n s ${lan_cidr} n n n s"
EXPECT[S5_android]="homepilot-api homepilot-display-bridge homepilot-ui"
ANSWERS[S6_mqtt]="3 n n s ${lan_ip} homeassistant n n s ${mqtt_password} ${mqtt_password}"
EXPECT[S6_mqtt]="homepilot-api homepilot-mqtt homepilot-ui"
ANSWERS[S7_bridge_ha]="1 n n n n n n s"
EXPECT[S7_bridge_ha]="homeassistant homepilot-api homepilot-ui"
ANSWERS[S8_ha_companion]="2 n n n n n s"
EXPECT[S8_ha_companion]="homeassistant homepilot-api homepilot-ui"
ANSWERS[S9_todo]="3 s s ${lan_cidr} s ${lan_ip} homeassistant s s n s ${mqtt_password} ${mqtt_password}"
EXPECT[S9_todo]="homepilot-api homepilot-display-bridge homepilot-mqtt homepilot-stt homepilot-tts homepilot-ui"
ALL_SCENARIOS=(S1_minimo S2_solo_chat S3_chat_voz S4_camaras S5_android S6_mqtt S7_bridge_ha S8_ha_companion S9_todo)

reset_homepilot() {
  docker ps -aq 2>/dev/null | xargs -r docker rm -f >/dev/null 2>&1
  docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -E '^homepilot-rollback' | xargs -r docker rmi -f >/dev/null 2>&1
  docker volume prune -af >/dev/null 2>&1
  docker network prune -f >/dev/null 2>&1
  rm -rf "${repo:?}/.env" "${repo:?}/data" "${repo:?}/backups" "${repo:?}/ha-config"
}

purge_docker() {
  systemctl stop docker docker.socket containerd 2>/dev/null
  DEBIAN_FRONTEND=noninteractive apt-get purge -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras >/dev/null 2>&1
  DEBIAN_FRONTEND=noninteractive apt-get autoremove -y -qq >/dev/null 2>&1
  rm -rf /var/lib/docker /var/lib/containerd /etc/docker /etc/apt/sources.list.d/docker.sources /etc/apt/sources.list.d/docker.list /etc/apt/keyrings/docker.asc /usr/share/keyrings/docker-archive-keyring.gpg
  hash -r
}

# Runs the wizard feeding its answers through standard input, as a person would type them; sets $installer_exit.
# The file holds a throwaway MQTT test password, so it is private and removed right after.
run_installer() {
  local name="$1" file="$logs/answers-$1.txt"
  { printf 'Cliente Prueba\nOficina Pruebas\n%s\n' "$(hostname)"; for a in ${2}; do printf '%s\n' "$a"; done; } > "$file"
  chmod 600 "$file"
  timeout 3000 bash scripts/homepilot-install.sh < "$file" > "$logs/install-$name.log" 2>&1
  installer_exit=$?
  rm -f "$file"
}

running_containers() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -v '^buildx_buildkit' | sort | tr '\n' ' ' | sed 's/ $//'
}

run_scenario() {
  local name="$1" expected actual unhealthy ui health verdict=FAIL
  say "=== ${name} $(date +%H:%M:%S)"
  reset_homepilot
  [[ "$name" != S7_bridge_ha ]] || docker run -d --name homeassistant -p 8123:8123 homeassistant/home-assistant:stable >/dev/null 2>&1
  run_installer "$name" "${ANSWERS[$name]}"
  sleep 45
  actual="$(running_containers)"
  expected="$(printf '%s\n' ${EXPECT[$name]} | sort | tr '\n' ' ' | sed 's/ $//')"
  unhealthy="$(docker ps --format '{{.Names}} {{.Status}}' | grep -i -E 'unhealthy|restarting' | tr '\n' ';')"
  ui="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:8080/ 2>/dev/null)"
  health="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:8080/health 2>/dev/null)"
  [[ "$installer_exit" == 0 && "$actual" == "$expected" && -z "$unhealthy" && "$health" == 200 ]] && verdict=PASS
  say "installer_exit=${installer_exit} ui=${ui} health=${health}"
  say "expected: ${expected}"
  say "actual:   ${actual}"
  say "unhealthy: ${unhealthy:-none}"
  say "VERDICT ${name}: ${verdict}"
}

run_extras() {
  local stale docker_present env_created mentions containers saw health before after env_before env_after menu asked busy listener named
  reset_homepilot

  say "=== X1 sin Docker y con una fuente apt vieja $(date +%H:%M:%S)"
  purge_docker
  printf 'deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu noble stable\n' > /etc/apt/sources.list.d/docker.list
  run_installer X1 "${ANSWERS[S1_minimo]}"
  stale=$([ -f /etc/apt/sources.list.d/docker.list ] && echo yes || echo no)
  docker_present=$(command -v docker >/dev/null && echo yes || echo no)
  env_created=$([ -e "$repo/.env" ] && echo yes || echo no)
  mentions=$(strip < "$logs/install-X1.log" | grep -c "docker.list")
  say "exit=${installer_exit} stale_source_untouched=${stale} docker_installed=${docker_present} env_created=${env_created} log_mentions_docker.list=${mentions}"
  [[ "$installer_exit" != 0 && "$stale" == yes && "$docker_present" == no && "$env_created" == no && "$mentions" -ge 1 ]] \
    && say "VERDICT X1: PASS" || say "VERDICT X1: FAIL"

  say "=== X2 sin Docker, limpio $(date +%H:%M:%S)"
  rm -f /etc/apt/sources.list.d/docker.list /usr/share/keyrings/docker-archive-keyring.gpg
  run_installer X2 "${ANSWERS[S1_minimo]}"
  sleep 30
  containers="$(running_containers)"
  saw=$(strip < "$logs/install-X2.log" | grep -c "Docker no está instalado; se instalará")
  health=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:8080/health 2>/dev/null)
  say "exit=${installer_exit} containers=[${containers}] health=${health} log_says_will_install_docker=${saw}"
  [[ "$installer_exit" == 0 && "$containers" == "homepilot-api homepilot-ui" && "$health" == 200 && "$saw" -ge 1 ]] \
    && say "VERDICT X2: PASS" || say "VERDICT X2: FAIL"

  say "=== X3 segunda ejecución sobre una instalación existente $(date +%H:%M:%S)"
  before="$(docker ps --format '{{.Names}} {{.ID}}' | grep -v buildx | sort | tr '\n' ';')"
  env_before=$(sha256sum "$repo/.env" | cut -d' ' -f1)
  printf '0\n' | timeout 120 bash scripts/homepilot-install.sh > "$logs/install-X3.log" 2>&1
  installer_exit=$?
  after="$(docker ps --format '{{.Names}} {{.ID}}' | grep -v buildx | sort | tr '\n' ';')"
  env_after=$(sha256sum "$repo/.env" | cut -d' ' -f1)
  menu=$(strip < "$logs/install-X3.log" | grep -c -i -E "diagn|Completar configuración|Reparar")
  asked=$(strip < "$logs/install-X3.log" | grep -c "Nombre del cliente")
  say "exit=${installer_exit} containers_unchanged=$([ "$before" == "$after" ] && echo yes || echo no) env_unchanged=$([ "$env_before" == "$env_after" ] && echo yes || echo no) shows_admin_menu=${menu} asks_for_client=${asked}"
  [[ "$installer_exit" == 0 && "$before" == "$after" && "$env_before" == "$env_after" && "$menu" -ge 1 && "$asked" == 0 ]] \
    && say "VERDICT X3: PASS" || say "VERDICT X3: FAIL"

  say "=== X4 puerto 8080 ocupado durante el instalador $(date +%H:%M:%S)"
  reset_homepilot
  python3 -m http.server 8080 --bind 0.0.0.0 >/dev/null 2>&1 &
  listener=$!
  sleep 2
  run_installer X4 "${ANSWERS[S1_minimo]}"
  kill "$listener" 2>/dev/null; wait "$listener" 2>/dev/null
  busy="$(docker ps -a --format '{{.Names}}' 2>/dev/null | grep -v '^buildx_buildkit' | wc -l)"
  env_created=$([ -e "$repo/.env" ] && echo yes || echo no)
  named=$(strip < "$logs/install-X4.log" | grep -c "puerto 8080 está ocupado por python3")
  say "exit=${installer_exit} containers=${busy} env_created=${env_created} log_names_port_and_process=${named}"
  [[ "$installer_exit" != 0 && "$busy" == 0 && "$env_created" == no && "$named" -ge 1 ]] \
    && say "VERDICT X4: PASS" || say "VERDICT X4: FAIL"

  say "=== X5 solo túnel, sin emparejar con el Directory $(date +%H:%M:%S)"
  if systemctl is-active --quiet cloudflared; then
    reset_homepilot
    run_installer X5 "3 n n n n s n s"
    sleep 30
    containers="$(running_containers)"
    asked=$(strip < "$logs/install-X5.log" | grep -c -E "URL pública|código temporal de pairing")
    named=$(strip < "$logs/install-X5.log" | grep -c "Cloudflare Tunnel activo y configurado\|Cloudflare Tunnel existente reutilizado")
    say "exit=${installer_exit} containers=[${containers}] asked_url_or_pairing=${asked} tunnel_reported=${named}"
    [[ "$installer_exit" == 0 && "$containers" == "homepilot-api homepilot-ui" && "$asked" == 0 && "$named" -ge 1 ]] \
      && say "VERDICT X5: PASS" || say "VERDICT X5: FAIL"
  else
    say "VERDICT X5: SKIP (cloudflared no está activo; el túnel pediría su token)"
  fi
}

if [[ "$mode" == extras || "$mode" == all ]]; then run_extras; fi
if [[ "$mode" == matrix || "$mode" == all ]]; then
  scenarios=("$@")
  (( ${#scenarios[@]} > 0 )) || scenarios=("${ALL_SCENARIOS[@]}")
  # Starting from a completely empty Docker keeps the first scenario honest about image builds.
  if [[ ${#scenarios[@]} -eq ${#ALL_SCENARIOS[@]} ]]; then
    docker system prune -af --volumes >/dev/null 2>&1
    docker builder prune -af >/dev/null 2>&1
  fi
  for scenario in "${scenarios[@]}"; do
    [[ -n "${ANSWERS[$scenario]:-}" ]] || fail "Escenario desconocido: ${scenario}"
    run_scenario "$scenario"
  done
fi
reset_homepilot
failures="$(grep -c '^VERDICT .*: FAIL' "$results" || true)"
say "MATRIX_DONE $(date +%H:%M:%S) fallos=${failures}"
(( failures == 0 ))
