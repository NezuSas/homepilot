import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

function run(body: string, timeout = 60000) {
  return spawnSync(bash, ['-c', `set -uo pipefail\n${body}`], { cwd: process.cwd(), encoding: 'utf8', timeout });
}

// A throwaway directory shaped like an extracted release bundle, with Docker replaced by a recorder.
// fail() exits like the installer's real helper, so a refused check really stops the flow.
const bundleHarness = `
  repo="$(pwd)"
  dir="$(mktemp -d)"; cd "$dir"; mkdir images
  source "$repo/scripts/lib/homepilot-prebuilt.sh"
  docker() { printf 'DOCKER:%s\\n' "$*" >> "$dir/docker.log"; return "\${DOCKER_RC:-0}"; }
  HOMEPILOT_BUILDER_NAME=test-builder
  load_count() { local n; n="$(grep -c 'DOCKER:load' docker.log 2>/dev/null || true)"; printf '%s' "\${n:-0}"; }
  section() { :; }; ok() { :; }; hp_ui_run() { shift; "$@"; }
  fail() { printf 'FAIL:%s\\n' "$1"; exit 7; }
  write_bundle() {
    printf 'archive' > images/homepilot-images.tar.gz
    sum="$(sha256sum images/homepilot-images.tar.gz | cut -d' ' -f1)"
    printf 'format=1\\nrevision=abc123def456\\nplatform=linux/amd64\\nsha256=%s\\nservice=api\\nservice=ui\\n' "$sum" > images/manifest
  }
`;

