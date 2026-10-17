#!/usr/bin/env bash
# shellcheck source=/dev/null
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/brand.sh"
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

usage() {
  cat <<EOF
Uso: bash scripts/make-install-bundle.sh [--ref REF] [--output DIR]

Genera el paquete de instalación de ${HP_BRAND} para copiarlo a una MiniPC (por ejemplo en un pendrive).
Solo incluye lo que está confirmado en git en REF (por defecto HEAD), sin el historial, con un archivo
REVISION y su suma de verificación. Dejar los cambios sin confirmar fuera es intencional.

  --ref REF      Commit, rama o etiqueta de la que se arma el paquete (HEAD).
  --output DIR   Carpeta de salida (../homepilot-bundles, fuera del repositorio).
EOF
}

fail() { printf 'ERROR %s\n' "$1" >&2; exit 1; }

ref="HEAD"
output="$(cd .. && pwd)/homepilot-bundles"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) [[ $# -ge 2 && -n "$2" ]] || fail 'Falta valor para --ref.'; ref="$2"; shift 2 ;;
    --output) [[ $# -ge 2 && -n "$2" ]] || fail 'Falta valor para --output.'; output="$2"; shift 2 ;;
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
name="homepilot-${version}-${revision}"
timestamp="$(git log -1 --format=%ct "${ref}^{commit}")"

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
git archive --format=tar --prefix=homepilot/ "${ref}^{commit}" | tar -x -C "$stage"
printf '%s\n' "$revision" > "$stage/homepilot/REVISION"

mkdir -p "$output"
tar -C "$stage" --sort=name --mtime="@${timestamp}" --owner=0 --group=0 --numeric-owner -cf - homepilot \
  | gzip -n > "$output/${name}.tar.gz"
(cd "$output" && sha256sum "${name}.tar.gz" > "${name}.tar.gz.sha256")

printf 'Paquete: %s/%s.tar.gz\n' "$output" "$name"
printf 'Revisión: %s\n' "$revision"
printf 'Suma: %s/%s.tar.gz.sha256\n' "$output" "$name"
printf '\nEn la MiniPC (copia los dos archivos):\n'
printf '  sha256sum -c %s.tar.gz.sha256\n' "$name"
printf '  tar xzf %s.tar.gz && cd homepilot\n' "$name"
printf '  sudo bash scripts/homepilot-install.sh\n'
