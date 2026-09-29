#!/usr/bin/env bash

# Only enabled Compose-built runtime images participate in rollback rotation.
# The camera probe is labeled separately and has no rollback: it is disposable
# and can be rebuilt from the API Dockerfile on the next acceleration check.
HOMEPILOT_IMAGE_SERVICES=(api ui stt tts)

homepilot_image_enable_display() {
  HOMEPILOT_IMAGE_SERVICES+=(display-bridge)
}

homepilot_image_revision() {
  if [[ -n "${HOMEPILOT_BUILD_REVISION:-}" ]]; then
    printf '%s\n' "$HOMEPILOT_BUILD_REVISION"
    return
  fi
  git rev-parse --short=12 HEAD 2>/dev/null || printf 'unknown\n'
}

homepilot_image_rollback_tag() {
  printf 'homepilot-rollback-%s:latest' "$1"
}

homepilot_image_pending_tag() {
  printf 'homepilot-rollback-pending-%s:latest' "$1"
}

homepilot_image_id() {
  docker image inspect --format '{{.Id}}' "$1" 2>/dev/null
}

homepilot_image_compose_id() {
  local service="$1"
  shift
  local container_id
  container_id="$(docker compose "$@" ps -a -q "homepilot-${service}")" || return 1
  if [[ -n "$container_id" ]]; then
    [[ "$container_id" != *$'\n'* ]] || return 1
    docker inspect --format '{{.Image}}' "$container_id"
  else
    # The standard Compose project may have an image but no container yet.
    homepilot_image_id "homepilot-homepilot-${service}:latest" || return 0
  fi
}

homepilot_image_is_managed_runtime() {
  local image_id="$1" service="$2" labels managed actual_service role
  labels="$(docker image inspect --format '{{index .Config.Labels "io.nezu.homepilot.managed"}}|{{index .Config.Labels "io.nezu.homepilot.service"}}|{{index .Config.Labels "io.nezu.homepilot.role"}}' "$image_id" 2>/dev/null)" || return 1
  IFS='|' read -r managed actual_service role <<< "$labels"
  [[ "$managed" == v1 && "$actual_service" == "$service" && "$role" == runtime ]]
}

homepilot_image_prepare_rollback() {
  local service previous pending current
  local -a compose_options=("$@")

  # Preflight the entire set before creating any pending tags.
  for service in "${HOMEPILOT_IMAGE_SERVICES[@]}"; do
    pending="$(homepilot_image_pending_tag "$service")"
    if homepilot_image_id "$pending" >/dev/null; then
      fail "Existe ${pending} de un despliegue anterior no consolidado. Revísalo antes de volver a desplegar; no se sobrescribe."
    fi
    previous="$(homepilot_image_compose_id "$service" "${compose_options[@]}")" \
      || fail "No se pudo identificar la imagen anterior de ${service}; no se construirá."
  done

  for service in "${HOMEPILOT_IMAGE_SERVICES[@]}"; do
    previous="$(homepilot_image_compose_id "$service" "${compose_options[@]}")" \
      || fail "No se pudo identificar la imagen anterior de ${service}; no se construirá."
    [[ -n "$previous" ]] || continue
    pending="$(homepilot_image_pending_tag "$service")"
    docker image tag "$previous" "$pending" \
      || fail "No se pudo proteger la imagen anterior de ${service}; no se construirá."
    info "Imagen anterior de ${service} protegida como candidato de rollback."
  done
}

homepilot_image_finalize_rollback() {
  local service previous current pending rollback
  local -a compose_options=("$@")

  # Never rotate a previous rollback until every new runtime image is verified.
  for service in "${HOMEPILOT_IMAGE_SERVICES[@]}"; do
    pending="$(homepilot_image_pending_tag "$service")"
    previous="$(homepilot_image_id "$pending" || true)"
    [[ -n "$previous" ]] || continue
    current="$(homepilot_image_compose_id "$service" "${compose_options[@]}")" \
      || fail "No se pudo verificar la imagen activa de ${service}; se conservan los rollback anteriores."
    [[ -n "$current" ]] || fail "Falta la imagen activa de ${service}; se conservan los rollback anteriores."
    homepilot_image_is_managed_runtime "$current" "$service" \
      || fail "La nueva imagen de ${service} no tiene labels HomePilot válidos; no se consolida el rollback."
  done

  for service in "${HOMEPILOT_IMAGE_SERVICES[@]}"; do
    pending="$(homepilot_image_pending_tag "$service")"
    previous="$(homepilot_image_id "$pending" || true)"
    [[ -n "$previous" ]] || continue
    current="$(homepilot_image_compose_id "$service" "${compose_options[@]}")" \
      || fail "No se pudo confirmar la imagen activa de ${service}."
    if [[ "$previous" != "$current" ]]; then
      rollback="$(homepilot_image_rollback_tag "$service")"
      docker image tag "$previous" "$rollback" \
        || fail "No se pudo consolidar el rollback de ${service}; el candidato sigue protegido."
      info "Rollback anterior de ${service} consolidado después de la verificación operativa."
    fi
    docker image rm "$pending" >/dev/null \
      || fail "No se pudo retirar la etiqueta temporal ${pending}; revisa el estado antes del próximo deploy."
  done
}

