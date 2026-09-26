import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe'
  : 'bash';

function runStorageScript(body: string, usedPercent = '74'): string {
  return execFileSync(bash, ['-c', `
    set -euo pipefail
    source scripts/lib/appliance-storage-report.sh
    ok() { printf 'OK %s\\n' "$1"; }
    warn() { printf 'WARN %s\\n' "$1"; }
    info() { printf 'INFO %s\\n' "$1"; }
    section() { printf 'SECTION %s\\n' "$1"; }
    ${body}
  `], {
    cwd: process.cwd(),
    env: { ...process.env, USED_PERCENT: usedPercent },
    encoding: 'utf8',
  });
}

describe('non-destructive appliance storage report', () => {
  it.each([
    ['74', 'OK Almacenamiento normal'],
    ['75', 'WARN Almacenamiento'],
    ['84', 'WARN Almacenamiento'],
    ['85', 'WARN CRÍTICO'],
    ['100', 'WARN CRÍTICO'],
  ])('classifies %s%% without blocking maintenance', (percent, expected) => {
    const output = runStorageScript('storage_capacity_notice "$USED_PERCENT"; printf "CONTINUA\\n"', percent);
    expect(output).toContain(expected);
    expect(output).toContain('CONTINUA');
  });

  it('warns without inventing a percentage when df cannot be parsed', () => {
    expect(runStorageScript("storage_capacity_notice ''")).toContain('No se pudo determinar');
  });

  it('shows filesystem, daemon-wide reclaimable values and their ownership caveat', () => {
    const output = runStorageScript(`
      df() {
        if [[ "$1" == -h ]]; then
          printf 'Filesystem Size Used Avail Use%% Mounted on\\n/dev/test 100G 75G 25G 75%% /\\n'
        else
          printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\\n/dev/test 100 75 25 %s%% /\\n' "$USED_PERCENT"
        fi
      }
      docker() {
        [[ "$1" == system && "$2" == df ]] || return 1
        printf 'TYPE TOTAL ACTIVE SIZE RECLAIMABLE\\nImages 10 5 20GB 10GB\\nBuild Cache 100 0 14GB 13.6GB\\n'
      }
      storage_report
    `, '75');
    expect(output).toContain('SECTION Uso del filesystem de HomePilot');
    expect(output).toContain('WARN Almacenamiento');
    expect(output).toContain('SECTION Uso de Docker en todo el servidor');
    expect(output).toContain('Build Cache 100 0 14GB 13.6GB');
    expect(output).toContain('puede incluir otros proyectos');
  });

  it('keeps the helper read-only and the maintenance entrypoint free of global prune', () => {
    const scripts = [
      readFileSync('scripts/lib/appliance-storage-report.sh', 'utf8'),
      readFileSync('scripts/homepilot-maintenance.sh', 'utf8'),
    ].join('\n');
    expect(scripts).not.toMatch(/(^|\s)docker\s+(system|builder|buildx|image|volume|container|network)\s+prune\b/m);
    expect(scripts).not.toMatch(/(^|\s)docker\s+(image|volume|network)\s+rm\b/m);
  });
});
