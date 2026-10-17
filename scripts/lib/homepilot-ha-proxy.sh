#!/usr/bin/env bash
# shellcheck source=/dev/null
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/brand.sh"
# Makes the Home Assistant that the installer manages accept requests that arrive through the Cloudflare Tunnel.
# Without trusted proxies Home Assistant answers "400: Bad Request" to everything forwarded by a proxy.
#
# Home Assistant 2026.10 reads the http: section of configuration.yaml once, on its first start, keeps it in
# .storage/http and ignores the YAML afterwards. The settings therefore have to be in place before the
# container starts for the first time; appending them to a configuration that already ran has no effect.

readonly HOMEPILOT_HA_TRUSTED_PROXIES=('127.0.0.1' '::1' '172.16.0.0/12')

homepilot_ha_proxy_block() {
  printf 'http:\n  use_x_forwarded_for: true\n  trusted_proxies:\n'
  printf '    - %s\n' "${HOMEPILOT_HA_TRUSTED_PROXIES[@]}"
}

# Creates the configuration directory of a Home Assistant that has never started: the default configuration it
# would have generated, plus the proxy settings. Returns 0 when seeded, 10 when the configuration already
# declares the proxy settings, 11 when a configuration exists without them (nothing is changed),
# 12 when the directory cannot be written.
homepilot_ha_proxy_seed() {
  local dir="$1" config="$1/configuration.yaml"
  if [[ -f "$config" ]]; then
    grep -q 'use_x_forwarded_for' "$config" && return 10
    return 11
  fi
  mkdir -p "$dir" 2>/dev/null || return 12
  {
    printf '# Loads default set of integrations. Do not remove.\ndefault_config:\n\n'
    printf '# Load frontend themes from the themes folder\nfrontend:\n  themes: !include_dir_merge_named themes\n\n'
    printf 'automation: !include automations.yaml\nscript: !include scripts.yaml\nscene: !include scenes.yaml\n\n'
    printf '# Added by %s so Home Assistant can sit behind the Cloudflare Tunnel.\n' "$HP_BRAND"
    homepilot_ha_proxy_block
  } > "$config" 2>/dev/null || return 12
  [[ -e "$dir/automations.yaml" ]] || printf '[]' > "$dir/automations.yaml"
  [[ -e "$dir/scripts.yaml" ]] || : > "$dir/scripts.yaml"
  [[ -e "$dir/scenes.yaml" ]] || : > "$dir/scenes.yaml"
}
