#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$root/scripts/lib/android-display-appliance.sh"
temporary="$(mktemp -d)"
trap 'rm -r -- "$temporary"' EXIT
cd "$temporary"

fail() { printf 'Rejected invalid fixture\n' >&2; exit 1; }
ok() { :; }
warn() { :; }
set_env_value() {
  local key="$1" value="$2" next="$temporary/env.next"
  if [[ -f .env ]]; then
    awk -v key="$key" '$0 !~ "^" key "="' .env > "$next"
  else
    : > "$next"
  fi
  printf '%s=%s\n' "$key" "$value" >> "$next"
  mv "$next" .env
}

# Git Bash on Windows has the Python launcher instead of a python3 executable.
if ! command -v python3 >/dev/null 2>&1 && [[ -n "${HOMEPILOT_TEST_PYTHON:-}" ]]; then
  python3() { "$HOMEPILOT_TEST_PYTHON" "$@"; }
elif ! command -v python3 >/dev/null 2>&1 && command -v py >/dev/null 2>&1; then
  python3() { py -3 "$@"; }
fi

: > .env
printf 'Testing disabled default and token persistence...\n'
android_display_load
[[ "$android_display_enabled" == false ]]
output="$(android_display_generate_token_if_missing)"
first="$(android_display_env_value HOMEPILOT_DISPLAY_BRIDGE_TOKEN)"
[[ ${#first} -eq 64 ]]
[[ "$output" != *"$first"* ]]
android_display_generate_token_if_missing
[[ "$(android_display_env_value HOMEPILOT_DISPLAY_BRIDGE_TOKEN)" == "$first" ]]
set_env_value HOMEPILOT_DISPLAY_ADB_CIDRS '192.168.1.0/24,10.42.0.0/16'
set_env_value HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT 5002
set_env_value HOMEPILOT_ANDROID_DISPLAY_ENABLED true
printf 'Testing enabled configuration and overlay selection...\n'
touch docker-compose.android-display.yml
export HOMEPILOT_DISPLAY_BRIDGE_TOKEN='external-value-must-not-override-persistent-token'
android_display_load
[[ "$android_display_enabled" == true ]]
[[ "$HOMEPILOT_DISPLAY_BRIDGE_TOKEN" == "$first" ]]
[[ "$HOMEPILOT_DISPLAY_ADB_HOME" == './data/android-display/adb-home/.android' ]]
compose_files=()
android_display_desktop=false
android_display_add_overlays
[[ ${#compose_files[@]} -eq 1 && "${compose_files[0]}" == docker-compose.android-display.yml ]]
compose_files=()
android_display_desktop=true
android_display_add_overlays
[[ ${#compose_files[@]} -eq 2 && "${compose_files[1]}" == docker-compose.android-display.desktop.yml ]]

printf 'Testing runtime isolation and API configuration...\n'
docker() {
  if [[ "$1" == port && "$2" == homepilot-display-bridge ]]; then
    printf '%s\n' "$mock_ports"
  elif [[ "$1" == exec && "$2" == homepilot-api && "$3" == printenv ]]; then
    case "$4" in
      HOMEPILOT_DISPLAY_BRIDGE_URL) printf '%s\n' "$mock_api_url" ;;
      HOMEPILOT_DISPLAY_BRIDGE_TOKEN) printf '%s\n' "$mock_api_token" ;;
    esac
  else
    return 1
  fi
}
runtime_failures=0
android_display_desktop=false
mock_ports='5002/tcp -> 127.0.0.1:5002'
mock_api_url='http://127.0.0.1:5002'
mock_api_token="$first"
android_display_check_network
android_display_check_api_config
[[ "$runtime_failures" -eq 0 ]]
mock_ports=$'5002/tcp -> 0.0.0.0:5002\n5037/tcp -> 0.0.0.0:5037'
android_display_check_network
[[ "$runtime_failures" -eq 1 ]]
mock_ports='5002/tcp -> 127.0.0.1:5002'
mock_api_token=wrong
android_display_check_api_config
[[ "$runtime_failures" -eq 2 ]]

android_display_validate_cidrs '192.168.1.0/24'
printf 'Testing invalid settings...\n'
for invalid in '0.0.0.0/0' '169.254.0.0/16' '192.168.0.0/15' '192.168.1.1/24' ''; do
  if android_display_validate_cidrs "$invalid"; then
    printf 'Invalid CIDR accepted: %s\n' "$invalid" >&2
    exit 1
  fi
done
set_env_value HOMEPILOT_DISPLAY_ADB_CIDRS '0.0.0.0/0'
if (android_display_load >/dev/null 2>&1); then
  printf 'Enabled with invalid CIDR\n' >&2
  exit 1
fi
set_env_value HOMEPILOT_DISPLAY_ADB_CIDRS '192.168.1.0/24'
set_env_value HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT 70000
if (android_display_load >/dev/null 2>&1); then
  printf 'Enabled with invalid bridge port\n' >&2
  exit 1
fi
set_env_value HOMEPILOT_DISPLAY_BRIDGE_HTTP_PORT 5002
set_env_value HOMEPILOT_DISPLAY_ADB_HOME '/root/.android'
if (android_display_load >/dev/null 2>&1); then
  printf 'Enabled with unmanaged ADB home\n' >&2
  exit 1
fi
set_env_value HOMEPILOT_DISPLAY_ADB_HOME './data/android-display/adb-home/.android'
set_env_value HOMEPILOT_DISPLAY_BRIDGE_TOKEN short
if (android_display_load >/dev/null 2>&1); then
  printf 'Enabled with invalid token\n' >&2
  exit 1
fi
set_env_value HOMEPILOT_ANDROID_DISPLAY_ENABLED false
printf 'Testing disabled lifecycle...\n'
android_display_load
[[ "$android_display_enabled" == false ]]
compose_files=()
android_display_add_overlays
printf 'Disabled overlays: %s\n' "${#compose_files[@]}"
[[ ${#compose_files[@]} -eq 0 ]]
source "$root/scripts/lib/homepilot-images.sh"
printf 'Base images: %s\n' "${#HOMEPILOT_IMAGE_SERVICES[@]}"
[[ ${#HOMEPILOT_IMAGE_SERVICES[@]} -eq 4 ]]
homepilot_image_enable_display
printf 'Enabled images: %s\n' "${#HOMEPILOT_IMAGE_SERVICES[@]}"
[[ ${#HOMEPILOT_IMAGE_SERVICES[@]} -eq 5 && "${HOMEPILOT_IMAGE_SERVICES[4]}" == display-bridge ]]
printf 'Android Display appliance helper tests passed.\n'
