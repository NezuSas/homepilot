#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ha_config_dir="$repo_root/ha-config"
registry_file="$ha_config_dir/wake-on-lan-devices.tsv"
generated_file="$ha_config_dir/wake-on-lan-switches.yaml"
configuration_file="$ha_config_dir/configuration.yaml"

if [[ -t 1 ]]; then
  ORANGE='\033[38;5;208m'
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  BOLD='\033[1m'
  DIM='\033[2m'
  RESET='\033[0m'
else
  ORANGE='' GREEN='' RED='' BOLD='' DIM='' RESET=''
fi

info() { printf '%b\n' "${ORANGE}INFO${RESET} $1"; }
ok() { printf '%b\n' "${GREEN}OK${RESET}  $1"; }
fail() { printf '%b\n' "${RED}ERROR${RESET} $1" >&2; exit 1; }
divider() { printf '%b\n' "${DIM}----------------------------------------------------------------${RESET}"; }

usage() {
  cat <<'EOF'
Uso: bash scripts/configure-wol-devices.sh [opcion]

Configura computadoras objetivo para encendido remoto Wake-on-LAN desde
la mini-PC HomePilot. Wake-on-LAN no utiliza MQTT ni HASS.Agent.

Opciones:
  --list          Muestra las computadoras registradas.
  --regenerate    Regenera el YAML de Home Assistant desde el registro.
  --help          Muestra esta ayuda.

Sin opciones abre el menú interactivo.
EOF
}

ensure_configuration_binding() {
  [[ -f "$configuration_file" ]] || fail "No existe $configuration_file."
  if grep -Fq 'switch: !include wake-on-lan-switches.yaml' "$configuration_file"; then
    return
  fi

  if grep -Eq '^switch:' "$configuration_file"; then
    fail "configuration.yaml ya declara switch:. Para no sobrescribir interruptores existentes, integra manualmente !include wake-on-lan-switches.yaml antes de ejecutar este asistente."
  fi

  {
    printf '\n%s\n' '# Wake-on-LAN computer switches are managed by scripts/configure-wol-devices.sh.'
    printf '%s\n\n' 'wake_on_lan:'
    printf '%s\n' 'switch: !include wake-on-lan-switches.yaml'
  } >> "$configuration_file"
  ok 'Home Assistant quedó enlazado al archivo Wake-on-LAN administrado.'
}

ensure_registry() {
  if [[ ! -f "$registry_file" ]]; then
    printf '%s\n' '# nombre|sistema|mac|ip|broadcast|puerto' > "$registry_file"
  fi
}

