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
        # BuildKit's canonicalized TOML is not byte-identical to the source.
        printf '%s\\n' '[worker]' '[worker.oci]' '  gc = true' '  [[worker.oci.gcpolicy]]' '    maxUsedSpace = "1GiB"'
        return 0
      fi
      if [[ "$1" == buildx && "$2" == inspect ]]; then
        if [[ "$MODE" == missing && "$created" == false ]]; then return 1; fi
        if [[ "$MODE" == real_file_section ]]; then
          cat __tests__/fixtures/homepilot-buildx-inspect-v0.32.2.txt
          return 0
        fi
        if [[ "$MODE" == wrong_driver ]]; then
          printf 'Name: homepilot-builder\\nDriver: docker\\nStatus: running\\n'
        elif [[ "$MODE" == no_load ]]; then
          printf 'Name: homepilot-builder\\nDriver: docker-container\\nStatus: running\\n'
        elif [[ "$MODE" == stopped ]]; then
          printf 'Name: homepilot-builder\\nDriver: docker-container\\nDriver Options: default-load="true"\\nStatus: stopped\\n'
        else
          printf 'Name: homepilot-builder\\nDriver: docker-container\\nDriver Options: default-load="true"\\nStatus: running\\n'
        fi
        if [[ "$MODE" != stopped && "$MODE" != missing_gc ]]; then
          local filter_line
          case "$MODE" in
            real_filters) filter_line=' Filters: type==source.local type==exec.cachemount type==source.git.checkout' ;;
            bad_filter) filter_line=' Filters: type==source.local type==exec.cachemount type==source.http' ;;
            fourth_filter) filter_line=' Filters: type==source.local type==exec.cachemount type==source.git.checkout type==source.http' ;;
            duplicate_filter) filter_line=' Filters: type==source.local type==exec.cachemount type==exec.cachemount' ;;
            *) filter_line=' Filters: type==source.local,type==exec.cachemount,type==source.git.checkout' ;;
          esac
          local final_min_free=' Min Free Space: 25GiB'
          [[ "$MODE" != incomplete_before_file ]] || final_min_free=''
          printf '%s\\n' \
            'GC Policy rule#0:' \
            ' All: false' \
            "$filter_line" \
            ' Keep Duration: 48h0m0s' \
            ' Max Used Space: 1GiB' \
            'GC Policy rule#1:' \
            ' All: false' \
            ' Keep Duration: 720h0m0s' \
            ' Reserved Space: 8GiB' \
            " Max Used Space: $([[ \"$MODE\" == old_gc ]] && printf '12GiB' || printf '11GiB')" \
            ' Min Free Space: 25GiB' \
            'GC Policy rule#2:' \
            ' All: false' \
            ' Reserved Space: 8GiB' \
            ' Max Used Space: 11GiB' \
            ' Min Free Space: 25GiB' \
            'GC Policy rule#3:' \
            " All: $([[ \"$MODE\" == bad_all ]] && printf 'false' || printf 'true')" \
            ' Reserved Space: 8GiB' \
            ' Max Used Space: 11GiB' \
            "$final_min_free"
          if [[ "$MODE" == extra_rule_field ]]; then printf '%s\\n' ' Unexpected GC: value'; fi
          if [[ "$MODE" == incomplete_before_file || "$MODE" == extra_rule_field ]]; then
            printf '%s\\n' 'File#buildkitd.toml:' '[worker]' '  [worker.oci]' '    gc = true' ' Min Free Space: 25GiB'
          fi
        fi
        return 0
      fi
      if [[ "$1" == buildx && "$2" == du ]]; then
        [[ "$MODE" != stopped ]] || return 2
        if [[ "$MODE" == cache_large ]]; then
          printf 'Shared: 1GB\\nPrivate: 11GB\\nReclaimable: 12GB\\nTotal: 12GB\\n'
        elif [[ "$MODE" == cache_under_binary ]]; then
          printf 'Shared: 1GB\\nPrivate: 10.5GB\\nReclaimable: 11.5GB\\nTotal: 11.5GB\\n'
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

  it('accepts the effective policy despite BuildKit canonicalizing its TOML', () => {
    const result = runBuilder('existing');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Builder dedicado homepilot-builder listo');
  });

  it('accepts the literal space-separated filters from Buildx v0.32.2 on the MiniPC', () => {
    const result = runBuilder('real_filters');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Builder dedicado homepilot-builder listo');
    const status = runBuilder('real_filters', 'homepilot_builder_report');
    expect(status.status).toBe(0);
    expect(status.stdout).toContain('Política GC de HomePilot verificada');
    expect(status.stdout).not.toContain('política GC anterior o no verificable');
  });

  it('accepts the comma-separated filters documented by Buildx', () => {
    const result = runBuilder('existing');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Builder dedicado homepilot-builder listo');
  });

  it('accepts the MiniPC inspect section followed by canonicalized buildkitd.toml', () => {
    const fixture = readFileSync('__tests__/fixtures/homepilot-buildx-inspect-v0.32.2.txt', 'utf8');
    expect(fixture).toContain('Filters:        type==source.local type==exec.cachemount type==source.git.checkout');
    expect(fixture).toContain('File#buildkitd.toml:');
    const result = runBuilder('real_file_section');
    expect(result.status).toBe(0);
    const status = runBuilder('real_file_section', 'homepilot_builder_report');
    expect(status.status).toBe(0);
    expect(status.stdout).toContain('Política GC de HomePilot verificada');
  });

  it.each(['wrong_driver', 'no_load', 'old_compose', 'old_gc', 'missing_gc', 'bad_filter', 'fourth_filter', 'duplicate_filter', 'bad_all', 'incomplete_before_file', 'extra_rule_field'])('fails closed for %s', (mode) => {
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
    expect(result.stdout).toContain('supera 11GiB');
  });

  it('compares Docker decimal cache totals against the effective binary 11 GiB limit', () => {
    const result = runBuilder('cache_under_binary', 'homepilot_builder_report');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Total: 11.5GB');
    expect(result.stdout).not.toContain('supera 11GiB');
  });

  it('configures ordered GC policies without pruning images or volumes', () => {
    const config = readFileSync('docker/buildkit/homepilot-buildkitd.toml', 'utf8');
    expect(config).toMatch(/\[worker\.oci\]\s+gc = true/);
    expect(config.match(/\[\[worker\.oci\.gcpolicy\]\]/g)).toHaveLength(4);
    expect(config).toContain('reservedSpace = "8GiB"');
    expect(config).toContain('maxUsedSpace = "11GiB"');
    expect(config).toContain('minFreeSpace = "25GiB"');
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
