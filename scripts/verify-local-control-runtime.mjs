import { execFileSync } from 'node:child_process';

const requiredServices = ['homepilot-api', 'homepilot-ui'];

function runCompose(args) {
  return execFileSync('docker', ['compose', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function commandOutput(error) {
  return [error.stdout, error.stderr]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .trim();
}

function fail(message) {
  console.error(`Local device-control runtime check failed: ${message}`);
  process.exit(1);
}

try {
  const runningServices = new Set(
    runCompose(['ps', '--status', 'running', '--services'])
      .split(/\r?\n/)
      .map((service) => service.trim())
      .filter(Boolean)
  );

  const missingServices = requiredServices.filter((service) => !runningServices.has(service));
  if (missingServices.length > 0) {
    fail(`required service(s) not running: ${missingServices.join(', ')}. Run "bash scripts/homepilot-maintenance.sh --deploy --yes" before committing or pushing.`);
  }

  const probe = String.raw`
const Database = (await import('better-sqlite3')).default;
const db = new Database('/app/data/homepilot.db', { readonly: true });
const profile = process.env.HOMEPILOT_INSTALLATION_PROFILE || 'ha_companion';

if (profile === 'native_only') {
  console.log('Home Assistant probe skipped for native_only installation profile.');
  process.exit(0);
}

const settings = db.prepare('SELECT base_url AS baseUrl, access_token AS accessToken FROM ha_settings LIMIT 1').get();
if (!settings || !settings.baseUrl || !settings.accessToken) {
  console.error('Home Assistant settings are incomplete.');
  process.exit(2);
}

const baseUrl = settings.baseUrl.replace(/\/$/, '');
const response = await fetch(baseUrl + '/api/', {
  headers: { Authorization: 'Bearer ' + settings.accessToken },
  signal: AbortSignal.timeout(6000)
});

if (!response.ok) {
  console.error('Home Assistant rejected the configured integration endpoint with HTTP ' + response.status + '.');
  process.exit(3);
}

console.log('Home Assistant integration reachable at ' + baseUrl + '.');
`;

  runCompose(['exec', '-T', 'homepilot-api', 'node', '-e', probe]);
  console.log('Local device-control runtime check passed.');
} catch (error) {
  const detail = commandOutput(error);
  fail(detail || (error instanceof Error ? error.message : 'Docker Compose command failed.'));
}