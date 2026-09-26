import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe'
  : 'bash';

interface ServiceConfig {
  network_mode?: string;
  extra_hosts?: string[];
  environment?: Record<string, string> | string[];
  healthcheck?: { test: string[] };
}

function services(file: string): Record<string, ServiceConfig> {
  return (parse(readFileSync(file, 'utf8')) as { services: Record<string, ServiceConfig> }).services;
}

function environmentValue(service: ServiceConfig, key: string): string | undefined {
  const environment = service.environment;
  if (!environment) return undefined;
  if (Array.isArray(environment)) {
    return environment.find(entry => entry.startsWith(`${key}=`))?.slice(key.length + 1);
  }
  return environment[key];
}

describe('Linux appliance API bind and same-origin UI access', () => {
  test.each(['docker-compose.office.yml', 'docker-compose.yml'])(
    '%s binds the host-network API to Docker gateway and checks that address',
    file => {
      const profile = services(file);
      const api = profile['homepilot-api'];
      const ui = profile['homepilot-ui'];
      expect(api.network_mode).toBe('host');
      expect(environmentValue(api, 'HOMEPILOT_API_BIND_HOST')).toBe('${HOMEPILOT_API_BIND_HOST:-host.docker.internal}');
      expect(api.extra_hosts).toContain('host.docker.internal:host-gateway');
      expect(ui.extra_hosts).toContain('host.docker.internal:host-gateway');
      expect(api.healthcheck?.test[0]).toBe('CMD-SHELL');
      expect(api.healthcheck?.test[1]).toContain('$${HOMEPILOT_API_BIND_HOST:-0.0.0.0}');
      expect(api.healthcheck?.test[1]).not.toContain('localhost:3000');
    },
  );

  test('Nginx still proxies API, WebSocket, media and health through the host gateway', () => {
    const nginx = readFileSync('docker/ui/nginx.conf', 'utf8');
    for (const location of ['location /api/', 'location /ws', 'location /media/', 'location = /health']) {
      expect(nginx).toContain(location);
    }
    expect(nginx.match(/proxy_pass http:\/\/host\.docker\.internal:3000/g)?.length).toBeGreaterThanOrEqual(4);
  });

  test('Desktop overlays retain a wildcard bind for service-name routing', () => {
    for (const file of ['docker-compose.desktop.yml', 'docker-compose.ha-companion.desktop.yml']) {
      expect(readFileSync(file, 'utf8')).toContain('HOMEPILOT_API_BIND_HOST: 0.0.0.0');
    }
    expect(readFileSync('docker/ui/nginx.desktop.conf', 'utf8')).toContain('proxy_pass http://homepilot-api:3000');
  });

  test('maintenance and installer probe API inside its container, not host loopback', () => {
    const helper = readFileSync('scripts/lib/api-health.sh', 'utf8');
    expect(helper).toContain('docker exec homepilot-api sh -c');
    expect(helper).toContain('HOMEPILOT_API_BIND_HOST');
    expect(helper).toContain('curl --silent --output /dev/null --write-out');
    for (const file of ['scripts/homepilot-maintenance.sh', 'scripts/install-edge-office.sh']) {
      const script = readFileSync(file, 'utf8');
      expect(script).toContain('homepilot_api_health_status');
      expect(script).not.toMatch(/http:\/\/127\.0\.0\.1:\$\{api_port\}\/health/);
    }
  });

  test.each([
    ['host.docker.internal', 'http://host.docker.internal:3000/health'],
    ['0.0.0.0', 'http://127.0.0.1:3000/health'],
  ])('health helper checks the effective bind %s inside the API container', (bindHost, expectedUrl) => {
    const mockedDocker = String.raw`
      set -euo pipefail
      source scripts/lib/api-health.sh
      docker() {
        [[ "$1" == exec && "$2" == homepilot-api && "$3" == sh && "$4" == -c ]] || return 1
        local command="$5"
        HOMEPILOT_API_BIND_HOST="$TEST_BIND" PORT=3000 sh -c "curl() { for arg do last=\"\$arg\"; done; printf '%s' \"\$last\"; }; $command"
      }
      homepilot_api_health_status
    `;
    const result = spawnSync(bash, ['-c', mockedDocker], {
      cwd: process.cwd(),
      env: { ...process.env, TEST_BIND: bindHost },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(expectedUrl);
  });
});
