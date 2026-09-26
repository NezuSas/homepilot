import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'docker-compose.yml',
  'docker-compose.office.yml',
  'docker-compose.desktop.yml',
  'docker-compose.ha-companion.desktop.yml',
  'docker-compose.pc-agents.yml',
  'mosquitto/config/mosquitto.secure.conf',
  'docker/ui/nginx.conf',
  'docker/ui/nginx.desktop.conf',
  'scripts/homepilot-maintenance.sh',
  'scripts/lib/homepilot-builder.sh',
  'scripts/lib/homepilot-images.sh',
  'docker/buildkit/homepilot-buildkitd.toml',
  '.dockerignore',
  '.env.office.example',
  '.env.native.example',
];

const failures = [];
const read = (file) => readFileSync(file, 'utf8');
const modelRuntimePattern = /\bollama\b|OLLAMA_|ASSISTANT_CONVERSATIONAL_LLM_PROVIDER|CLOUDFLARE_AI_|ASSISTANT_PLANNER_V2_/i;

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push('Missing required Docker profile file: ' + file);
}

if (failures.length === 0) {
  const integrated = read('docker-compose.yml');
  const office = read('docker-compose.office.yml');
  const desktop = read('docker-compose.desktop.yml');
  const haCompanionDesktop = read('docker-compose.ha-companion.desktop.yml');
  const pcAgents = read('docker-compose.pc-agents.yml');
  const secureMqtt = read('mosquitto/config/mosquitto.secure.conf');
  const nginx = read('docker/ui/nginx.conf');
  const desktopNginx = read('docker/ui/nginx.desktop.conf');
  const maintenance = read('scripts/homepilot-maintenance.sh');
  const builderHelper = read('scripts/lib/homepilot-builder.sh');
  const imageHelper = read('scripts/lib/homepilot-images.sh');
  const builderGc = read('docker/buildkit/homepilot-buildkitd.toml');
  const dockerignore = read('.dockerignore');
  const officeEnvironmentTemplate = read('.env.office.example');
  const nativeEnvironmentTemplate = read('.env.native.example');

  for (const entry of [['integrated', integrated], ['office', office], ['desktop override', desktop]]) {
    const profile = entry[0];
    const content = entry[1];
    if (!content.includes('HOMEPILOT_DB_PATH')) failures.push(profile + ' profile does not declare HOMEPILOT_DB_PATH');
    if (modelRuntimePattern.test(content)) failures.push(profile + ' profile must not declare a language-model runtime');
  }

  if (!integrated.includes('./data:/app/data') || !office.includes('./data:/app/data')) {
    failures.push('Every primary profile must mount the canonical ./data directory');
  }
  if (!dockerignore.split(/\r?\n/).includes('backups') || !dockerignore.split(/\r?\n/).includes('.env*')) {
    failures.push('Docker build context must exclude backups and every local .env variant');
  }
  for (const [name, content] of [['integrated', integrated], ['office', office]]) {
    if (!content.includes('127.0.0.1:${HOMEPILOT_TTS_PORT:-8088}:8088')
      && !content.includes('127.0.0.1:8088:8088')) {
      failures.push(`${name} must publish TTS on host loopback only`);
    }
    if (!content.includes('127.0.0.1:${HOMEPILOT_STT_PORT:-8090}:8090')
      && !content.includes('127.0.0.1:8090:8090')) {
      failures.push(`${name} must publish STT on host loopback only`);
    }
    if (!content.includes('max-size: "10m"') || !content.includes('max-file: "3"')) {
      failures.push(`${name} must rotate local Docker logs`);
    }
  }
  if (!integrated.includes('INTERNAL_HA_URL=${INTERNAL_HA_URL:-http://127.0.0.1:18123}')
    || !haCompanionDesktop.includes('INTERNAL_HA_URL: http://homeassistant:8123')) {
    failures.push('ha_companion must use host loopback on Linux and service DNS on Docker Desktop');
  }
  if (!integrated.includes('./mosquitto/config:/mosquitto/config:ro')
    || integrated.includes('./mosquitto/config/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro')) {
    failures.push('MQTT must mount the complete config directory, not a single config file');
  }
  if (!integrated.includes('mosquitto_sub -h 127.0.0.1 -p 1883')
    || !integrated.includes('condition: service_healthy')) {
    failures.push('MQTT must declare a local healthcheck and Home Assistant must wait for it');
  }  if (integrated.includes('homepilot-mqtt-credentials')) {
    failures.push('Local MQTT must not require an external credentials volume that is unused by its anonymous loopback profile');
  }  if (!pcAgents.includes('mosquitto.secure.conf') || !pcAgents.includes('./data/mqtt:/mosquitto/config/credentials:ro')
    || !secureMqtt.includes('allow_anonymous false') || !secureMqtt.includes('acl_file')) {
    failures.push('Office PC-agent MQTT must use the secure credentials and ACL profile');
  }
  if (!integrated.includes('/app/data/homepilot.db') || !office.includes('/app/data/homepilot.db') || !desktop.includes('/app/data/homepilot.db')) {
    failures.push('Every profile must target /app/data/homepilot.db');
  }
  if (!desktop.includes('HOMEPILOT_RUNTIME_TARGET: docker_desktop') || !desktop.includes('host.docker.internal:18123')) {
    failures.push('Desktop profile must select docker_desktop and use host.docker.internal for Home Assistant');
  }
  if (!desktop.includes('HOMEPILOT_API_PORT:-13000') || !office.includes('HOMEPILOT_UI_PORT:-8080')) {
    failures.push('Desktop profile must expose API 13000 and UI 8080 defaults');
  }
  if (!office.includes('TTS_BASE_URL: http://127.0.0.1:${HOMEPILOT_TTS_PORT:-8088}')
    || !office.includes('STT_BASE_URL: http://127.0.0.1:${HOMEPILOT_STT_PORT:-8090}')
    || !integrated.includes('TTS_BASE_URL=${TTS_BASE_URL:-http://127.0.0.1:8088}')
    || !integrated.includes('STT_BASE_URL=${STT_BASE_URL:-http://127.0.0.1:8090}')) {
    failures.push('Linux host-network profiles must use loopback URLs for local voice services');
  }
  for (const desktopProfile of [desktop, haCompanionDesktop]) {
    if (!desktopProfile.includes('TTS_BASE_URL: http://homepilot-tts:8088')
      || !desktopProfile.includes('STT_BASE_URL: http://homepilot-stt:8090')) {
      failures.push('Docker Desktop overlays must use Docker service URLs for local voice services');
    }
  }
  if (modelRuntimePattern.test(officeEnvironmentTemplate) || modelRuntimePattern.test(nativeEnvironmentTemplate)) {
    failures.push('Installation environment templates must not configure a language-model runtime');
  }
  if (modelRuntimePattern.test(maintenance)) {
    failures.push('Maintenance runtime checks must not require a language-model service');
  }
  if (!maintenance.includes('is_docker_desktop')
    || !maintenance.includes('docker-compose.desktop.yml')
    || !maintenance.includes('docker compose "${compose_args[@]}" build --builder "$HOMEPILOT_BUILDER_NAME"')
    || !maintenance.includes('docker compose "${compose_args[@]}" up -d --no-build --remove-orphans')) {
    failures.push('Maintenance deploy must select the Docker Desktop overlay, build with the dedicated builder, then start without rebuilding');
  }
  if (!builderHelper.includes('--buildkitd-config "$HOMEPILOT_BUILDKIT_CONFIG"')
    || !builderHelper.includes('homepilot_builder_policy_matches')
    || !builderGc.includes('reservedSpace = "8GiB"')
    || !builderGc.includes('maxUsedSpace = "11GiB"')
    || !builderGc.includes('minFreeSpace = "25GiB"')) {
    failures.push('HomePilot builder must load its versioned, bounded GC policy and reject unverified existing builders');
  }
  if (maintenance.includes('docker builder prune')
    || maintenance.includes('docker image prune')
    || maintenance.includes('docker container prune')
    || maintenance.includes('docker network prune')) {
    failures.push('Maintenance must not run global Docker prune commands');
  }
  if (!maintenance.includes('homepilot_image_prepare_rollback')
    || !maintenance.includes('homepilot_image_finalize_rollback')
    || !maintenance.includes('--gc-homepilot')
    || !imageHelper.includes('io.nezu.homepilot.managed=v1')
    || !imageHelper.includes('docker image rm "$image_id"')
    || /docker (?:system|image|builder|volume) prune/.test(imageHelper)) {
    failures.push('HomePilot image lifecycle must remain explicit, label-scoped and free of global prune');
  }
  for (const [name, content] of [
    ['API', read('docker/api/Dockerfile')],
    ['UI', read('docker/ui/Dockerfile')],
    ['STT', read('services/stt-whisper/Dockerfile')],
    ['TTS', read('services/tts-piper/Dockerfile')],
  ]) {
    if (!content.includes('io.nezu.homepilot.managed="v1"')
      || !content.includes('io.nezu.homepilot.service=')
      || !content.includes('io.nezu.homepilot.revision=')) {
      failures.push(`${name} runtime image must carry versioned HomePilot ownership labels`);
    }
  }
  for (const entry of [['office nginx', nginx], ['desktop nginx', desktopNginx]]) {
    const name = entry[0];
    const content = entry[1];
    if (!content.includes('location /api/') || !content.includes('location /ws') || !content.includes('location = /health')) {
      failures.push(name + ' must proxy /api, /ws and /health same-origin');
    }
  }
}

if (failures.length > 0) {
  console.error('Docker profile validation failed:');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}

console.log('Docker profile validation passed: canonical SQLite path, model-free deterministic assistant runtime, Desktop override, and same-origin proxies are present.');
