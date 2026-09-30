#!/usr/bin/env bash

# Presentation shared by the global installation wizard. Never changes the terminal in logs.
hp_color_init() {
  HP_RESET='' HP_BOLD='' HP_DIM='' HP_AMBER='' HP_SOFT=''
  HP_PRIMARY='' HP_SECONDARY='' HP_GREEN='' HP_YELLOW='' HP_RED=''
  HP_UI_TTY=false HP_UI_FIXED=false HP_UI_HEADER_LINES=13
  if [[ -t 0 && -t 1 && "${TERM:-dumb}" != dumb ]] && command -v tput >/dev/null 2>&1; then
    HP_UI_TTY=true
    HP_RESET=$'\033[0m' HP_BOLD=$'\033[1m' HP_DIM=$'\033[2m'
    HP_AMBER=$'\033[38;2;255;122;46m' HP_SOFT=$'\033[38;2;255;154;82m'
    HP_PRIMARY=$'\033[38;2;247;243;239m' HP_SECONDARY=$'\033[38;2;185;174;165m'
    HP_GREEN=$'\033[32m' HP_YELLOW=$'\033[33m' HP_RED=$'\033[31m'
  fi
}

hp_ui_columns() {
  local columns=80
  if [[ "$HP_UI_TTY" == true ]]; then columns="$(tput cols 2>/dev/null || printf 80)"; fi
  [[ "$columns" =~ ^[0-9]+$ ]] || columns=80
  printf '%s' "$columns"
}

hp_ui_left() {
  local columns width
  columns="$(hp_ui_columns)"
  width=52
  (( columns < width + 4 )) && width=$((columns - 4))
  (( width < 1 )) && width=1
  printf '%s' "$(((columns - width) / 2))"
}

hp_ui_center() {
  local color="$1" value="$2" columns padding
  columns="$(hp_ui_columns)"
  padding=$(((columns - ${#value}) / 2))
  (( padding < 0 )) && padding=0
  printf '%*s%b%s%b\n' "$padding" '' "$color" "$value" "$HP_RESET"
}

hp_ui_block() {
  local color="$1" value="$2" left
  left="$(hp_ui_left)"
  printf '%*s%b%s%b\n' "$left" '' "$color" "$value" "$HP_RESET"
}

hp_ui_separator() {
  local columns length line
  columns="$(hp_ui_columns)"
  length=$((columns - 4))
  (( length > 64 )) && length=64
  (( length < 1 )) && length=1
  printf -v line '%*s' "$length" ''
  line="${line// /─}"
  hp_ui_center "$HP_SECONDARY" "$line"
}

hp_ui_status() {
  local symbol="$1" color="$2" label="$3" detail="${4:-}" left
  left="$(hp_ui_left)"
  if [[ -n "$detail" ]]; then
    printf '%*s%b%s%b %-25s %s\n' "$left" '' "$color" "$symbol" "$HP_RESET" "$label" "$detail"
  else
    printf '%*s%b%s%b %s\n' "$left" '' "$color" "$symbol" "$HP_RESET" "$label"
  fi
}

hp_ok() { hp_ui_status '✓' "$HP_GREEN" "$1"; }
hp_warn() { hp_ui_status '!' "$HP_YELLOW" "$1"; }
hp_fail() { hp_ui_status '✕' "$HP_RED" 'Failed' "$1" >&2; return 1; }
hp_working() { hp_ui_status '●' "$HP_AMBER" "$1"; }
hp_skipped() { hp_ui_status '—' "$HP_SECONDARY" "$1"; }

hp_ui_header() {
  hp_color_init
  hp_ui_center "$HP_SECONDARY" 'Welcome to'
  printf '\n'
  hp_ui_center "$HP_PRIMARY" '███╗   ██╗███████╗███████╗██╗   ██╗'
  hp_ui_center "$HP_PRIMARY" '████╗  ██║██╔════╝╚══███╔╝██║   ██║'
  hp_ui_center "$HP_PRIMARY" '██╔██╗ ██║█████╗    ███╔╝ ██║   ██║'
  hp_ui_center "$HP_PRIMARY" '██║╚██╗██║██╔══╝   ███╔╝  ██║   ██║'
  hp_ui_center "$HP_PRIMARY" '██║ ╚████║███████╗███████╗╚██████╔╝'
  hp_ui_center "$HP_PRIMARY" '╚═╝  ╚═══╝╚══════╝╚══════╝ ╚═════╝'
  printf '\n'
  hp_ui_center "$HP_AMBER" 'H O M E P I L O T'
  hp_ui_center "$HP_SECONDARY" 'Installation Assistant'
  printf '\n'
  hp_ui_separator
  if [[ "$HP_UI_TTY" == true ]]; then
    local lines
    lines="$(tput lines 2>/dev/null || printf 24)"
    if [[ "$lines" =~ ^[0-9]+$ ]] && (( lines > HP_UI_HEADER_LINES + 5 )) \
      && tput csr "$HP_UI_HEADER_LINES" "$((lines - 1))" 2>/dev/null; then
      HP_UI_FIXED=true
      tput cup "$HP_UI_HEADER_LINES" 0
    fi
  fi
}

hp_ui_clear_dynamic() {
  if [[ "$HP_UI_FIXED" == true ]]; then
    tput cup "$HP_UI_HEADER_LINES" 0
    tput ed
  else
    printf '\n'
  fi
}

hp_ui_shutdown() {
  if [[ "${HP_UI_FIXED:-false}" == true ]]; then
    local lines
    lines="$(tput lines 2>/dev/null || printf 24)"
    tput csr 0 "$((lines - 1))" 2>/dev/null || true
    tput cup "$((lines - 1))" 0 2>/dev/null || true
    HP_UI_FIXED=false
  fi
}

hp_banner() { hp_ui_header; }
hp_ui_view() {
  hp_ui_clear_dynamic
  hp_ui_center "$HP_PRIMARY$HP_BOLD" "$1"
  hp_ui_separator
  printf '\n'
}
hp_step() {
  local number
  printf -v number '%02d / 08' "$1"
  hp_ui_clear_dynamic
  hp_ui_center "$HP_SOFT" "$number"
  hp_ui_center "$HP_PRIMARY$HP_BOLD" "$2"
  hp_ui_separator
  printf '\n'
}

hp_ui_read_raw() {
  local prefix="${1:-}" answer left
  left="$(hp_ui_left)"
  printf '%*s%b❯%b %s' "$left" '' "$HP_AMBER" "$HP_RESET" "$prefix"
  if [[ "$HP_UI_TTY" == true && -r /dev/tty ]]; then
    IFS= read -r answer </dev/tty || return 1
  else
    IFS= read -r answer || return 1
    printf '\n'
  fi
  REPLY="$answer"
}

hp_read() {
  hp_ui_block "$HP_PRIMARY" "$1"
  hp_ui_read_raw
}

hp_ui_confirm_value() { hp_ui_status '✓' "$HP_GREEN" "$1"; }

hp_secret() {
  local answer left
  hp_ui_block "$HP_PRIMARY" "$1"
  left="$(hp_ui_left)"
  printf '%*s%b❯%b ' "$left" '' "$HP_AMBER" "$HP_RESET"
  if [[ "$HP_UI_TTY" == true && -r /dev/tty ]]; then
    IFS= read -rs answer </dev/tty || return 1
  else
    IFS= read -rs answer || return 1
  fi
  printf '%b••••••••%b\n' "$HP_SECONDARY" "$HP_RESET"
  REPLY="$answer"
}

hp_yes_no() {
  local default="$2" answer
  while true; do
    hp_ui_block "$HP_PRIMARY" "$1"
    if [[ "$default" == true ]]; then
      hp_ui_block "$HP_SECONDARY" 'Sí [ENTER]    No [N]'
    else
      hp_ui_block "$HP_SECONDARY" 'Sí [S]        No [ENTER]'
    fi
    hp_ui_read_raw || return 1
    answer="${REPLY,,}"
    case "$answer" in
      s|si|sí|y|yes) hp_ui_status '✓' "$HP_GREEN" 'Sí'; return 0 ;;
      n|no) hp_ui_status '✓' "$HP_GREEN" 'No'; return 1 ;;
      '')
        if [[ "$default" == true ]]; then hp_ui_status '✓' "$HP_GREEN" 'Sí'; return 0; fi
        hp_ui_status '✓' "$HP_GREEN" 'No'; return 1
        ;;
      *) hp_warn 'Responde sí o no.' ;;
    esac
  done
}

