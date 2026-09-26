import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe'
  : 'bash';

function run(script: string, mode = '') {
  return spawnSync(bash, ['-c', `
    set -euo pipefail
    source scripts/lib/homepilot-images.sh
    info() { :; }
    warn() { printf 'WARN %s\\n' "$1"; }
    fail() { printf 'FAIL %s\\n' "$1" >&2; exit 1; }
    ${script}
  `], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, MODE: mode } });
}

const scanMock = String.raw`
docker() {
  if [[ "$1 $2" == 'image ls' ]]; then
    printf '%s\n' sha256:active sha256:rollback sha256:pending sha256:old sha256:legacy sha256:foreign sha256:used sha256:probe sha256:probe-old sha256:other-tag
  elif [[ "$1 $2" == 'ps --all' ]]; then
    printf '%s\n' container-used
  elif [[ "$1 $2" == 'inspect --format' ]]; then
    printf 'sha256:used\n'
  elif [[ "$1 $2" == 'image inspect' ]]; then
    local format="$4" ref="$5"
    if [[ "$format" == '{{.Id}}' ]]; then
      case "$ref" in
        homepilot-homepilot-api:latest) printf 'sha256:active\n' ;;
        homepilot-rollback-api:latest) printf 'sha256:rollback\n' ;;
        homepilot-rollback-pending-api:latest) printf 'sha256:pending\n' ;;
        homepilot-camera-probe:local) printf 'sha256:probe\n' ;;
        *) return 1 ;;
      esac
    elif [[ "$format" == *'io.nezu.homepilot.managed'* ]]; then
      case "$ref" in
        sha256:legacy) printf '<no value>|<no value>|<no value>\n' ;;
        sha256:foreign) printf 'v1|directory|runtime\n' ;;
        sha256:probe|sha256:probe-old) printf 'v1|api|probe\n' ;;
        *) printf 'v1|api|runtime\n' ;;
      esac
    elif [[ "$format" == '{{json .RepoTags}}' ]]; then
      case "$ref" in
        sha256:other-tag) printf '["another-project:latest"]\n' ;;
        *) printf 'null\n' ;;
      esac
    elif [[ "$format" == '{{json .RepoDigests}}' ]]; then
      printf 'null\n'
    else
      return 1
    fi
  elif [[ "$1 $2" == 'image rm' ]]; then
    printf 'REMOVE %s\n' "$3"
  else
    return 1
  fi
}`;

const rotationMock = String.raw`
docker() {
  if [[ "$1" == compose ]]; then
    local service
    for service in "$@"; do :; done
    printf 'container-%s\n' "$service"
  elif [[ "$1 $2" == 'inspect --format' ]]; then
    local service
    service="$(printf '%s' "$4" | sed 's/^container-homepilot-//')"
    if [[ "$MODE" == prepare ]]; then printf 'sha256:previous-%s\n' "$service"
    else printf 'sha256:new-%s\n' "$service"; fi
  elif [[ "$1 $2" == 'image inspect' ]]; then
    local format="$4" ref="$5" service
    if [[ "$format" == '{{.Id}}' ]]; then
      case "$ref" in
        homepilot-rollback-pending-*:latest)
          [[ "$MODE" != prepare ]] || return 1
          service="$(printf '%s' "$ref" | sed 's/^homepilot-rollback-pending-//; s/:latest$//')"
          printf 'sha256:previous-%s\n' "$service" ;;
        *) return 1 ;;
      esac
    elif [[ "$format" == *'io.nezu.homepilot.managed'* ]]; then
      service="$(printf '%s' "$ref" | sed 's/^sha256:new-//')"
      if [[ "$MODE" == invalid && "$service" == ui ]]; then
        printf '<no value>|<no value>|<no value>\n'
      else
        printf 'v1|%s|runtime\n' "$service"
      fi
    else
      return 1
    fi
  elif [[ "$1 $2" == 'image tag' ]]; then
    printf 'TAG %s %s\n' "$3" "$4"
  elif [[ "$1 $2" == 'image rm' ]]; then
    printf 'UNTAG %s\n' "$3" >&2
  else
    return 1
  fi
}`;

describe('HomePilot image lifecycle without a real Docker daemon', () => {
  test('GC selects only labeled, unreferenced and unused HomePilot images', () => {
    const result = run(`${scanMock}\nhomepilot_image_gc_scan\nprintf '%s\\n' "\${HOMEPILOT_GC_CANDIDATES[@]}"`);
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual(['sha256:old', 'sha256:probe-old']);
  });

  test('GC deletes only the verified candidates, never active, rollback, pending, legacy, foreign or used images', () => {
    const result = run(`${scanMock}\nhomepilot_image_gc_scan\nhomepilot_image_gc_remove`);
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual(['REMOVE sha256:old', 'REMOVE sha256:probe-old']);
  });

  test('pre-deploy protects the currently running image without changing rollback', () => {
    const result = run(`${rotationMock}\nhomepilot_image_prepare_rollback -f docker-compose.office.yml`, 'prepare');
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual(['api', 'ui', 'stt', 'tts'].map(
      service => `TAG sha256:previous-${service} homepilot-rollback-pending-${service}:latest`,
    ));
    expect(result.stdout).not.toContain('homepilot-rollback-api:latest');
  });

  test('successful health-gated finalization promotes one previous image per service', () => {
    const result = run(`${rotationMock}\nhomepilot_image_finalize_rollback -f docker-compose.office.yml`);
    expect(result.status).toBe(0);
    for (const service of ['api', 'ui', 'stt', 'tts']) {
      expect(result.stdout).toContain(`TAG sha256:previous-${service} homepilot-rollback-${service}:latest`);
      expect(result.stderr).toContain(`UNTAG homepilot-rollback-pending-${service}:latest`);
    }
  });

  test('invalid new image fails closed before any rollback is rotated', () => {
    const result = run(`${rotationMock}\nhomepilot_image_finalize_rollback -f docker-compose.office.yml`, 'invalid');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('no tiene labels HomePilot válidos');
    expect(result.stdout).not.toContain('TAG');
    expect(result.stdout).not.toContain('UNTAG');
  });

  test('deploy paths finalize only after operational verification; GC is never automatic or global', () => {
    const maintenance = readFileSync('scripts/homepilot-maintenance.sh', 'utf8');
    const installer = readFileSync('scripts/install-edge-office.sh', 'utf8');
    const helper = readFileSync('scripts/lib/homepilot-images.sh', 'utf8');
    expect(maintenance.indexOf('verify_runtime 180')).toBeLessThan(maintenance.indexOf('homepilot_image_finalize_rollback'));
    expect(installer.indexOf('wait_for_runtime_ready')).toBeLessThan(installer.lastIndexOf('homepilot_image_finalize_rollback'));
    expect(maintenance).toContain('if [[ "$gc_homepilot" == true ]]');
    expect(maintenance).not.toMatch(/docker (?:image|builder|system|volume) prune/);
    expect(helper).not.toMatch(/docker (?:image|builder|system|volume) prune/);
  });
});
