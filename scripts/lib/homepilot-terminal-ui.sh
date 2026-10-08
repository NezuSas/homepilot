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
  if [[ "$HP_UI_TTY" == true ]] && (( ${#value} > columns )); then hp_ui_wrap_block "$color" "$value"; return; fi
  padding=$(((columns - ${#value}) / 2))
  (( padding < 0 )) && padding=0
  printf '%*s%b%s%b\n' "$padding" '' "$color" "$value" "$HP_RESET"
}

hp_ui_block() {
  local color="$1" value="$2" left
  left="$(hp_ui_left)"
  local columns
  columns="$(hp_ui_columns)"
  if [[ "$HP_UI_TTY" == true ]] && (( ${#value} > columns - left * 2 )); then hp_ui_wrap_block "$color" "$value"; return; fi
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
  local columns
  columns="$(hp_ui_columns)"
  case "$detail" in
    Healthy) detail='Saludable' ;; Online) detail='Disponible' ;;
    Bound) detail='Identidad vinculada' ;; Paired) detail='Emparejado' ;;
    Running) detail='En ejecución; salud no verificada' ;;
    'Not installed') detail='No configurado' ;; Unavailable) detail='No disponible' ;;
    'Detected · binding pending') detail='Detectado · vinculación pendiente' ;;
    'Unavailable (HTTP '*) detail="${detail/Unavailable/No disponible}" ;;
  esac
  if [[ "$HP_UI_TTY" == true && -n "$detail" ]] && (( ${#detail} + 29 > columns - left * 2 || ${#label} > 25 )); then
    hp_ui_wrap_block "$color" "$symbol $label"
    hp_ui_wrap_block "$HP_SECONDARY" "  $detail"
    return
  fi
  if [[ -n "$detail" ]]; then
    printf '%*s%b%s%b %-25s %s\n' "$left" '' "$color" "$symbol" "$HP_RESET" "$label" "$detail"
  else
    printf '%*s%b%s%b %s\n' "$left" '' "$color" "$symbol" "$HP_RESET" "$label"
  fi
}

hp_ok() { hp_ui_status '✓' "$HP_GREEN" "$1"; }
hp_warn() { hp_ui_status '!' "$HP_YELLOW" "$1"; }
hp_fail() { hp_ui_status '✕' "$HP_RED" 'Error' "$1" >&2; return 1; }
hp_working() { hp_ui_status '●' "$HP_AMBER" "$1"; }
hp_skipped() { hp_ui_status '—' "$HP_SECONDARY" "$1"; }

# Only non-interactive external operations use this wrapper. Prompts, pairing,
# credentials and enrollment remain foreground operations, never captured.
hp_ui_progress_line() {
  local label="$1" elapsed="$2" frame="$3" left width suffix
  left="$(hp_ui_left)"
  width=$(( $(hp_ui_columns) - left * 2 ))
  suffix=" ${elapsed}s"
  if (( width > ${#suffix} + 4 )); then
    label="${label:0:$((width - ${#suffix} - 3))}"
    printf '\r\033[2K%*s%b%s%b %s%b%s%b' "$left" '' "$HP_AMBER" "$frame" "$HP_RESET" "$label" "$HP_SECONDARY" "$suffix" "$HP_RESET"
  fi
}

hp_ui_progress_stop() {
  if [[ -n "${HP_UI_PROGRESS_PID:-}" ]]; then
    kill "$HP_UI_PROGRESS_PID" 2>/dev/null || true
    wait "$HP_UI_PROGRESS_PID" 2>/dev/null || true
    HP_UI_PROGRESS_PID=''
    printf '\r\033[2K'
  fi
}

hp_ui_run() {
  local label="$1" result=0
  shift
  hp_working "$label"
  if [[ "${HP_UI_TTY:-false}" != true || "${HOMEPILOT_VERBOSE:-0}" == 1 ]]; then
    if "$@"; then result=0; else result=$?; fi
  else
    (
      local started=$SECONDS frame=0
      local -a frames=('·' 'o' 'O' 'o')
      while true; do
        hp_ui_progress_line "$label" "$((SECONDS - started))" "${frames[frame]}"
        frame=$(((frame + 1) % 4))
        sleep 0.2
      done
    ) &
    HP_UI_PROGRESS_PID=$!
    # Do not persist raw output: dependency/build failures can contain private
    # URLs or environment values. Detailed mode preserves the existing stream.
    if "$@" >/dev/null 2>&1; then result=0; else result=$?; fi
    hp_ui_progress_stop
  fi
  if (( result == 0 )); then
    hp_ok "$label · completado"
  else
    hp_warn "$label · falló (código ${result}). No se declara completado."
    hp_ui_wrap_block "$HP_SECONDARY" 'Para diagnosticar, usa --verbose; revisa el fallo antes de repetir una operación.'
  fi
  return "$result"
}

hp_ui_prepare_first_frame() {
  [[ "$HP_UI_TTY" == true && "${HP_UI_INITIAL_CLEARED:-false}" != true ]] || return 0

  local lines
  lines="$(tput lines 2>/dev/null || printf 0)"
  if [[ "$lines" =~ ^[0-9]+$ ]] && (( lines > 0 )); then
    tput csr 0 "$((lines - 1))" 2>/dev/null || true
  fi
  if ! tput clear 2>/dev/null; then printf '\033[2J'; fi
  tput cup 0 0 2>/dev/null || printf '\033[H'
  HP_UI_INITIAL_CLEARED=true
}

hp_ui_header() {
  hp_color_init
  hp_ui_prepare_first_frame
  hp_ui_center "$HP_SECONDARY" 'Bienvenido a'
  printf '\n'
  if [[ "$HP_UI_TTY" != true ]] || (( $(hp_ui_columns) < 44 )); then
    hp_ui_center "$HP_PRIMARY$HP_BOLD" 'NEZU'
    HP_UI_HEADER_LINES=8
  else
  hp_ui_center "$HP_PRIMARY" '███╗   ██╗███████╗███████╗██╗   ██╗'
  hp_ui_center "$HP_PRIMARY" '████╗  ██║██╔════╝╚══███╔╝██║   ██║'
  hp_ui_center "$HP_PRIMARY" '██╔██╗ ██║█████╗    ███╔╝ ██║   ██║'
  hp_ui_center "$HP_PRIMARY" '██║╚██╗██║██╔══╝   ███╔╝  ██║   ██║'
  hp_ui_center "$HP_PRIMARY" '██║ ╚████║███████╗███████╗╚██████╔╝'
  hp_ui_center "$HP_PRIMARY" '╚═╝  ╚═══╝╚══════╝╚══════╝ ╚═════╝'
  fi
  printf '\n'
  hp_ui_center "$HP_AMBER" 'H O M E P I L O T'
  hp_ui_center "$HP_SECONDARY" 'Administración de la instalación'
  printf '\n'
  hp_ui_separator
  if [[ "$HP_UI_TTY" == true ]] && (( $(hp_ui_columns) >= 44 )); then
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
  if [[ "$HP_UI_FIXED" == true ]] && (( $(hp_ui_columns) < 44 )); then hp_ui_shutdown; fi
  if [[ "$HP_UI_FIXED" == true ]]; then
    tput cup "$HP_UI_HEADER_LINES" 0
    tput ed
  else
    printf '\n'
  fi
}

hp_ui_shutdown() {
  hp_ui_progress_stop
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
  printf -v number '%02d / %02d' "$1" "${3:-8}"
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
  while true; do
    hp_ui_read_raw 'Selecciona: ' || return 1
    if [[ "$REPLY" =~ ^[0-9]{1,2}$ ]]; then
    selected=$((10#$REPLY))
    if (( selected >= 1 && selected <= $# )); then
      hp_ui_status '✓' "$HP_GREEN" "${@:selected:1}"
      REPLY="$selected"
      return 0
    fi
    fi
    hp_warn 'Selecciona una opción válida.'
  done
}

hp_ui_yes_label() { [[ "$1" == true ]] && printf 'Sí' || printf 'No'; }

hp_ui_wrap_block() {
  local color="$1" value="$2" word line='' left width columns
  if [[ "$HP_UI_TTY" != true ]]; then printf '%s\n' "$value"; return; fi
  columns="$(hp_ui_columns)"
  left="$(hp_ui_left)"
  width=$((columns - left * 2))
  (( width > 0 )) || width=1
  local -a words=()
  read -r -a words <<< "$value"
  for word in "${words[@]}"; do
    if (( ${#line} + ${#word} + 1 > width )) && [[ -n "$line" ]]; then
      printf '%*s%b%s%b\n' "$left" '' "$color" "$line" "$HP_RESET"
      line=''
    fi
    while (( ${#word} > width )); do
      printf '%*s%b%s%b\n' "$left" '' "$color" "${word:0:width}" "$HP_RESET"
      word="${word:width}"
    done
    line="${line:+$line }$word"
  done
  if [[ -n "$line" ]]; then printf '%*s%b%s%b\n' "$left" '' "$color" "$line" "$HP_RESET"; fi
  return 0
}

hp_ui_review_row() {
  local row
  printf -v row '%-22s %s' "$1" "$2"
  hp_ui_block "$HP_PRIMARY" "$row"
}

hp_ui_begin() {
  local ubuntu='Ubuntu' docker_state='Pendiente' tpm_state='Pendiente'
  if [[ -r /etc/os-release ]]; then
    ubuntu="$(sed -n 's/^PRETTY_NAME=//p' /etc/os-release | head -n 1 | tr -d '"')"
    ubuntu="${ubuntu:-Ubuntu}"
  fi
  command -v docker >/dev/null 2>&1 && docker_state='Detectado'
  hp_tpm_device_available && tpm_state='Detectado'
  hp_ui_center "$HP_SOFT" 'COMPROBACIÓN INICIAL'
  hp_ui_status '●' "$HP_AMBER" "$ubuntu" 'Detectado; requisitos por verificar'
  hp_ui_status '●' "$HP_AMBER" 'Docker' "$docker_state"
  hp_ui_status '●' "$HP_AMBER" 'TPM 2.0' "$tpm_state"
  hp_ui_status '●' "$HP_AMBER" 'HomePilot' 'Pendiente de instalación'
  printf '\n'
  hp_ui_center "$HP_PRIMARY" 'Preparación de HomePilot Edge'
  hp_ui_wrap_block "$HP_SECONDARY" 'Configura esta MiniPC para una instalación de HomePilot.'
  if [[ "$HP_UI_TTY" == true ]]; then
    printf '\n'
    hp_ui_block "$HP_AMBER" '❯ Pulsa ENTER para comenzar'
    local ignored
    IFS= read -rs ignored </dev/tty || return 1
    printf '\n'
  fi
}
