#!/usr/bin/env bash
# shellcheck source=/dev/null
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/brand.sh"

# Prebuilt-image mode. A release bundle (scripts/make-release-bundle.sh) carries the runtime images in
# images/homepilot-images.tar.gz plus images/manifest, and no source code. When the manifest exists the installer
# loads those images instead of building them, so a MiniPC needs neither the Dockerfiles nor a builder.
# Everything is relative to the repository root, where the installer already runs.

readonly HOMEPILOT_PREBUILT_MANIFEST='images/manifest'
readonly HOMEPILOT_PREBUILT_ARCHIVE='images/homepilot-images.tar.gz'

homepilot_prebuilt_available() { [[ -s "$HOMEPILOT_PREBUILT_MANIFEST" ]]; }

homepilot_prebuilt_field() {
  sed -n "s/^$1=//p" "$HOMEPILOT_PREBUILT_MANIFEST" | head -n 1 | tr -d '\r'
}

homepilot_prebuilt_revision() { homepilot_prebuilt_field revision; }

homepilot_prebuilt_has_service() { tr -d '\r' < "$HOMEPILOT_PREBUILT_MANIFEST" | grep -qx "service=$1"; }

# The release tag a loaded image carries; it never touches the project's :latest name until it is activated.
homepilot_prebuilt_image() { printf 'homepilot-release-%s:%s\n' "$1" "$(homepilot_prebuilt_revision)"; }

homepilot_prebuilt_api_image() { homepilot_prebuilt_image api; }

homepilot_prebuilt_verify() {
  local expected actual
  [[ -f "$HOMEPILOT_PREBUILT_ARCHIVE" ]] || return 1
  expected="$(homepilot_prebuilt_field sha256)"
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || return 1
  actual="$(sha256sum "$HOMEPILOT_PREBUILT_ARCHIVE" | cut -d' ' -f1)"
  [[ "$expected" == "$actual" ]]
}

# Prints, one per line, the services of the arguments that the bundle does not carry.
homepilot_prebuilt_missing() {
  local service
  for service in "$@"; do
    homepilot_prebuilt_has_service "$service" || printf '%s\n' "$service"
  done
}

homepilot_prebuilt_load() { docker load -i "$HOMEPILOT_PREBUILT_ARCHIVE"; }

# Verifies the bundle against what the chosen options need and loads its images. Callers provide ok, info, fail and
# section; nothing is loaded unless every check passes, and nothing has changed on the system before this runs.
homepilot_prebuilt_prepare() {
  local missing
  section 'Imágenes precompiladas'
  homepilot_prebuilt_verify \
    || fail 'La suma de verificación de las imágenes del paquete no coincide: el paquete está incompleto o dañado. Cópialo de nuevo.'
  missing="$(homepilot_prebuilt_missing "$@" | tr '\n' ' ')"
  [[ -z "${missing// /}" ]] \
    || fail "Este paquete no incluye las imágenes de: ${missing% }. Genera el paquete con esas opciones o elige otras."
  hp_ui_run "Cargando las imágenes de ${HP_BRAND}" homepilot_prebuilt_load \
    || fail 'Docker no pudo cargar las imágenes del paquete; no se cambió nada más.'
  HOMEPILOT_PREBUILT_API_IMAGE="$(homepilot_prebuilt_api_image)"
  export HOMEPILOT_PREBUILT_API_IMAGE
  ok "Imágenes precompiladas listas (revisión $(homepilot_prebuilt_revision)); no se compila nada en esta máquina."
}

# Stands in for "docker compose build": in prebuilt mode it points each service's project image name at the loaded
# release image, so rollback, diagnostics and cleanup see exactly what a build would have produced.
#   homepilot_build_images <compose args...> -- <services...>
homepilot_build_images() {
  local -a compose_args=() services=()
  local service revision
  while (( $# > 0 )) && [[ "$1" != -- ]]; do compose_args+=("$1"); shift; done
  [[ "${1:-}" != -- ]] || shift
  services=("$@")
  if homepilot_prebuilt_available; then
    revision="$(homepilot_prebuilt_revision)"
    (( ${#services[@]} > 0 )) || services=("${HOMEPILOT_IMAGE_SERVICES[@]}")
    for service in "${services[@]}"; do
      service="${service#homepilot-}"
      docker image inspect "homepilot-release-${service}:${revision}" >/dev/null 2>&1 || return 1
      docker tag "homepilot-release-${service}:${revision}" "homepilot-homepilot-${service}:latest" || return 1
    done
    return 0
  fi
  COMPOSE_BAKE=false docker compose "${compose_args[@]}" build --builder "$HOMEPILOT_BUILDER_NAME" "${services[@]}"
}
