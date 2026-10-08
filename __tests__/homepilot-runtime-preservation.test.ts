import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const helper = path.resolve('scripts/lib/homepilot-runtime-preservation.sh').replaceAll('\\', '/');

function run(mode: string, extra = '') {
  const directory = mkdtempSync(path.join(tmpdir(), 'homepilot-runtime-test-'));
  try {
    mkdirSync(path.join(directory, 'data'));
    mkdirSync(path.join(directory, 'backups'));
    writeFileSync(path.join(directory, 'docker-compose.tpm.yml'), 'services: {}\n');
    return spawnSync(bash, ['-c', `
      set -euo pipefail
      source '${helper}'
      unset COMPOSE_PROJECT_NAME
      tpm_enabled=false
      info() { :; }
      fail() { printf '%s\\n' "$1" >&2; exit 1; }
      homepilot_tpm_available() { [[ "$MODE" != missing-tpm ]]; }
      docker() {
        case "$1" in
          ps) [[ "$MODE" == fresh ]] || printf 'homepilot-api\\n' ;;
          inspect)
            case "$4" in
              *com.docker.compose.project*) printf 'homepilot\\n' ;;
              */app/data*)
                if [[ "$MODE" == wrong-data ]]; then printf '/other-install/data\\n';
                else printf '%s/data\\n' "$(pwd -P)"; fi ;;
              */app/backups*) printf '%s/backups\\n' "$(pwd -P)" ;;
              *HostConfig.Devices*)
                if [[ "$MODE" == mapped || "$MODE" == missing-tpm ]]; then printf 'true\\n'; fi ;;
              *State.Running*) [[ "$MODE" == stopped ]] && printf 'false\\n' || printf 'true\\n' ;;
              *) return 1 ;;
            esac ;;
          exec)
            cat >/dev/null
            [[ "$MODE" != unreadable ]] || return 1
            if [[ "$MODE" == bound ]]; then printf 'bound\\n'; else printf 'unbound\\n'; fi ;;
          *) printf 'UNEXPECTED MUTATION\\n' >&2; return 1 ;;
        esac
      }
      ${extra}
      homepilot_runtime_preflight
      printf 'tpm=%s project=%s\\n' "$tpm_enabled" "\${COMPOSE_PROJECT_NAME:-none}"
    `], { cwd: directory, encoding: 'utf8', env: { ...process.env, MODE: mode } });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

describe('Feature: Existing runtime preservation (AC31)', () => {
  test.each([
    'scripts/lib/homepilot-runtime-preservation.sh',
    'scripts/homepilot-maintenance.sh',
    'scripts/install-edge-office.sh',
    'scripts/lib/appliance-storage-report.sh'
  ])('Scenario: %s has valid Bash syntax without running deployment', file => {
    const result = spawnSync(bash, ['-n', path.resolve(file).replaceAll('\\', '/')], { encoding: 'utf8' });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
  test('Scenario: Historical mapped TPM survives without an installer version marker', () => {
    const result = run('mapped');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('tpm=true project=homepilot');
  });
  test('Scenario: Bound identity restores a missing mapping without enrollment', () => {
    const result = run('bound');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('tpm=true');
  });
  test('Scenario: Historical unbound installation does not acquire a TPM requirement', () => {
    expect(run('unbound').stdout).toContain('tpm=false project=homepilot');
  });
  test('Scenario: Fresh installation with explicit TPM capability preserves it', () => {
    const result = run('fresh', 'tpm_enabled=true');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('tpm=true project=none');
  });
  test.each(['missing-tpm', 'wrong-data', 'unreadable', 'stopped'])('Scenario: %s fails closed before any mutation', mode => {
    const result = run(mode);
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('tpm=');
    expect(result.stderr).not.toContain('UNEXPECTED MUTATION');
  });
  test('Scenario: Another Compose project cannot silently replace the existing installation', () => {
    expect(run('mapped', 'export COMPOSE_PROJECT_NAME=another').status).not.toBe(0);
  });
  test('Scenario: Windows, Git Bash, WSL and Desktop paths identify the same mount', () => {
    const result = spawnSync(bash, ['-c', `source '${helper}';
      for value in 'C:\\Users\\nezu\\data' '/c/Users/nezu/data' '/mnt/c/Users/nezu/data' '/run/desktop/mnt/host/c/Users/nezu/data'; do
        homepilot_runtime_normalize_path "$value"; printf '\\n';
      done`], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual(Array(4).fill('c:/users/nezu/data'));
  });
  test('Scenario: Both deployment entry points run preflight and include TPM outside global installer gating', () => {
    const maintenance = readFileSync('scripts/homepilot-maintenance.sh', 'utf8');
    const installer = readFileSync('scripts/install-edge-office.sh', 'utf8');
    expect(maintenance.indexOf('\n  homepilot_runtime_preflight\n')).toBeLessThan(maintenance.indexOf('\nconfigure_profile\n'));
    expect(installer.indexOf('\n  homepilot_runtime_preflight\n')).toBeLessThan(installer.indexOf('\nsection "Configuración de entorno"'));
    const overlay = installer.slice(installer.indexOf('append_global_overlays()'), installer.indexOf('if [[ -t 1 ]]'));
    expect(overlay.indexOf('docker-compose.tpm.yml')).toBeLessThan(overlay.indexOf('global_install'));
    const source = readFileSync(helper, 'utf8');
    expect(source).toContain('readonly: true, fileMustExist: true');
    expect(source).toContain("db.pragma('query_only = ON')");
    expect(source).not.toMatch(/node dist\/scripts\/enroll-edge-device|db\.exec|docker .*\b(?:rm|restart|build|up)\b/);
  });
});
