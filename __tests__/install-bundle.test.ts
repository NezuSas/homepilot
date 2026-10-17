import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

function run(body: string) {
  return spawnSync(bash, ['-c', `set -uo pipefail\n${body}`], { cwd: process.cwd(), encoding: 'utf8', timeout: 110000 });
}

describe('HomePilot installation bundle', () => {
  it('packs the committed code with a revision, a checksum and no git history (AC29)', () => {
    const result = run(`
      out="$(mktemp -d)"
      bash scripts/make-install-bundle.sh --ref HEAD --output "$out" >/dev/null
      echo "EXIT:$?"
      bundle="$(ls "$out"/*.tar.gz)"
      (cd "$out" && sha256sum -c ./*.sha256 | sed 's/^.*: //')
      revision="$(git rev-parse --short=12 HEAD)"
      tar -xzOf "$bundle" homepilot/REVISION | tr -d '[:space:]' | sed "s/^/REVISION:/"; echo
      [ "$(tar -xzOf "$bundle" homepilot/REVISION | tr -d '[:space:]')" = "$revision" ] && echo REVISION_MATCHES_HEAD
      printf 'INSTALLER_ENTRIES:%s\\n' "$(tar -tzf "$bundle" | grep -c '^homepilot/scripts/homepilot-install.sh$')"
      printf 'GIT_ENTRIES:%s\\n' "$(tar -tzf "$bundle" | grep -c -E '(^|/)\\.git(/|$)')"
      printf 'OUTSIDE_PREFIX:%s\\n' "$(tar -tzf "$bundle" | grep -c -v '^homepilot/')"
      rm -rf "$out"
    `);
    expect(result.stdout).toContain('EXIT:0');
    expect(result.stdout).toContain('OK');
    expect(result.stdout).toContain('REVISION_MATCHES_HEAD');
    expect(result.stdout).toContain('INSTALLER_ENTRIES:1');
    expect(result.stdout).toContain('GIT_ENTRIES:0');
    expect(result.stdout).toContain('OUTSIDE_PREFIX:0');
  });

  it('produces the same bundle for the same reference (AC29)', () => {
    const result = run(`
      a="$(mktemp -d)"; b="$(mktemp -d)"
      bash scripts/make-install-bundle.sh --ref HEAD --output "$a" >/dev/null
      bash scripts/make-install-bundle.sh --ref HEAD --output "$b" >/dev/null
      printf 'HASHES:%s\\n' "$([ "$(sha256sum "$a"/*.tar.gz | cut -d' ' -f1)" = "$(sha256sum "$b"/*.tar.gz | cut -d' ' -f1)" ] && echo equal || echo different)"
      rm -rf "$a" "$b"
    `);
    expect(result.stdout).toContain('HASHES:equal');
  });

  it('rejects an unknown reference without writing anything (AC30)', () => {
    const result = run(`
      out="$(mktemp -d)/never-created"
      bash scripts/make-install-bundle.sh --ref no-such-reference-xyz --output "$out"
      echo "EXIT:$?"
      [ -e "$out" ] && echo CREATED || echo NOT_CREATED
    `);
    expect(result.stdout).toContain('EXIT:1');
    expect(result.stdout).toContain('NOT_CREATED');
    expect(result.stderr).toContain('no existe');
  });

  it('leaves the bundle outside the repository by default and never packs uncommitted work (AC30)', () => {
    const script = readFileSync('scripts/make-install-bundle.sh', 'utf8');
    expect(script).toContain('output="$(cd .. && pwd)/homepilot-bundles"');
    expect(script).toContain('git archive --format=tar --prefix=homepilot/ "${ref}^{commit}"');
    expect(script).toContain('gzip -n');
  });

  it('takes the image revision from REVISION when there is no .git (AC31)', () => {
    const result = run(`
      lib="$(pwd)/scripts/lib/homepilot-images.sh"
      dir="$(mktemp -d)"; cd "$dir"
      source "$lib"
      unset HOMEPILOT_BUILD_REVISION
      printf 'WITHOUT_FILE:%s\\n' "$(homepilot_image_revision)"
      printf 'abc123def456\\n' > REVISION
      printf 'WITH_FILE:%s\\n' "$(homepilot_image_revision)"
      HOMEPILOT_BUILD_REVISION=forced
      printf 'EXPLICIT:%s\\n' "$(homepilot_image_revision)"
      cd /; rm -rf "$dir"
    `);
    expect(result.stdout).toContain('WITHOUT_FILE:unknown');
    expect(result.stdout).toContain('WITH_FILE:abc123def456');
    expect(result.stdout).toContain('EXPLICIT:forced');
  });
});
