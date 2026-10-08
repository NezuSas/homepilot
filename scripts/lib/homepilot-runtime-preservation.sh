#!/usr/bin/env bash

# Read-only preflight. Never enroll, migrate SQLite or replace TPM keys here.
homepilot_tpm_available() { [[ -c /dev/tpmrm0 ]]; }

# Diagnostics must not invoke bootstrap or enrollment, even for --status.
homepilot_runtime_identity_status() {
  docker exec -i -w /app homepilot-api node <<'NODE'
const Database = require('better-sqlite3');
let db;
try {
  db = new Database(process.env.HOMEPILOT_DB_PATH || '/app/data/homepilot.db',
    { readonly: true, fileMustExist: true, timeout: 3000 });
  db.pragma('query_only = ON');
  const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='edge_device_identity_binding'").get();
  const bound = table && db.prepare("SELECT 1 FROM edge_device_identity_binding WHERE id=1 AND binding_state='bound'").get();
  console.log(bound ? 'bound' : 'unbound');
} catch {
  console.error('No se pudo verificar la identidad existente en modo lectura.');
  process.exitCode = 1;
} finally { if (db) db.close(); }
NODE
}

# Docker Desktop and Git Bash/WSL may spell the same host path differently.
homepilot_runtime_normalize_path() {
  local value="${1//\\//}"
  value="${value#/run/desktop/mnt/host}"
  if [[ "$value" =~ ^/mnt/([a-zA-Z])/(.*)$ ]]; then
    value="${BASH_REMATCH[1]}:/${BASH_REMATCH[2]}"
  elif [[ "$value" =~ ^/([a-zA-Z])/(.*)$ ]]; then
    value="${BASH_REMATCH[1]}:/${BASH_REMATCH[2]}"
  fi
  [[ ! "$value" =~ ^[a-zA-Z]:/ ]] || value="${value,,}"
  printf '%s' "${value%/}"
}

homepilot_runtime_preflight() {
  local existing project mounted_tpm mount_source destination binding running expected_source
  existing="$(docker ps --all --filter 'name=^/homepilot-api$' --format '{{.Names}}')" \
    || fail 'No se pudo comprobar la instalación existente; no se recreará la API.'
  if [[ -n "$existing" ]]; then
    [[ "$existing" == homepilot-api ]] || fail 'Identificación de API ambigua; no se modificará.'
    project="$(docker inspect homepilot-api --format '{{index .Config.Labels "com.docker.compose.project"}}')" \
      || fail 'No se pudo identificar el proyecto Compose existente.'
    [[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail 'Proyecto Compose existente no verificable.'
    [[ -z "${COMPOSE_PROJECT_NAME:-}" || "$COMPOSE_PROJECT_NAME" == "$project" ]] \
      || fail 'COMPOSE_PROJECT_NAME difiere de la instalación existente; no se creará otra.'
    export COMPOSE_PROJECT_NAME="$project"
    for destination in data backups; do
      mount_source="$(docker inspect homepilot-api --format "{{range .Mounts}}{{if eq .Destination \"/app/${destination}\"}}{{.Source}}{{end}}{{end}}")" \
        || fail 'No se pudieron comprobar los montajes persistentes.'
      expected_source="$(cd "$destination" && pwd -P)" \
        || fail "Falta el directorio persistente ${destination}; no se creará otra base."
      [[ "$(homepilot_runtime_normalize_path "$mount_source")" == "$(homepilot_runtime_normalize_path "$expected_source")" ]] \
        || fail "El montaje de ${destination} no corresponde a este checkout; no se sustituirá."
    done
    mounted_tpm="$(docker inspect homepilot-api --format '{{range .HostConfig.Devices}}{{if eq .PathInContainer "/dev/tpmrm0"}}true{{end}}{{end}}')" \
      || fail 'No se pudo comprobar el montaje TPM existente.'
    if [[ "$mounted_tpm" == true ]]; then
      tpm_enabled=true
    else
      running="$(docker inspect homepilot-api --format '{{.State.Running}}')" \
        || fail 'No se pudo comprobar el estado de la API.'
      [[ "$running" == true ]] || fail 'API existente detenida sin montaje TPM: verificar identidad antes de recrearla.'
      # Enrollment --status initializes persistence. Query the existing DB
      # explicitly read-only instead, without exposing public binding metadata.
      binding="$(homepilot_runtime_identity_status)" || fail 'Identidad existente no verificable; no se recreará la API.'
      case "$binding" in
        bound) tpm_enabled=true ;;
        unbound) ;;
        *) fail 'Estado de identidad desconocido; no se recreará la API.' ;;
      esac
    fi
    info 'Proyecto y montajes persistentes existentes verificados y conservados.'
  fi
  if [[ "$tpm_enabled" == true ]]; then
    homepilot_tpm_available || fail 'Esta instalación requiere /dev/tpmrm0; no se construirá ni recreará sin TPM.'
    [[ -f docker-compose.tpm.yml ]] || fail 'Falta el overlay TPM requerido por la instalación.'
    info 'TPM requerido: se conservará su montaje, sin repetir enrollment.'
  fi
}