homepilot_image_gc_scan() {
  local image_list containers container_id image_id labels managed service role tags digests reference
  local protected_id
  local -A protected=() seen=()
  local -a image_ids=() container_ids=()
  HOMEPILOT_GC_CANDIDATES=()
  HOMEPILOT_GC_CANDIDATE_SERVICES=()

  image_list="$(docker image ls --all --quiet --no-trunc --filter label=io.nezu.homepilot.managed=v1)" \
    || fail 'No se pudo enumerar las imágenes etiquetadas de HomePilot; no se eliminará nada.'
  containers="$(docker ps --all --quiet --no-trunc)" \
    || fail 'No se pudo enumerar todos los contenedores; no se eliminará nada.'
  [[ -z "$image_list" ]] || mapfile -t image_ids <<< "$image_list"
  [[ -z "$containers" ]] || mapfile -t container_ids <<< "$containers"

  # A container from any project protects its image, including when stopped.
  for container_id in "${container_ids[@]}"; do
    image_id="$(docker inspect --format '{{.Image}}' "$container_id")" \
      || fail 'No se pudo inspeccionar un contenedor; no se eliminará nada.'
    [[ "$image_id" == sha256:* ]] || fail 'Un contenedor devolvió una referencia de imagen no verificable.'
    protected["$image_id"]=1
  done

  for service in "${HOMEPILOT_IMAGE_SERVICES[@]}"; do
    for reference in "homepilot-homepilot-${service}:latest" \
      "$(homepilot_image_rollback_tag "$service")" \
      "$(homepilot_image_pending_tag "$service")"; do
      protected_id="$(homepilot_image_id "$reference" || true)"
      [[ -z "$protected_id" ]] || protected["$protected_id"]=1
    done
  done
  protected_id="$(homepilot_image_id 'homepilot-camera-probe:local' || true)"
  [[ -z "$protected_id" ]] || protected["$protected_id"]=1
  # Preserve a previously installed display image even when the feature is off.
  for reference in homepilot-homepilot-display-bridge:latest \
    "$(homepilot_image_rollback_tag display-bridge)" \
    "$(homepilot_image_pending_tag display-bridge)"; do
    protected_id="$(homepilot_image_id "$reference" || true)"
    [[ -z "$protected_id" ]] || protected["$protected_id"]=1
  done

  for image_id in "${image_ids[@]}"; do
    [[ "$image_id" == sha256:* && -z "${seen[$image_id]:-}" ]] || continue
    seen["$image_id"]=1
    [[ -z "${protected[$image_id]:-}" ]] || continue
    labels="$(docker image inspect --format '{{index .Config.Labels "io.nezu.homepilot.managed"}}|{{index .Config.Labels "io.nezu.homepilot.service"}}|{{index .Config.Labels "io.nezu.homepilot.role"}}' "$image_id")" \
      || fail 'No se pudo revalidar una imagen; no se eliminará nada.'
    IFS='|' read -r managed service role <<< "$labels"
    [[ "$managed" == v1 ]] || continue
    case "$service:$role" in
      api:runtime|ui:runtime|stt:runtime|tts:runtime|display-bridge:runtime|api:probe) ;;
      *) continue ;;
    esac
    tags="$(docker image inspect --format '{{json .RepoTags}}' "$image_id")" \
      || fail 'No se pudieron verificar las etiquetas de una imagen; no se eliminará nada.'
    digests="$(docker image inspect --format '{{json .RepoDigests}}' "$image_id")" \
      || fail 'No se pudieron verificar los digests de una imagen; no se eliminará nada.'
    # Only truly untagged, digest-free images are eligible. Any other project
    # reference is an ownership ambiguity, even when the image has our labels.
    [[ "$tags" == null || "$tags" == '[]' ]] || continue
    [[ "$digests" == null || "$digests" == '[]' ]] || continue
    HOMEPILOT_GC_CANDIDATES+=("$image_id")
    HOMEPILOT_GC_CANDIDATE_SERVICES+=("${service}:${role}")
  done
}

homepilot_image_gc_report() {
  local index
  info 'Candidatas: solo imágenes dangling con labels HomePilot v1 y sin uso por ningún contenedor.'
  for index in "${!HOMEPILOT_GC_CANDIDATES[@]}"; do
    printf '  %s  %s\n' "${HOMEPILOT_GC_CANDIDATE_SERVICES[$index]}" "${HOMEPILOT_GC_CANDIDATES[$index]}"
  done
  if (( ${#HOMEPILOT_GC_CANDIDATES[@]} == 0 )); then
    info 'No hay imágenes HomePilot verificadas para eliminar. Las legacy sin labels se conservan.'
  fi
}

homepilot_image_gc_remove() {
  local image_id current_id found
  local -a approved=("${HOMEPILOT_GC_CANDIDATES[@]}")
  for image_id in "${approved[@]}"; do
    # Re-scan immediately before each removal; another process may have
    # attached a container or tag after the preview was printed.
    homepilot_image_gc_scan
    found=false
    for current_id in "${HOMEPILOT_GC_CANDIDATES[@]}"; do
      [[ "$current_id" != "$image_id" ]] || found=true
    done
    if [[ "$found" != true ]]; then
      warn "La imagen ${image_id} cambió desde la vista previa; se conserva."
      continue
    fi
    docker image rm "$image_id" \
      || fail "Docker no pudo eliminar ${image_id}; se detiene la limpieza sin forzarla."
  done
}
