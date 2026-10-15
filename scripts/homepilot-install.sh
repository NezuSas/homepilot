#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/lib/homepilot-global-installer.sh
export HOMEPILOT_INSTALLER_EMBEDDED=1
trap 'hp_on_exit' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
hp_main "$@"
