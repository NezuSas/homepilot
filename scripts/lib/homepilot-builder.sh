#!/usr/bin/env bash

# A separate docker-container builder keeps new HomePilot build cache apart from
# the daemon's shared builder. Never select it globally or prune any builder.
readonly HOMEPILOT_BUILDER_NAME='homepilot-builder'
readonly HOMEPILOT_BUILDER_CONTAINER="buildx_buildkit_${HOMEPILOT_BUILDER_NAME}0"
readonly HOMEPILOT_BUILDKIT_CONFIG="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/docker/buildkit/homepilot-buildkitd.toml"
readonly HOMEPILOT_BUILDER_POLICY_CHECK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/homepilot-builder-policy.awk"
readonly HOMEPILOT_GC_RESERVED='8GiB'
readonly HOMEPILOT_GC_MAX_USED='11GiB'
readonly HOMEPILOT_GC_MIN_FREE='25GiB'

homepilot_builder_policy_matches() {
  local details="$1"
  [[ -f "$HOMEPILOT_BUILDKIT_CONFIG" && -f "$HOMEPILOT_BUILDER_POLICY_CHECK" ]] || return 1
  printf '%s\n' "$details" | awk -f "$HOMEPILOT_BUILDER_POLICY_CHECK"
}

homepilot_builder_size_bytes() {
  local size="$1" amount unit multiplier
  [[ "$size" =~ ^([0-9]+([.][0-9]+)?)([A-Za-z]+)$ ]] || return 1
  amount="${BASH_REMATCH[1]}"
  unit="${BASH_REMATCH[3]}"
  case "$unit" in
    B) multiplier=1 ;;
    kB) multiplier=1000 ;;
    KiB) multiplier=1024 ;;
    MB) multiplier=1000000 ;;
    MiB) multiplier=1048576 ;;
    GB) multiplier=1000000000 ;;
    GiB) multiplier=1073741824 ;;
    TB) multiplier=1000000000000 ;;
    TiB) multiplier=1099511627776 ;;
    *) return 1 ;;
  esac
  awk -v amount="$amount" -v multiplier="$multiplier" 'BEGIN { printf "%.0f\n", amount * multiplier }'
}

homepilot_builder_ensure() {
  local details compose_build_help

  [[ -f "$HOMEPILOT_BUILDKIT_CONFIG" ]] || fail "Falta la política GC de HomePilot: ${HOMEPILOT_BUILDKIT_CONFIG}."
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
    docker buildx create --name "$HOMEPILOT_BUILDER_NAME" --driver docker-container --driver-opt default-load=true \
      --buildkitd-config "$HOMEPILOT_BUILDKIT_CONFIG" >/dev/null \
      || fail "No se pudo crear ${HOMEPILOT_BUILDER_NAME}; no se usará el builder compartido."
  fi

  details="$(docker buildx inspect --bootstrap "$HOMEPILOT_BUILDER_NAME")" \
    || fail "No se pudo iniciar ${HOMEPILOT_BUILDER_NAME}; no se usará el builder compartido."
  [[ "$details" =~ (^|$'\n')Driver:[[:space:]]*docker-container($|[[:space:]]) ]] \
    || fail "${HOMEPILOT_BUILDER_NAME} no utiliza el driver aislado docker-container."
  [[ "$details" =~ default-load=\"?true\"? ]] \
    || fail "${HOMEPILOT_BUILDER_NAME} no garantiza la carga local de imágenes."
  homepilot_builder_policy_matches "$details" \
    || fail "${HOMEPILOT_BUILDER_NAME} conserva una política GC anterior o no verificable. No se modifica ni se reconstruye automáticamente; consulta la migración manual en docs/homepilot-technical-guide.md."
  ok "Builder dedicado ${HOMEPILOT_BUILDER_NAME} listo para los builds de HomePilot."
}

homepilot_builder_report() {
  local details usage summary total_size total_bytes max_bytes

  info "Builder de HomePilot: ${HOMEPILOT_BUILDER_NAME}."
  info "GC objetivo: reservado ${HOMEPILOT_GC_RESERVED}; máximo ${HOMEPILOT_GC_MAX_USED}; libre objetivo ${HOMEPILOT_GC_MIN_FREE}; caché local 48h y caché general antigua 30 días primero."
  if ! details="$(docker buildx inspect "$HOMEPILOT_BUILDER_NAME" 2>/dev/null)"; then
    info 'Estado: no creado o no disponible. No hay una cifra de caché atribuible al builder.'
    return 0
  fi
  printf '%s\n' "$details" | awk '/^Driver:|^Status:/ { print }'
  printf '%s\n' "$details" | awk '/^GC Policy rule#/ || /^[[:space:]]+(Reserved Space|Max Used Space|Min Free Space|Keep Duration):/ { print }'
  if ! printf '%s\n' "$details" | grep -Eq '^Status:[[:space:]]+running'; then
    info 'Política activa y caché no verificables porque el builder está detenido; el reporte no lo inicia.'
    return 0
  fi
  if homepilot_builder_policy_matches "$details"; then
    ok 'Política GC de HomePilot verificada en el builder activo.'
  else
    warn 'El builder activo usa una política GC anterior o no verificable. Requiere migración manual; no se modifica automáticamente.'
  fi
  info "La caché BuildKit de este builder vive en el volumen ${HOMEPILOT_BUILDER_CONTAINER}_state; no es un volumen de datos del hogar y tampoco debe usarse volume prune."
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
  info 'Es caché atribuida a este builder, no espacio íntegramente liberable: puede compartir capas con imágenes. No incluye imágenes runtime/rollback ni datos persistentes.'
  total_size="$(printf '%s\n' "$summary" | awk '$1 == "Total:" { print $2 }')"
  if total_bytes="$(homepilot_builder_size_bytes "$total_size")" && max_bytes="$(homepilot_builder_size_bytes "$HOMEPILOT_GC_MAX_USED")"; then
    if (( total_bytes > max_bytes )); then
      warn "La caché del builder (${total_size}) supera ${HOMEPILOT_GC_MAX_USED}. El GC de BuildKit es periódico, no una cuota dura; revisa capacidad y política activa."
    fi
  else
    warn 'No se pudo comparar la caché con el límite GC; el tamaño no se infiere.'
  fi
}
