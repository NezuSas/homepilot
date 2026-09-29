#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/lib/homepilot-global-installer.sh
trap 'hp_ui_shutdown' EXIT
hp_main
