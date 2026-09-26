#!/usr/bin/env bash

# A separate docker-container builder keeps new HomePilot build cache apart from
# the daemon's shared builder. Never select it globally or prune any builder.
readonly HOMEPILOT_BUILDER_NAME='homepilot-builder'

homepilot_builder_ensure() {
  local details compose_build_help

  docker buildx version >/dev/null 2>&1 || fail 'Docker Buildx no está disponible; no se puede aislar la construcción.'
  compose_build_help="$(docker compose build --help 2>/dev/null)" \
    || fail 'No se pudo comprobar la capacidad de build de Docker Compose.'
  [[ "$compose_build_help" == *--builder* ]] \
    || fail 'Docker Compose no admite build --builder; actualiza Compose antes de construir HomePilot.'

  if details="$(docker buildx inspect "$HOMEPILOT_BUILDER_NAME" 2>/dev/null)"; then
    [[ "$details" =~ (^|$'\n')Driver:[[:space:]]*docker-container($|[[:space:]]) ]] \
      || fail "El nombre ${HOMEPILOT_BUILDER_NAME} ya existe con otro driver; no se modificará."
    [[ "$details" =~ default-load=\"?true\"? ]] \
      || fail "El builder ${HOMEPILOT_BUILDER_NAME} no carga imágenes al Docker local; no se modificará."
    info "Se reutiliza el builder dedicado ${HOMEPILOT_BUILDER_NAME}."
  else
    info "Se crea el builder dedicado ${HOMEPILOT_BUILDER_NAME} (docker-container, default-load=true)."
    docker buildx create --name "$HOMEPILOT_BUILDER_NAME" --driver docker-container --driver-opt default-load=true >/dev/null \
      || fail "No se pudo crear ${HOMEPILOT_BUILDER_NAME}; no se usará el builder compartido."
  fi

  details="$(docker buildx inspect --bootstrap "$HOMEPILOT_BUILDER_NAME")" \
    || fail "No se pudo iniciar ${HOMEPILOT_BUILDER_NAME}; no se usará el builder compartido."
  [[ "$details" =~ (^|$'\n')Driver:[[:space:]]*docker-container($|[[:space:]]) ]] \
    || fail "${HOMEPILOT_BUILDER_NAME} no utiliza el driver aislado docker-container."
  [[ "$details" =~ default-load=\"?true\"? ]] \
    || fail "${HOMEPILOT_BUILDER_NAME} no garantiza la carga local de imágenes."
  ok "Builder dedicado ${HOMEPILOT_BUILDER_NAME} listo para los builds de HomePilot."
}

homepilot_builder_report() {
  local details usage summary

  info "Builder de HomePilot: ${HOMEPILOT_BUILDER_NAME}."
  if ! details="$(docker buildx inspect "$HOMEPILOT_BUILDER_NAME" 2>/dev/null)"; then
    info 'Estado: no creado o no disponible. No hay una cifra de caché atribuible al builder.'
    return 0
  fi
  printf '%s\n' "$details" | awk '/^Driver:|^Status:/ { print }'
  if ! printf '%s\n' "$details" | grep -Eq '^Status:[[:space:]]+running'; then
    info 'Caché: no consultada porque el builder no está activo; el reporte no lo inicia.'
    return 0
  fi
  if ! usage="$(docker buildx du --builder "$HOMEPILOT_BUILDER_NAME" 2>/dev/null)"; then
    warn 'No se pudo medir la caché del builder dedicado; no se infiere desde docker system df.'
    return 0
  fi
  summary="$(printf '%s\n' "$usage" | awk '/^(Shared|Private|Reclaimable|Total):/ { print }')"
  if [[ -z "$summary" ]]; then
    warn 'Buildx no devolvió un resumen fiable de caché para este builder.'
    return 0
  fi
  printf '%s\n' "$summary"
  info 'Es caché atribuida a este builder, no espacio íntegramente liberable: puede compartir capas con imágenes.'
}