describe('release bundle with prebuilt images', () => {
  it('lists only what is needed to run and no application source (AC37)', () => {
    const result = run('bash scripts/make-release-bundle.sh --dry-run');
    expect(result.status).toBe(0);
    const files = result.stdout.split('\n');
    expect(files).toContain('scripts/homepilot-install.sh');
    expect(files).toContain('scripts/lib/homepilot-global-installer.sh');
    expect(files).toContain('docker-compose.office.yml');
    expect(files).toContain('brand.json');
    expect(files).toContain('images/homepilot-images.tar.gz');
    expect(files).toContain('images/manifest');
    const forbidden = /^(apps|packages|services|docker|infrastructure|migrations|__tests__|specs|docs|agents|node_modules)\//;
    expect(files.filter((line) => forbidden.test(line))).toEqual([]);
    expect(files).not.toContain('package.json');
    expect(result.stdout).toContain('Servicios con imagen: api ui stt tts display-bridge');
  });

  it('can leave the voice images out and rejects an unknown reference without building (AC36)', () => {
    const lean = run('bash scripts/make-release-bundle.sh --dry-run --without-voice');
    expect(lean.stdout).toContain('Servicios con imagen: api ui display-bridge');
    const unknown = run('bash scripts/make-release-bundle.sh --dry-run --ref no-such-reference-xyz');
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('no existe');
  });

  it('builds for linux/amd64 from a clean export under the homepilot project and tags the release images (AC36)', () => {
    const script = readFileSync('scripts/make-release-bundle.sh', 'utf8');
    expect(script).toContain('git archive --format=tar --prefix=homepilot/ "${ref}^{commit}" | tar -x -C "$stage/build"');
    expect(script).toContain('DOCKER_DEFAULT_PLATFORM=linux/amd64');
    expect(script).toContain('docker compose -p homepilot');
    expect(script).toContain('docker tag "homepilot-homepilot-${service}:latest" "homepilot-release-${service}:${revision}"');
    expect(script).toContain('docker save "${release_images[@]}" | gzip -n');
    expect(script).toContain('sha256=%s');
  });

  it('only enters prebuilt mode when the manifest exists and checks the archive sum (AC38)', () => {
    const result = run(`${bundleHarness}
      homepilot_prebuilt_available && echo AVAILABLE_BEFORE || echo NOT_AVAILABLE_BEFORE
      write_bundle
      homepilot_prebuilt_available && echo AVAILABLE_AFTER
      homepilot_prebuilt_verify && echo SUM_OK
      printf 'tampered' >> images/homepilot-images.tar.gz
      homepilot_prebuilt_verify && echo SUM_STILL_OK || echo SUM_REJECTED
      cd /; rm -rf "$dir"
    `);
    expect(result.stdout).toContain('NOT_AVAILABLE_BEFORE');
    expect(result.stdout).toContain('AVAILABLE_AFTER');
    expect(result.stdout).toContain('SUM_OK');
    expect(result.stdout).toContain('SUM_REJECTED');
    expect(result.stdout).not.toContain('SUM_STILL_OK');
  });

  it('names the services a bundle does not carry and loads nothing (AC38)', () => {
    const result = run(`${bundleHarness}
      write_bundle
      printf 'MISSING:%s\\n' "$(homepilot_prebuilt_missing api ui stt tts display-bridge | tr '\\n' ' ')"
      ( homepilot_prebuilt_prepare api ui stt ); printf 'RC:%s\\n' "$?"
      printf 'LOADED:%s\\n' "$(load_count)"
      cd /; rm -rf "$dir"
    `);
    expect(result.stdout).toContain('MISSING:stt tts display-bridge');
    expect(result.stdout).toContain('FAIL:Este paquete no incluye las imágenes de: stt.');
    expect(result.stdout).toContain('RC:7');
    expect(result.stdout).toContain('LOADED:0');
  });

  it('refuses a damaged archive without loading it, and loads a good one without building (AC38)', () => {
    const result = run(`${bundleHarness}
      write_bundle
      printf 'tampered' >> images/homepilot-images.tar.gz
      ( homepilot_prebuilt_prepare api ui ); printf 'DAMAGED_RC:%s\\n' "$?"
      printf 'LOADS_AFTER_DAMAGED:%s\\n' "$(load_count)"
      write_bundle
      homepilot_prebuilt_prepare api ui
      printf 'API_IMAGE:%s\\n' "$HOMEPILOT_PREBUILT_API_IMAGE"
      cat docker.log
      cd /; rm -rf "$dir"
    `);
    expect(result.stdout).toContain('FAIL:La suma de verificación de las imágenes del paquete no coincide');
    expect(result.stdout).toContain('DAMAGED_RC:7');
    expect(result.stdout).toContain('LOADS_AFTER_DAMAGED:0');
    expect(result.stdout).toContain('API_IMAGE:homepilot-release-api:abc123def456');
    expect(result.stdout).toContain('DOCKER:load -i images/homepilot-images.tar.gz');
    expect(result.stdout).not.toContain('DOCKER:compose');
  });

  it('points the project image names at the loaded release images instead of building (AC39)', () => {
    const result = run(`${bundleHarness}
      write_bundle
      homepilot_build_images -f docker-compose.office.yml -- homepilot-api homepilot-ui
      echo "RC:$?"
      cat docker.log
      : > docker.log
      HOMEPILOT_IMAGE_SERVICES=(api)
      homepilot_build_images -f docker-compose.office.yml --
      cat docker.log
      cd /; rm -rf "$dir"
    `);
    expect(result.stdout).toContain('RC:0');
    expect(result.stdout).toContain('DOCKER:tag homepilot-release-api:abc123def456 homepilot-homepilot-api:latest');
    expect(result.stdout).toContain('DOCKER:tag homepilot-release-ui:abc123def456 homepilot-homepilot-ui:latest');
    expect(result.stdout).not.toContain('DOCKER:compose');
  });

  it('fails when a release image is not loaded rather than starting the wrong image (AC39)', () => {
    const result = run(`${bundleHarness}
      write_bundle
      DOCKER_RC=1
      homepilot_build_images -- homepilot-api; echo "RC:$?"
      cd /; rm -rf "$dir"
    `);
    expect(result.stdout).toContain('RC:1');
  });

  it('keeps the normal Compose build when there is no manifest (AC40)', () => {
    const result = run(`${bundleHarness}
      homepilot_build_images -f docker-compose.office.yml -f docker-compose.tpm.yml -- homepilot-api homepilot-ui
      cat docker.log
      cd /; rm -rf "$dir"
    `);
    expect(result.stdout).toContain('DOCKER:compose -f docker-compose.office.yml -f docker-compose.tpm.yml build --builder test-builder homepilot-api homepilot-ui');
    expect(result.stdout).not.toContain('DOCKER:tag');
  });

  it('prepares the images before the camera probe and the builder in install and maintenance (AC38, AC39)', () => {
    const installer = readFileSync('scripts/install-edge-office.sh', 'utf8');
    const maintenance = readFileSync('scripts/homepilot-maintenance.sh', 'utf8');
    for (const script of [installer, maintenance]) {
      expect(script).toContain('homepilot_prebuilt_prepare');
      expect(script.indexOf('homepilot_prebuilt_prepare')).toBeLessThan(script.indexOf('homepilot_builder_ensure'));
      expect(script).toContain("build_label='Activando las imágenes de '");
    }
    const camera = readFileSync('scripts/lib/camera-acceleration.sh', 'utf8');
    expect(camera).toContain('HOMEPILOT_PREBUILT_API_IMAGE');
    expect(camera.indexOf('HOMEPILOT_PREBUILT_API_IMAGE')).toBeLessThan(camera.indexOf('docker buildx build'));
  });

  it('never puts runtime state in the bundle so an update does not overwrite it (AC41)', () => {
    const script = readFileSync('scripts/make-release-bundle.sh', 'utf8');
    const included = script.split('\n').filter((line) => line.includes('runtime_paths+=')).join('\n');
    expect(included).toContain('scripts|mosquitto|brand.json');
    expect(included).toContain('docker-compose*.yml|.env*.example');
    for (const state of ['data', 'backups', 'ha-config']) {
      expect(included).not.toMatch(new RegExp(`[|(\\s]${state}[|)\\s]`));
    }
  });
});
