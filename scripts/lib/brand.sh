#!/usr/bin/env bash
# Loads the product and company names from brand.json (repository root) into HP_BRAND and HP_BRAND_COMPANY.
# Every message to a person uses these variables; edit brand.json, never the messages.
# Safe to source more than once.
[[ -n "${HP_BRAND:-}" ]] && return 0

_hp_brand_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
_hp_brand_read() {
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$_hp_brand_root/brand.json" | head -n 1
}

if [[ ! -f "$_hp_brand_root/brand.json" ]]; then
  echo "No se encontró brand.json en $_hp_brand_root; ejecuta el script desde una copia completa del repositorio." >&2
  return 1 2>/dev/null || exit 1
fi

HP_BRAND="$(_hp_brand_read productName)"
HP_BRAND_COMPANY="$(_hp_brand_read companyName)"
if [[ -z "$HP_BRAND" ]]; then
  echo "brand.json no define productName." >&2
  return 1 2>/dev/null || exit 1
fi
export HP_BRAND HP_BRAND_COMPANY
unset -f _hp_brand_read
unset _hp_brand_root
