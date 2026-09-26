#!/usr/bin/env bash

# Shared deployment policy. Backends live here, outside camera domain code.
camera_acceleration_render_device() {
  printf '%s' '/dev/dri/renderD128'
}

camera_acceleration_device_available() {
  [[ -c "$(camera_acceleration_render_device)" ]]
}

camera_acceleration_probe_vaapi() {
  local image="$1"
  local device
  device="$(camera_acceleration_render_device)"

  # A listed encoder is not enough: exercise the actual render node and encode.
  timeout 25s docker run --rm --network none --device "${device}:${device}" \
    --entrypoint ffmpeg "$image" -nostdin -hide_banner -loglevel error \
    -vaapi_device "$device" -f lavfi -i 'color=black:s=128x128:r=15:d=1' \
    -vf 'format=nv12,hwupload' -frames:v 3 -c:v h264_vaapi -f null - \
    >/dev/null 2>&1
}

camera_acceleration_select() {
  local image='homepilot-camera-probe:local'
  camera_acceleration_detected='ninguna'
  camera_acceleration_encoder='libx264'
  camera_acceleration_fallback='software (libx264)'
  camera_acceleration_reason=''
  camera_acceleration_overlay=''

  if [[ "${OSTYPE:-}" != linux* ]]; then
    camera_acceleration_reason='host no Linux'
    return 0
  fi
  if ! camera_acceleration_device_available; then
    camera_acceleration_reason='/dev/dri/renderD128 no disponible'
    return 0
  fi
  camera_acceleration_detected='VAAPI (renderD128)'

  if ! command -v timeout >/dev/null 2>&1; then
    camera_acceleration_reason='timeout no disponible para una prueba acotada'
    return 0
  fi
  # Probe the same runtime Dockerfile as the API, not an unrelated host FFmpeg.
  if ! timeout 600s docker build --quiet --tag "$image" -f docker/api/Dockerfile . >/dev/null 2>&1; then
    camera_acceleration_reason='no se pudo preparar la imagen de prueba'
    return 0
  fi
  if ! camera_acceleration_probe_vaapi "$image"; then
    camera_acceleration_reason='FFmpeg no pudo codificar con h264_vaapi'
    return 0
  fi

  camera_acceleration_encoder='auto (h264_vaapi)'
  camera_acceleration_fallback='libx264 si VAAPI falla durante un stream'
  camera_acceleration_overlay='docker-compose.camera-vaapi.yml'
}

camera_acceleration_report() {
  printf 'Aceleración de cámara detectada: %s\n' "$camera_acceleration_detected"
  printf 'Encoder HLS seleccionado: %s\n' "$camera_acceleration_encoder"
  printf 'Fallback: %s\n' "$camera_acceleration_fallback"
  if [[ -n "$camera_acceleration_reason" ]]; then
    printf 'Motivo: %s\n' "$camera_acceleration_reason"
  fi
}

camera_acceleration_report_running() {
  local device_mapping encoder_env
  if ! docker inspect homepilot-api >/dev/null 2>&1; then
    printf '%s\n' 'Aceleración configurada: sin API desplegada.'
    printf '%s\n' 'Encoder seleccionado: pendiente del próximo despliegue.'
    return 0
  fi
  device_mapping="$(docker inspect --format '{{range .HostConfig.Devices}}{{println .PathOnHost}}{{end}}' homepilot-api 2>/dev/null || true)"
  encoder_env="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' homepilot-api 2>/dev/null || true)"
  if [[ "$encoder_env" == *'HOMEPILOT_CAMERA_HLS_ENCODER=auto'* ]] \
    && { [[ "$device_mapping" == *'/dev/dri/renderD128'* ]] || [[ "$device_mapping" == *'/dev/dri'* ]]; }; then
    printf '%s\n' 'Aceleración configurada: VAAPI (dispositivo asignado al API).'
    printf '%s\n' 'Encoder seleccionado: auto; h264_vaapi con fallback libx264 si falla el stream.'
    # Inspect process arguments without ever printing camera URLs or credentials.
    if docker top homepilot-api -eo args 2>/dev/null \
      | awk '/-c:v[[:space:]]+libx264([[:space:]]|$)/ { found=1 } END { exit !found }'; then
      printf '%s\n' 'Fallback utilizado: libx264 en un stream activo.'
    else
      printf '%s\n' 'Fallback utilizado: ninguno observable en este momento.'
    fi
  else
    printf '%s\n' 'Aceleración configurada: ninguna.'
    printf '%s\n' 'Encoder seleccionado: libx264 (software).'
  fi
}