hp_ui_select() {
  local title="$1" index option selected
  shift
  hp_ui_block "$HP_PRIMARY" "$title"
  index=1
  for option in "$@"; do
    hp_ui_block "$HP_SECONDARY" "$index. $option"
    index=$((index + 1))
  done
  hp_ui_read_raw 'Selecciona: ' || return 1
  if [[ "$REPLY" =~ ^[0-9]+$ ]]; then
    selected=$((10#$REPLY))
    if (( selected >= 1 && selected <= $# )); then
      hp_ui_status '✓' "$HP_GREEN" "${@:selected:1}"
    fi
  fi
}

hp_ui_yes_label() { [[ "$1" == true ]] && printf 'Sí' || printf 'No'; }

hp_ui_wrap_block() {
  local color="$1" value="$2" word line=''
  for word in $value; do
    if (( ${#line} + ${#word} + 1 > 52 )) && [[ -n "$line" ]]; then
      hp_ui_block "$color" "$line"
      line=''
    fi
    line="${line:+$line }$word"
  done
  [[ -z "$line" ]] || hp_ui_block "$color" "$line"
}

hp_ui_review_row() {
  local row
  printf -v row '%-22s %s' "$1" "$2"
  hp_ui_block "$HP_PRIMARY" "$row"
}

hp_ui_begin() {
  local ubuntu='Ubuntu' docker_state='Setup required' tpm_state='Setup required'
  if [[ -r /etc/os-release ]]; then
    ubuntu="$(sed -n 's/^PRETTY_NAME=//p' /etc/os-release | head -n 1 | tr -d '"')"
    ubuntu="${ubuntu:-Ubuntu}"
  fi
  command -v docker >/dev/null 2>&1 && docker_state='Detected'
  hp_tpm_device_available && tpm_state='Detected'
  hp_ui_center "$HP_SOFT" 'SYSTEM CHECK'
  hp_ui_status '●' "$HP_AMBER" "$ubuntu" 'Ready'
  hp_ui_status '●' "$HP_AMBER" 'Docker' "$docker_state"
  hp_ui_status '●' "$HP_AMBER" 'TPM 2.0' "$tpm_state"
  hp_ui_status '●' "$HP_AMBER" 'HomePilot' 'Setup required'
  printf '\n'
  hp_ui_center "$HP_PRIMARY" 'HomePilot Edge Setup'
  hp_ui_center "$HP_SECONDARY" 'Configure this MiniPC for a HomePilot installation.'
  if [[ "$HP_UI_TTY" == true ]]; then
    printf '\n'
    hp_ui_block "$HP_AMBER" '❯ Press ENTER to begin setup'
    local ignored
    IFS= read -rs ignored </dev/tty || return 1
    printf '\n'
  fi
}
