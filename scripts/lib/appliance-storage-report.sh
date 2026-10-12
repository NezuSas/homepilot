#!/usr/bin/env bash

# Read-only appliance capacity report. Never treat daemon-wide reclaimable space
# as HomePilot-owned storage or as authorization to delete anything.
# shellcheck source=/dev/null
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/brand.sh"
storage_capacity_notice() {
  local used_percent="$1"

  if [[ ! "$used_percent" =~ ^[0-9]+$ ]]; then
    warn 'No se pudo determinar el porcentaje de uso del filesystem de '"$HP_BRAND"'.'
  elif (( used_percent >= 85 )); then
    warn "CRÍTICO: filesystem de ${HP_BRAND} al ${used_percent}% (umbral 85%). Revisa el almacenamiento antes de continuar con mantenimiento prolongado; este aviso no bloquea el despliegue."
  elif (( used_percent >= 75 )); then
    warn "Almacenamiento: filesystem de ${HP_BRAND} al ${used_percent}% (umbral 75%). Revisa la tendencia y el espacio disponible."
  else
    ok "Almacenamiento normal: filesystem de ${HP_BRAND} al ${used_percent}% (menos de 75%)."
  fi
}

storage_report() {
  local used_percent

  section 'Uso del filesystem de '"$HP_BRAND"''
  if ! df -h .; then
    warn 'No se pudo consultar el espacio del filesystem de '"$HP_BRAND"'.'
  fi
  if used_percent="$(df -P . 2>/dev/null | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"; then
    storage_capacity_notice "$used_percent"
  else
    storage_capacity_notice ''
  fi

  section 'Uso de Docker en todo el servidor'
  if command -v docker >/dev/null 2>&1 && docker system df; then
    info 'La columna RECLAIMABLE corresponde al daemon Docker completo: puede incluir otros proyectos y no equivale a espacio exclusivamente liberable de '"$HP_BRAND"'.'
  else
    warn 'No se pudo consultar el uso y el espacio RECLAIMABLE de Docker.'
  fi
  section 'Datos persistentes de '"$HP_BRAND"' (no se eliminan)'
  local directory
  for directory in data backups; do
    if [[ -d "$directory" ]]; then
      du -sh -- "$directory" || warn "No se pudo medir ${directory}."
    fi
  done
  info 'Datos, backups y auditoría pueden crecer por uso; no son imágenes duplicadas. Las cifras Docker comparten capas y no deben sumarse como disco físico.'
}
