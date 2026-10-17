#!/usr/bin/env bash
# shellcheck source=/dev/null
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/brand.sh"
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

usage() {
  cat <<EOF
Uso: bash scripts/make-release-bundle.sh [--ref REF] [--output DIR] [--without-voice] [--dry-run]

Genera el paquete de entrega de ${HP_BRAND} con las imágenes ya construidas, para instalar en una MiniPC sin
compilar y sin dejar allí el código fuente. Se ejecuta en un equipo con Docker (Linux, o Windows con Docker
Desktop y Git Bash). Construye desde lo confirmado en git en REF (por defecto HEAD).

  --ref REF        Commit, rama o etiqueta de la que se construye (HEAD).
  --output DIR     Carpeta de salida (../homepilot-bundles, fuera del repositorio).
  --without-voice  No incluye las imágenes de voz (mucho más pequeño); el cliente no podrá usar voz.
  --dry-run        Muestra qué incluiría el paquete sin construir nada ni necesitar Docker.

El paquete lleva scripts, archivos de Compose, plantillas, la marca y las imágenes. No lleva el código de la
aplicación. Las imágenes contienen la aplicación compilada: no es una protección del código.
EOF
}

fail() { printf 'ERROR %s\n' "$1" >&2; exit 1; }

ref="HEAD"
output="$(cd .. && pwd)/homepilot-bundles"
voice=true
dry_run=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) [[ $# -ge 2 && -n "$2" ]] || fail 'Falta valor para --ref.'; ref="$2"; shift 2 ;;
    --output) [[ $# -ge 2 && -n "$2" ]] || fail 'Falta valor para --output.'; output="$2"; shift 2 ;;
    --without-voice) voice=false; shift ;;
    --dry-run) dry_run=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Opción no reconocida: $1" ;;
  esac
done

for tool in git tar gzip sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || fail "Falta la herramienta requerida: ${tool}."
done
git rev-parse --verify --quiet "${ref}^{commit}" >/dev/null || fail "La referencia ${ref} no existe; no se escribió nada."

revision="$(git rev-parse --short=12 "${ref}^{commit}")"
version="$(git show "${ref}:package.json" | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
[[ -n "$version" ]] || fail 'No se pudo leer la versión de package.json.'
name="homepilot-release-${version}-${revision}"

services=(api ui display-bridge)
[[ "$voice" != true ]] || services=(api ui stt tts display-bridge)

# Only what is needed to run: no application source, tests, specs or documentation.
runtime_paths=()
while IFS= read -r entry; do
  case "$entry" in
    scripts|mosquitto|brand.json) runtime_paths+=("$entry") ;;
    docker-compose*.yml|.env*.example) runtime_paths+=("$entry") ;;
  esac
done < <(git ls-tree --name-only "${ref}^{commit}")
(( ${#runtime_paths[@]} > 0 )) || fail 'No se encontraron los archivos de ejecución en la referencia.'

if [[ "$dry_run" == true ]]; then
  printf 'Paquete: %s\nRevisión: %s\nServicios con imagen: %s\n\nArchivos incluidos:\n' "$name" "$revision" "${services[*]}"
  git ls-tree -r --name-only "${ref}^{commit}" -- "${runtime_paths[@]}"
  printf 'REVISION\nimages/manifest\nimages/homepilot-images.tar.gz\n'
  exit 0
fi

command -v docker >/dev/null 2>&1 || fail 'Se necesita Docker para construir las imágenes.'
docker info >/dev/null 2>&1 || fail 'Docker no responde; inícialo y vuelve a intentar.'

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/build" "$stage/package/homepilot/images"

# The images are built from a clean export of the reference, never from the working tree.
git archive --format=tar --prefix=homepilot/ "${ref}^{commit}" | tar -x -C "$stage/build"
export HOMEPILOT_BUILD_REVISION="$revision"
export DOCKER_DEFAULT_PLATFORM=linux/amd64
# Only needed so Compose can resolve the display overlay while building; it is not stored anywhere.
export HOMEPILOT_DISPLAY_ADB_CIDRS="${HOMEPILOT_DISPLAY_ADB_CIDRS:-192.168.0.0/16}"

compose_services=()
for service in "${services[@]}"; do compose_services+=("homepilot-${service}"); done
printf 'Construyendo %s para linux/amd64 (puede tardar)...\n' "${services[*]}"
(cd "$stage/build/homepilot" && COMPOSE_BAKE=false docker compose -p homepilot \
  -f docker-compose.office.yml -f docker-compose.android-display.yml build "${compose_services[@]}")

release_images=()
for service in "${services[@]}"; do
  docker image inspect "homepilot-homepilot-${service}:latest" >/dev/null 2>&1 \
    || fail "La construcción no produjo la imagen de ${service}."
  docker tag "homepilot-homepilot-${service}:latest" "homepilot-release-${service}:${revision}"
  release_images+=("homepilot-release-${service}:${revision}")
done

printf 'Guardando las imágenes...\n'
docker save "${release_images[@]}" | gzip -n > "$stage/package/homepilot/images/homepilot-images.tar.gz"
archive_sum="$(sha256sum "$stage/package/homepilot/images/homepilot-images.tar.gz" | cut -d' ' -f1)"
{
  printf 'format=1\nrevision=%s\nplatform=linux/amd64\nsha256=%s\n' "$revision" "$archive_sum"
  for service in "${services[@]}"; do printf 'service=%s\n' "$service"; done
} > "$stage/package/homepilot/images/manifest"

git archive --format=tar --prefix=homepilot/ "${ref}^{commit}" -- "${runtime_paths[@]}" | tar -x -C "$stage/package"
printf '%s\n' "$revision" > "$stage/package/homepilot/REVISION"

mkdir -p "$output"
tar -C "$stage/package" --owner=0 --group=0 --numeric-owner -cf - homepilot | gzip -n > "$output/${name}.tar.gz"
(cd "$output" && sha256sum "${name}.tar.gz" > "${name}.tar.gz.sha256")

printf '\nPaquete: %s/%s.tar.gz\n' "$output" "$name"
printf 'Tamaño: %s\n' "$(du -h "$output/${name}.tar.gz" | cut -f1)"
printf 'Revisión: %s · Servicios: %s\n' "$revision" "${services[*]}"
printf '\nEn la MiniPC (copia los dos archivos):\n'
printf '  sha256sum -c %s.tar.gz.sha256\n' "$name"
printf '  tar xzf %s.tar.gz && cd homepilot\n' "$name"
printf '  sudo bash scripts/homepilot-install.sh\n'
