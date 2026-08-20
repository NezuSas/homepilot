import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'docker-compose.yml',
  'docker-compose.office.yml',
  'docker-compose.desktop.yml',
  'docker/ui/nginx.conf',
  'docker/ui/nginx.desktop.conf',
  'scripts/homepilot-maintenance.sh',
  '.env.office.example',
  '.env.native.example',
];

const failures = [];
const read = (file) => readFileSync(file, 'utf8');

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing required Docker profile file: ${file}`);
}

if (failures.length === 0) {
  const integrated = read('docker-compose.yml');
  const office = read('docker-compose.office.yml');
  const desktop = read('docker-compose.desktop.yml');
  const nginx = read('docker/ui/nginx.conf');
  const desktopNginx = read('docker/ui/nginx.desktop.conf');
  const maintenance = read('scripts/homepilot-maintenance.sh');
  const officeEnvironmentTemplate = read('.env.office.example');
  const nativeEnvironmentTemplate = read('.env.native.example');

  for (const [profile, content] of [['integrated', integrated], ['office', office], ['desktop override', desktop]]) {
    if (!content.includes('HOMEPILOT_DB_PATH')) failures.push(`${profile} profile does not declare HOMEPILOT_DB_PATH`);
  }

  if (!integrated.includes('./data:/app/data') || !office.includes('./data:/app/data')) {
    failures.push('Every primary profile must mount the canonical ./data directory');
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
  if (!integrated.includes('ASSISTANT_PLANNER_V2_EXECUTION=${ASSISTANT_PLANNER_V2_EXECUTION:-false}')
    || !office.includes('ASSISTANT_PLANNER_V2_EXECUTION: ${ASSISTANT_PLANNER_V2_EXECUTION:-false}')
    || !officeEnvironmentTemplate.includes('ASSISTANT_PLANNER_V2_EXECUTION=false')
    || !nativeEnvironmentTemplate.includes('ASSISTANT_PLANNER_V2_EXECUTION=false')) {
    failures.push('Every deployment profile and installation template must keep Planner V2 execution disabled by default');
  }
  if (!office.includes('OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://localhost:11434}')
    || !officeEnvironmentTemplate.includes('OLLAMA_BASE_URL=http://localhost:11434')
    || !nativeEnvironmentTemplate.includes('OLLAMA_BASE_URL=http://ollama:11434')) {
    failures.push('Office host networking must reach Ollama through localhost, while the native Docker profile must use service DNS');
  }
  if (!maintenance.includes('is_docker_desktop')
    || !maintenance.includes('docker-compose.desktop.yml')
    || !maintenance.includes('docker compose "${compose_args[@]}" up -d --build')) {
    failures.push('Maintenance deploy must select the Docker Desktop overlay and pass every selected compose file');
  }
  for (const [name, content] of [['office nginx', nginx], ['desktop nginx', desktopNginx]]) {
    if (!content.includes('location /api/') || !content.includes('location /ws') || !content.includes('location = /health')) {
      failures.push(`${name} must proxy /api, /ws and /health same-origin`);
    }
  }
}

if (failures.length > 0) {
  console.error('Docker profile validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Docker profile validation passed: canonical SQLite path, network-aware Ollama URLs, Desktop override, same-origin proxies, and safe Planner V2 defaults are present.');
