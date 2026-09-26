import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe'
  : 'bash';

function runBuilder(mode: string, action = 'homepilot_builder_ensure') {
  return spawnSync(bash, ['-c', `
    set -euo pipefail
    source scripts/lib/homepilot-builder.sh
    ok() { printf 'OK %s\\n' "$1"; }
    warn() { printf 'WARN %s\\n' "$1"; }
    info() { printf 'INFO %s\\n' "$1"; }
    fail() { printf 'FAIL %s\\n' "$1" >&2; exit 1; }
    created=false
    docker() {
      if [[ "$1" == compose && "$2" == build && "$3" == --help ]]; then
        [[ "$MODE" != old_compose ]] && printf '%s\\n' 'Options: --builder builder'
        return 0
      fi
      if [[ "$1" == buildx && "$2" == version ]]; then return 0; fi
      if [[ "$1" == buildx && "$2" == create ]]; then
        [[ " $* " == *' --name homepilot-builder '* && " $* " == *' --driver docker-container '* && " $* " == *' --driver-opt default-load=true '* && " $* " == *' --buildkitd-config '* ]] || return 1
        created=true
        return 0
      fi
      if [[ "$1" == exec && "$2" == buildx_buildkit_homepilot-builder0 ]]; then
        if [[ "$MODE" == old_gc ]]; then printf '%s\\n' '[worker.oci]'; else cat "$HOMEPILOT_BUILDKIT_CONFIG"; fi
        return 0
      fi
      if [[ "$1" == buildx && "$2" == inspect ]]; then
        if [[ "$MODE" == missing && "$created" == false ]]; then return 1; fi
        if [[ "$MODE" == wrong_driver ]]; then
          printf 'Name: homepilot-builder\\nDriver: docker\\nStatus: running\\n'
        elif [[ "$MODE" == no_load ]]; then
          printf 'Name: homepilot-builder\\nDriver: docker-container\\nStatus: running\\n'
        elif [[ "$MODE" == stopped ]]; then
          printf 'Name: homepilot-builder\\nDriver: docker-container\\nDriver Options: default-load="true"\\nStatus: stopped\\n'
        else
          printf 'Name: homepilot-builder\\nDriver: docker-container\\nDriver Options: default-load="true"\\nStatus: running\\n'
        fi
        return 0
      fi
      if [[ "$1" == buildx && "$2" == du ]]; then
        [[ "$MODE" != stopped ]] || return 2
        if [[ "$MODE" == cache_large ]]; then
          printf 'Shared: 1GB\\nPrivate: 11GB\\nReclaimable: 12GB\\nTotal: 12GB\\n'
        else
          printf 'Shared: 1GB\\nPrivate: 2GB\\nReclaimable: 2GB\\nTotal: 3GB\\n'
        fi
        return 0
      fi
      return 1
    }
    ${action}
    printf 'CREATED=%s\\n' "$created"
  `], {
    cwd: process.cwd(),
    env: { ...process.env, MODE: mode },
    encoding: 'utf8',
  });
}

describe('dedicated HomePilot builder', () => {
  it('creates a missing isolated builder with local image loading', () => {
    const result = runBuilder('missing');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CREATED=true');
    expect(result.stdout).toContain('Builder dedicado homepilot-builder listo');
  });

  it('reuses a compatible builder without creating another', () => {
    const result = runBuilder('existing');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CREATED=false');
    expect(result.stdout).toContain('Se reutiliza');
  });

  it.each(['wrong_driver', 'no_load', 'old_compose', 'old_gc'])('fails closed for %s', (mode) => {
    const result = runBuilder(mode);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('FAIL');
    expect(result.stdout).not.toContain('CREATED=true');
  });

  it('does not recreate or delete an existing builder with an old GC policy', () => {
    const result = runBuilder('old_gc');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('No se modifica ni se reconstruye automáticamente');
    expect(result.stdout).toContain('Se reutiliza');
  });

  it('reports isolated cache without claiming all bytes can be freed', () => {
    const result = runBuilder('existing', 'homepilot_builder_report');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Driver: docker-container');
    expect(result.stdout).toContain('Reclaimable: 2GB');
    expect(result.stdout).toContain('Política GC de HomePilot verificada');
    expect(result.stdout).toContain('buildx_buildkit_homepilot-builder0_state');
    expect(result.stdout).toContain('no espacio íntegramente liberable');
    expect(result.stdout).toContain('CREATED=false');
  });

  it('does not bootstrap a stopped builder just to report status', () => {
    const result = runBuilder('stopped', 'homepilot_builder_report');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('caché no verificables');
    expect(result.stdout).toContain('CREATED=false');
  });

  it('warns when builder cache exceeds the configured maximum', () => {
    const result = runBuilder('cache_large', 'homepilot_builder_report');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('supera 11GB');
  });

  it('configures ordered GC policies without pruning images or volumes', () => {
    const config = readFileSync('docker/buildkit/homepilot-buildkitd.toml', 'utf8');
    expect(config).toMatch(/\[worker\.oci\]\s+gc = true/);
    expect(config.match(/\[\[worker\.oci\.gcpolicy\]\]/g)).toHaveLength(4);
    expect(config).toContain('reservedSpace = "8GB"');
    expect(config).toContain('maxUsedSpace = "11GB"');
    expect(config).toContain('minFreeSpace = "25GB"');
    expect(config).toContain('keepDuration = "720h"');
  });

  it('routes Compose and the camera probe explicitly and contains no prune path', () => {
    const maintenance = readFileSync('scripts/homepilot-maintenance.sh', 'utf8');
    const installer = readFileSync('scripts/install-edge-office.sh', 'utf8');
    const camera = readFileSync('scripts/lib/camera-acceleration.sh', 'utf8');
    const builder = readFileSync('scripts/lib/homepilot-builder.sh', 'utf8');
    for (const script of [maintenance, installer]) {
      expect(script).toContain('build --builder "$HOMEPILOT_BUILDER_NAME"');
      expect(script).toMatch(/up (?:-d --no-build|--no-build -d)/);
      expect(script).toContain('homepilot_builder_ensure');
    }
    expect(camera).toContain('docker buildx build --builder "${HOMEPILOT_BUILDER_NAME:?}" --load');
    expect([maintenance, installer, camera, builder].join('\n'))
      .not.toMatch(/(^|\s)docker\s+(system|builder|buildx|image|volume|container|network)\s+prune\b/m);
  });
});