is_ipv4() {
  local value="$1" part
  local -a parts
  IFS='.' read -r -a parts <<< "$value"
  [[ ${#parts[@]} -eq 4 ]] || return 1
  for part in "${parts[@]}"; do
    [[ "$part" =~ ^[0-9]{1,3}$ ]] || return 1
    (( 10#$part <= 255 )) || return 1
  done
}

normalize_mac() {
  local value="${1^^}"
  value="${value//-/:}"
  [[ "$value" =~ ^([0-9A-F]{2}:){5}[0-9A-F]{2}$ ]] || return 1
  printf '%s' "$value"
}

is_safe_name() {
  local value="$1"
  [[ -n "$value" && "$value" != *'|'* && "$value" != *"'"* && "$value" != *$'\n'* ]]
}

show_platform_guide() {
  local os="$1"
  divider
  if [[ "$os" == "windows" ]]; then
    printf '%b\n' "${BOLD}Windows — localizar y preparar MAC Ethernet${RESET}"
    printf '%s\n' '1. Abra PowerShell como usuario normal y ejecute:'
    printf '%s\n' '   Get-NetAdapter -Physical | Format-Table Name, Status, MacAddress, LinkSpeed'
    printf '%s\n' '2. Copie la MAC del adaptador Ethernet conectado, no la de Wi-Fi ni Bluetooth.'
    printf '%s\n' '3. En Administrador de dispositivos > adaptador Ethernet, active Wake on Magic Packet y Wake on LAN desde apagado.'
  else
    printf '%b\n' "${BOLD}Linux — localizar y preparar MAC Ethernet${RESET}"
    printf '%s\n' '1. Ejecute: ip link'
    printf '%s\n' '2. Copie la dirección link/ether de la interfaz Ethernet conectada.'
    printf '%s\n' '3. Verifique soporte: sudo ethtool <interfaz>'
    printf '%s\n' '4. Active Wake-on-LAN: sudo ethtool -s <interfaz> wol g'
    printf '%s\n' '5. Habilite Wake-on-LAN/Wake from S5 también en BIOS/UEFI.'
  fi
  divider
}

regenerate_yaml() {
  local name os mac host broadcast port
  ensure_registry
  local temp_file
  temp_file="${generated_file}.tmp"
  {
    printf '%s\n' '# Generado por scripts/configure-wol-devices.sh. No editar manualmente.'
    printf '%s\n' '# Para modificar equipos: bash scripts/configure-wol-devices.sh'

    while IFS='|' read -r name os mac host broadcast port || [[ -n "${name:-}" ]]; do
      [[ -z "$name" || "$name" == \#* ]] && continue
      printf '%s\n' '- platform: wake_on_lan'
      printf "  name: 'Encender %s'\n" "$name"
      printf "  mac: '%s'\n" "$mac"
      printf "  host: '%s'\n" "$host"
      printf "  broadcast_address: '%s'\n" "$broadcast"
      printf '  broadcast_port: %s\n' "$port"
    done < "$registry_file"
  } > "$temp_file"
  mv "$temp_file" "$generated_file"
  ok "Configuración Home Assistant generada: ${generated_file#$repo_root/}"
}

list_devices() {
  local name os mac host broadcast port
  ensure_registry
  local count=0
  divider
  printf '%b\n' "${BOLD}Computadoras Wake-on-LAN registradas${RESET}"
  printf '%-3s %-24s %-9s %-18s %-15s\n' '#' 'NOMBRE' 'SISTEMA' 'MAC' 'IP'
  divider
  while IFS='|' read -r name os mac host broadcast port || [[ -n "${name:-}" ]]; do
    [[ -z "$name" || "$name" == \#* ]] && continue
    count=$((count + 1))
    printf '%-3s %-24s %-9s %-18s %-15s\n' "$count" "$name" "$os" "$mac" "$host"
  done < "$registry_file"
  if (( count == 0 )); then
    printf '%s\n' 'No hay computadoras registradas.'
  fi
  divider
}

selected_platform=''

read_platform() {
  local selected
  while true; do
    printf '%s\n' 'Sistema operativo: 1) Windows  2) Linux'
    read -r -p 'Seleccione una opción: ' selected
    case "$selected" in
      1) selected_platform='windows'; return ;;
      2) selected_platform='linux'; return ;;
      *) printf '%s\n' 'Seleccione 1 o 2.' ;;
    esac
  done
}

add_device() {
  local name os mac_input mac host broadcast port
  read -r -p 'Nombre visible de la computadora: ' name
  is_safe_name "$name" || { printf '%s\n' 'El nombre no puede estar vacío ni contener comillas simples o |.'; return; }
  if awk -F'|' -v candidate="$name" '$1 == candidate { found=1 } END { exit !found }' "$registry_file"; then
    printf '%s\n' 'Ya existe una computadora con ese nombre.'
    return
  fi

  read_platform
  os="$selected_platform"
  show_platform_guide "$os"

  read -r -p 'MAC Ethernet (ejemplo 18:C0:4D:DA:41:C2): ' mac_input
  mac="$(normalize_mac "$mac_input")" || { printf '%s\n' 'La MAC no tiene un formato válido.'; return; }

  read -r -p 'IP local reservada o estable (ejemplo 192.168.1.36): ' host
  is_ipv4 "$host" || { printf '%s\n' 'La IP no tiene un formato IPv4 válido.'; return; }

  local default_broadcast="${host%.*}.255"
  read -r -p "Broadcast de la red [${default_broadcast}]: " broadcast
  broadcast="${broadcast:-$default_broadcast}"
  is_ipv4 "$broadcast" || { printf '%s\n' 'La dirección broadcast no es IPv4 válida.'; return; }

  read -r -p 'Puerto Wake-on-LAN [9]: ' port
  port="${port:-9}"
  [[ "$port" =~ ^[0-9]{1,5}$ ]] && (( port >= 1 && port <= 65535 )) || { printf '%s\n' 'El puerto debe estar entre 1 y 65535.'; return; }

  printf '%s|%s|%s|%s|%s|%s\n' "$name" "$os" "$mac" "$host" "$broadcast" "$port" >> "$registry_file"
  regenerate_yaml
  ok "${name} se registró. Asigne una reserva DHCP para ${host} en el router antes de desplegar."
}

configure_devices() {
  local quantity index
  read -r -p '¿Cuántas computadoras desea registrar ahora? ' quantity
  [[ "$quantity" =~ ^[0-9]+$ ]] && (( quantity >= 1 && quantity <= 32 )) || { printf '%s\n' 'Ingrese un número entre 1 y 32.'; return; }
  for ((index = 1; index <= quantity; index++)); do
    printf '\n%b\n' "${BOLD}Computadora ${index} de ${quantity}${RESET}"
    add_device
  done
}

remove_device() {
  ensure_registry
  local -a names=()
  local name selected temp_file
  while IFS='|' read -r name _ || [[ -n "${name:-}" ]]; do
    [[ -z "$name" || "$name" == \#* ]] && continue
    names+=("$name")
  done < "$registry_file"

  (( ${#names[@]} > 0 )) || { printf '%s\n' 'No hay computadoras para eliminar.'; return; }
  list_devices
  read -r -p 'Número de la computadora que desea eliminar (0 para cancelar): ' selected
  [[ "$selected" =~ ^[0-9]+$ ]] || { printf '%s\n' 'Selección inválida.'; return; }
  (( selected == 0 )) && return
  (( selected >= 1 && selected <= ${#names[@]} )) || { printf '%s\n' 'Selección fuera de rango.'; return; }
  name="${names[$((selected - 1))]}"
  read -r -p "¿Eliminar ${name}? [y/N]: " selected
  [[ "$selected" == 'y' || "$selected" == 'Y' ]] || { printf '%s\n' 'Eliminación cancelada.'; return; }

  temp_file="${registry_file}.tmp"
  awk -F'|' -v target="$name" '$1 ~ /^#/ || $1 != target' "$registry_file" > "$temp_file"
  mv "$temp_file" "$registry_file"
  regenerate_yaml
  ok "${name} se eliminó."
}

apply_home_assistant_configuration() {
  command -v docker >/dev/null 2>&1 || fail 'Docker no está disponible en PATH.'
  (
    cd "$repo_root"
    docker compose ps --services | grep -Fxq 'homeassistant'
  ) || fail 'Esta instalación no declara el servicio homeassistant.'

  info 'Validando la configuración de Home Assistant.'
  (
    cd "$repo_root"
    docker compose exec -T homeassistant hass --script check_config -c /config
  ) || fail 'Home Assistant rechazó la configuración. No se reinició el servicio.'

  info 'Reiniciando únicamente Home Assistant para cargar los equipos Wake-on-LAN.'
  (
    cd "$repo_root"
    docker compose restart homeassistant
  )
  ok 'Home Assistant reinició. Espere a que su estado cambie a healthy antes de probar un interruptor.'
}
menu() {
  while true; do
    printf '\n%b\n' "${ORANGE}${BOLD}HomePilot · Computadoras Wake-on-LAN${RESET}"
    printf '%s\n' '1) Registrar computadoras'
    printf '%s\n' '2) Ver computadoras registradas'
    printf '%s\n' '3) Eliminar una computadora'
    printf '%s\n' '4) Regenerar configuración de Home Assistant'
    printf '%s\n' '5) Validar y reiniciar Home Assistant'
    printf '%s\n' '6) Salir'
    read -r -p 'Seleccione una opción: ' choice
    case "$choice" in
      1) configure_devices ;;
      2) list_devices ;;
      3) remove_device ;;
      4) regenerate_yaml ;;
      5) apply_home_assistant_configuration ;;
      6) return ;;
      *) printf '%s\n' 'Seleccione una opción entre 1 y 6.' ;;
    esac
  done
}

ensure_configuration_binding
ensure_registry

case "${1:-}" in
  '') menu ;;
  --list) list_devices ;;
  --regenerate) regenerate_yaml ;;
  --help) usage ;;
  *) fail "Opción no reconocida: $1. Use --help." ;;
esac