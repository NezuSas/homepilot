import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

function runShell(body: string, input = '') {
  return spawnSync(bash, ['-c', `set -euo pipefail
    source scripts/lib/homepilot-global-installer.sh
    hp_color_init
    ${body}`], { cwd: process.cwd(), input, encoding: 'utf8', env: { ...process.env, TERM: 'dumb' } });
}

const simulatedSystem = `
  hp_existing_installation() { return 1; }
  hp_preflight() { printf 'PREFLIGHT_OK\\n'; }
  hp_detect_environment() { printf 'DETECT_OK\\n'; }
  hp_check_ports() { printf 'PORTS_OK:%s:%s:%s\\n' "$hp_profile" "$hp_mqtt" "$hp_voice"; }
  hp_install_base() { printf 'BASE_OK\\n'; }
  hp_install_docker() { printf 'DOCKER_OK\\n'; }
  hp_verify_tpm() { printf 'TPM_OK\\n'; }
  hp_prepare_mqtt() { printf 'MQTT_PREPARE:%s\\n' "$hp_mqtt"; }
  hp_deploy() { printf 'DEPLOY:%s:%s:%s:%s:%s\\nCHAT:%s\\n' "$hp_profile" "$hp_cameras" "$hp_android" "$hp_mqtt" "$hp_voice" "$hp_chat"; }
  hp_configure_cloudflared() { printf 'TUNNEL:%s\\n' "$hp_remote"; }
  hp_pair_directory() { printf 'PAIR:%s\\n' "$hp_remote"; }
  hp_bind_identity() { printf 'BIND:%s\\n' "$hp_remote"; }
  hp_finish() { printf 'FINISHED\\n'; }
  android_display_validate_cidrs() { return 0; }
  hp_main
`;

const diagnosticSystem = `
  hp_saved_value() {
    case "$1" in
      HOMEPILOT_INSTALLATION_PROFILE) printf bridge_ha ;;
      HOMEPILOT_ANDROID_DISPLAY_ENABLED) printf false ;;
      HOMEPILOT_VOICE_ENABLED) printf true ;;
      HOMEPILOT_MQTT_ENABLED) printf false ;;
      HOMEPILOT_GLOBAL_INSTALLER_VERSION) printf v1 ;;
      *) printf '%s' "$2" ;;
    esac
  }
  hp_diag_api_status() { printf 200; }
  hp_diag_http_status() { printf 200; }
  hp_diag_ha_status() { printf 200; }
  hp_diag_cloudflared_state() { printf active; }
  hp_diag_binding_status() { printf bound; }
  hp_tpm_device_available() { return 0; }
  hp_is_paired() { return 0; }
  hp_diag_container_state() { printf running; }
`;

describe('HomePilot global installation wizard without system operations', () => {
  it('prepares missing host dependencies and verifies them before enabling SSH', () => {
    const result = runShell(`
      dpkg-query() { [[ "$*" != *python3* && "$*" != *openssl* && "$*" != *git* ]] && printf 'install ok installed'; }
      apt-get() { printf 'APT:%s\\n' "$*"; }
      python3() { printf 'PYTHON_VERIFIED\\n'; }
      openssl() { return 0; }
      systemctl() { printf 'SSH:%s\\n' "$*" >&2; }
      command() { [[ "$1" != -v ]] || return 0; builtin command "$@"; }
      hp_install_base
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('APT:install -y --no-install-recommends git python3 openssl');
    expect(result.stdout).toContain('PYTHON_VERIFIED');
    expect(result.stderr).toContain('SSH:enable --now ssh');
  });

  it('reuses installed packages without apt and rejects a missing executable', () => {
    const result = runShell(`
      dpkg-query() { printf 'install ok installed'; }
      apt-get() { printf 'UNEXPECTED_APT\\n'; return 99; }
      systemctl() { printf 'UNEXPECTED_SERVICE\\n'; return 99; }
      command() { [[ "$*" != '-v openssl' ]]; }
      hp_install_base
    `);
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('UNEXPECTED_APT');
    expect(result.stdout).not.toContain('UNEXPECTED_SERVICE');
    expect(result.stdout + result.stderr).toContain('openssl');
  });

  it('does not reinstall packages when all base dependencies are already present', () => {
    const result = runShell(`
      dpkg-query() { printf 'install ok installed'; }
      apt-get() { printf 'UNEXPECTED_APT\\n'; return 99; }
      command() { return 0; }
      python3() { return 0; }
      openssl() { return 0; }
      systemctl() { return 0; }
      hp_install_base
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('UNEXPECTED_APT');
  });

  it('validates client names under the Linux CI C.UTF-8 locale without collating ranges', () => {
    const result = runShell(`
      export LC_ALL=C.UTF-8
      for name in 'Cliente Prueba' 'Casa Prueba' 'José Muñoz' 'Instalación NEZU'; do
        hp_valid_name "$name"
      done
      for name in '' '../Casa' 'Casa/Prueba' 'Casa;exit' ' Casa'; do
        if hp_valid_name "$name"; then exit 1; fi
      done
      printf 'NAMES_VALIDATED\\n'
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('NAMES_VALIDATED');
  });

  it('shows one branded diagnostic summary without legacy banners or technical inventories by default', () => {
    const result = runShell(`${diagnosticSystem}
      bash() { printf 'UNEXPECTED_DOCKER_PS\\n'; }
      hp_banner
      hp_global_diagnostic
    `, '1\nn\n');
    expect(result.status).toBe(0);
    expect(result.stdout.match(/Bienvenido a/g)).toHaveLength(1);
    expect(result.stdout).toContain('ESTADO / DIAGNÓSTICO');
    expect(result.stdout).toContain('HomePilot API');
    expect(result.stdout).toContain('Saludable');
    expect(result.stdout).toContain('Home Assistant');
    expect(result.stdout).toContain('Disponible');
    expect(result.stdout).toContain('Directory Edge');
    expect(result.stdout).toContain('TPM 2.0');
    expect(result.stdout).toContain('Android Display');
    expect(result.stdout).toContain('No configurado');
    expect(result.stdout).toContain('Comprobaciones realizadas sin fallos');
    expect(result.stdout).not.toContain('Instalador técnico');
    expect(result.stdout).not.toContain('UNEXPECTED_DOCKER_PS');
    expect(result.stdout).not.toContain('Docker containers');
    expect(result.stdout).not.toMatch(/\x1b\[/);
  });

  it('reports configured Android and MQTT modules, and opens embedded technical detail only on request', () => {
    const result = runShell(`${diagnosticSystem}
      hp_saved_value() {
        case "$1" in
          HOMEPILOT_ANDROID_DISPLAY_ENABLED|HOMEPILOT_MQTT_ENABLED) printf true ;;
          HOMEPILOT_INSTALLATION_PROFILE) printf bridge_ha ;;
          HOMEPILOT_VOICE_ENABLED) printf true ;;
          HOMEPILOT_GLOBAL_INSTALLER_VERSION) printf v1 ;;
          *) printf '%s' "$2" ;;
        esac
      }
      bash() { printf 'TECHNICAL:%s:embedded=%s\\n' "$*" "$HOMEPILOT_INSTALLER_EMBEDDED"; }
      hp_banner
      hp_global_diagnostic
    `, '1\ns\n');
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Android Display\s+En ejecución/);
    expect(result.stdout).toMatch(/MQTT\s+En ejecución/);
    expect(result.stdout).toContain('TECHNICAL:scripts/check-edge-install.sh:embedded=1');
    expect(result.stdout.match(/Bienvenido a/g)).toHaveLength(1);
  });

  it('uses container-aware API health in the detailed checker, never the obsolete host port 3000', () => {
    const result = runShell(`
      HOMEPILOT_INSTALLER_EMBEDDED=1
      docker() {
        case "$1" in
          exec) printf 200 ;;
          ps) printf 'CONTAINER_TABLE\\n' ;;
          compose) return 0 ;;
        esac
      }
      curl() { [[ "$*" != *'127.0.0.1:3000'* ]]; }
      source scripts/check-edge-install.sh
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('HomePilot API: container HTTP 200');
    expect(result.stdout).toContain('CONTAINER_TABLE');
    expect(result.stdout).not.toContain('127.0.0.1:3000');
    expect(result.stdout).not.toContain('HomePilot Edge install check');
  });

  it.each([
    ['existing Home Assistant', '1\nn\nn\nn\nn\ns\ns\nn\ns\n', 'bridge_ha'],
    ['managed Home Assistant', '2\nn\nn\nn\ns\ns\nn\ns\n', 'ha_companion'],
    ['no Home Assistant', '3\nn\nn\nn\ns\ns\nn\ns\n', 'native_only'],
  ])('maps %s to its existing installation profile', (_label, architectureInput, profile) => {
    const input = `Cliente Prueba\nCasa Prueba\nhomepilot-test\nn\n${architectureInput}`;
    const result = runShell(simulatedSystem, input);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`DEPLOY:${profile}:false:false:false:true`);
    expect(result.stdout).toContain('TPM_OK');
    expect(result.stdout).toContain('FINISHED');
    expect(result.stdout).toContain('Bienvenido a');
    expect(result.stdout).toContain('H O M E P I L O T');
    expect(result.stdout).toContain('COMPROBACIÓN INICIAL');
    expect(result.stdout).toContain('REVISAR CONFIGURACIÓN');
    expect(result.stdout).not.toMatch(/\x1b\[/);
  });

  it('keeps "Conversar con mi casa" on by default and asks about voice only when it is on', () => {
    const input = 'Cliente Prueba\nCasa Prueba\nhomepilot-test\nn\n3\nn\nn\nn\ns\ns\nn\ns\n';
    const result = runShell(simulatedSystem, input);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CHAT:true');
    expect(result.stdout).toContain('DEPLOY:native_only:false:false:false:true');
    expect(result.stdout).toContain('Conversar con mi casa');
  });

  it('turns voice off and skips its question when the installer leaves "Conversar con mi casa" out', () => {
    const input = 'Cliente Prueba\nCasa Prueba\nhomepilot-test\nn\n3\nn\nn\nn\nn\nn\ns\n';
    const result = runShell(simulatedSystem, input);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CHAT:false');
    expect(result.stdout).toContain('DEPLOY:native_only:false:false:false:false');
    expect(result.stdout).not.toContain('¿Habilitar voz local HomePilot');
  });

  it('centers the same branded text at 80, 100 and 120 columns', () => {
    const result = runShell(`
      HP_UI_TTY=true
      for width in 80 100 120; do
        tput() { [[ "$1" == cols ]] && printf '%s' "$width"; }
        hp_ui_center '' 'H O M E P I L O T'
      done
    `);
    expect(result.status).toBe(0);
    const lines = result.stdout.trimEnd().split('\n');
    const label = 'H O M E P I L O T';
    expect(lines.map((line) => line.indexOf(label))).toEqual(
      [80, 100, 120].map((columns) => Math.floor((columns - label.length) / 2)),
    );
  });

  it('keeps a secret hidden while showing an input in the central block', () => {
    const result = runShell(`
      hp_secret 'Cloudflare Tunnel Token'
      printf 'SECRET_LENGTH:%s\\n' "\${#REPLY}"
    `, 'private-token-value\n');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Cloudflare Tunnel Token');
    expect(result.stdout).toContain('❯ ••••••••');
    expect(result.stdout).toContain('SECRET_LENGTH:19');
    expect(result.stdout + result.stderr).not.toContain('private-token-value');
    expect(result.stdout).not.toMatch(/\x1b\[/);
  });

  it('selects native cameras, Android, MQTT and disables voice without probing unselected services', () => {
    const input = 'Cliente Prueba\nCasa Prueba\nhomepilot-test\nn\n3\ns\ns\n192.168.1.0/24\ns\n192.168.1.10\nhomeassistant\ns\nn\nn\ns\n';
    const result = runShell(simulatedSystem, input);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('DEPLOY:native_only:true:true:true:false');
    expect(result.stdout).toContain('MQTT_PREPARE:true');
    expect(result.stdout).toContain('TUNNEL:false');
    expect(result.stdout).toContain('docker-compose.android-display.yml');
    expect(result.stdout).not.toContain('Cloudflare Tunnel Token');
  });

  it('passes modular choices to the historical installer instead of starting a parallel deployment', () => {
    const result = runShell(`
      hp_profile=bridge_ha hp_cameras=false hp_android=false hp_mqtt=false hp_chat=false hp_voice=false
      hp_client='Cliente Prueba' hp_installation='Casa Prueba' hp_community=false
      bash() { printf 'DELEGATE:%s\\nCHAT:%s CAMERA:%s VOICE:%s MQTT:%s TPM:%s REV:%s\\n' "$*" "$HOMEPILOT_INSTALL_CHAT_ENABLED" "$HOMEPILOT_INSTALL_CAMERA_ENABLED" "$HOMEPILOT_INSTALL_VOICE_ENABLED" "$HOMEPILOT_INSTALL_MQTT_ENABLED" "$HOMEPILOT_INSTALL_TPM_ENABLED" "$HOMEPILOT_BUILD_REVISION"; }
      hp_deploy
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('DELEGATE:scripts/install-edge-office.sh --profile bridge_ha --start --yes');
    expect(result.stdout).toContain('CHAT:false CAMERA:false VOICE:false MQTT:false TPM:true REV:installer-v1');
  });

  it('fails a new production installation when the TPM device is absent', () => {
    const result = runShell('hp_tpm_device_available() { return 1; }; hp_verify_tpm');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('TPM 2.0 no disponible');
  });

  it('accepts only a specific private LAN address for MQTT, never a wildcard bind', () => {
    const valid = runShell("hp_valid_lan_ip 192.168.1.10 && hp_valid_lan_ip 10.0.0.5");
    const wildcard = runShell('hp_valid_lan_ip 0.0.0.0');
    const publicIp = runShell('hp_valid_lan_ip 8.8.8.8');
    expect(valid.status).toBe(0);
    expect(wildcard.status).not.toBe(0);
    expect(publicIp.status).not.toBe(0);
  });

  it('continues when TPM 2.0 responds to getcap and getrandom', () => {
    const result = runShell(`
      hp_tpm_device_available() { return 0; }
      tpm2_getcap() { return 0; }
      tpm2_getrandom() { return 0; }
      hp_verify_tpm
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('TPM 2.0 funcional');
  });

  it('reuses an existing active cloudflared service without asking for or echoing a token', () => {
    const result = runShell(`
        test_dir="$(mktemp -d -t homepilot-cloudflared-test.XXXXXX)"
        trap 'rm -f "$test_dir/cloudflared.service.d/homepilot-restart.conf"; rmdir "$test_dir/cloudflared.service.d" "$test_dir"' EXIT
        hp_remote=true
        hp_systemd_service_directory() { printf '%s' "$test_dir"; }
        hp_install_cloudflared_binary() { printf 'BINARY_REUSED\\n'; }
        systemctl() { case "$1" in is-active|cat|enable|daemon-reload) return 0 ;; esac; }
        cloudflared() { printf 'UNEXPECTED_INSTALL\\n'; return 1; }
        hp_configure_cloudflared
      `);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('BINARY_REUSED');
    expect(result.stdout).not.toContain('UNEXPECTED_INSTALL');
    expect(result.stdout).not.toContain('Tunnel Token');
  });

  it('installs cloudflared using hidden input and fails if systemd cannot activate it', () => {
    const script = `
        test_dir="$(mktemp -d -t homepilot-cloudflared-test.XXXXXX)"
        trap 'rm -f "$test_dir/cloudflared.service.d/homepilot-restart.conf"; rmdir "$test_dir/cloudflared.service.d" "$test_dir"' EXIT
        hp_remote=true active=0 install_called=0
        hp_systemd_service_directory() { printf '%s' "$test_dir"; }
        hp_install_cloudflared_binary() { printf 'BINARY_INSTALLED\\n'; }
        systemctl() { case "$1" in is-active) [[ "$active" == 1 ]] ;; cat) return 1 ;; enable) [[ \${FAIL_SERVICE:-0} == 0 ]] || return 1; active=1 ;; daemon-reload) return 0 ;; esac; }
        cloudflared() { [[ "$1 $2" == 'service install' ]] || return 1; install_called=1; }
        hp_configure_cloudflared
        printf 'INSTALL_CALLED:%s\\n' "$install_called"
      `;
    const good = runShell(script, 'secret-tunnel-token\n');
    expect(good.status).toBe(0);
    expect(good.stdout).toContain('INSTALL_CALLED:1');
    expect(good.stdout + good.stderr).not.toContain('secret-tunnel-token');
    const failed = runShell(`FAIL_SERVICE=1\n${script}`, 'another-secret-token\n');
    expect(failed.status).not.toBe(0);
    expect(failed.stderr).toContain('cloudflared no inició');
    expect(failed.stdout + failed.stderr).not.toContain('another-secret-token');
  });

  it('never re-enrolls a bound installation and enrolls an unbound one exactly once', () => {
    const bound = runShell(`
      hp_remote=true
      hp_is_paired() { return 0; }
      docker() { [[ "$*" != *'enroll-edge-device.js' ]] || printf 'UNEXPECTED_ENROLL\\n' >&2; return 0; }
      hp_binding_status() { printf 'bound\\n'; }
      homepilot_api_health_status() { printf '200\\n'; }
      hp_bind_identity
    `);
    expect(bound.status).toBe(0);
    expect(bound.stderr).not.toContain('UNEXPECTED_ENROLL');
    expect(bound.stdout).toContain('no se repite enrollment');

    const fresh = runShell(`
      hp_remote=true state=unbound enrollments=0
      hp_is_paired() { return 0; }
      docker() {
        if [[ "$*" == *'enroll-edge-device.js' ]]; then state=bound; enrollments=$((enrollments+1)); fi
        return 0
      }
      hp_binding_status() { printf '%s\\n' "$state"; }
      homepilot_api_health_status() { printf '200\\n'; }
      tpm2_getcap() { [[ "$state" != bound ]] || printf '0x81010090\\n'; }
      hp_bind_identity
      printf 'ENROLLMENTS:%s\\n' "$enrollments"
    `);
    expect(fresh.status).toBe(0);
    expect(fresh.stdout).toContain('ENROLLMENTS:1');
  });

  it('passes the temporary Directory pairing code on stdin without printing it', () => {
    const result = runShell(`
      test_dir="$(mktemp -d -t homepilot-pairing-test.XXXXXX)"
      trap 'rm -f "$test_dir/paired"; rmdir "$test_dir"' EXIT
      hp_remote=true hp_edge_hostname=https://homepilot-casa.nezuecuador.com
      hp_secret() { REPLY='temporary-pairing-code'; }
      hp_is_paired() { [[ -f "$test_dir/paired" ]]; }
      docker() {
        [[ "$*" == *'--code-stdin https://homepilot-casa.nezuecuador.com'* ]] || return 1
        local code
        code="$(cat)"
        [[ "$code" == 'temporary-pairing-code' ]] || return 1
        touch "$test_dir/paired"
      }
      hp_pair_directory
      [[ "$hp_pairing_changed" == true ]]
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Directory Edge emparejado');
    expect(result.stdout + result.stderr).not.toContain('temporary-pairing-code');
  });

  it('does not apply global completion steps to a historical installation', () => {
    const result = runShell(`
      hp_saved_value() { printf ''; }
      hp_deploy() { printf 'UNEXPECTED_DEPLOY\\n'; return 1; }
      hp_admin_operation complete
    `);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Instalación histórica');
    expect(result.stdout).not.toContain('UNEXPECTED_DEPLOY');
  });

  it('offers safe choices on a second run without deploying or changing configuration', () => {
    const result = runShell(`
      hp_existing_installation() { return 0; }
      hp_deploy() { printf 'UNEXPECTED_DEPLOY\\n'; return 1; }
      hp_main
    `, '0\n');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ADMINISTRACIÓN DE LA INSTALACIÓN');
    expect(result.stdout).toContain('No se realizan acciones adicionales');
    expect(result.stdout).not.toContain('UNEXPECTED_DEPLOY');
  });

  it('removes the speech services when an installation turns voice off, in the installer and in maintenance', () => {
    for (const script of ['scripts/install-edge-office.sh', 'scripts/homepilot-maintenance.sh']) {
      const source = readFileSync(script, 'utf8');
      const removal = source.indexOf('rm -sf homepilot-stt homepilot-tts');
      expect(removal).toBeGreaterThan(0);
      expect(source.slice(Math.max(0, removal - 400), removal)).toContain('voice_enabled" != true');
    }
  });

  it('checks the system and TPM before asking the technician anything (AC14)', () => {
    const result = runShell(simulatedSystem, 'Cliente Prueba\nCasa Prueba\nhomepilot-test\nn\n3\nn\nn\nn\ns\ns\nn\ns\n');
    expect(result.status).toBe(0);
    const out = result.stdout;
    expect(out.indexOf('PREFLIGHT_OK')).toBeGreaterThan(-1);
    expect(out.indexOf('PREFLIGHT_OK')).toBeLessThan(out.indexOf('INFORMACIÓN DEL CLIENTE'));
  });

  it('stops before any question when the system check fails (AC14)', () => {
    const failing = simulatedSystem.replace(/hp_preflight\(\) \{[^\n]*\}/, "hp_preflight() { hp_fail 'sistema no compatible'; }");
    expect(failing).toContain('sistema no compatible');
    const result = runShell(failing, '');
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('INFORMACIÓN DEL CLIENTE');
    expect(result.stdout).not.toContain('DEPLOY:');
  });

  it('requires registry and npm reachability but only warns for optional repositories (AC14)', () => {
    const source = readFileSync('scripts/lib/homepilot-global-installer.sh', 'utf8');
    expect(source).toContain('for host in download.docker.com registry-1.docker.io registry.npmjs.org');
    expect(source).toContain('for host in pkg.cloudflare.com pypi.org');
    const unreachable = runShell('hp_https_reachable() { return 1; }; hp_https_reachable x.invalid || printf UNREACHABLE');
    expect(unreachable.stdout).toContain('UNREACHABLE');
  });

  it('tells the technician how to finish when a step after the deployment fails (AC17)', () => {
    const result = runShell(`
      hp_stage=post_deploy
      trap hp_on_exit EXIT
      exit 3
    `);
    expect(result.status).toBe(3);
    expect(result.stdout).toContain('quedó desplegado');
    expect(result.stdout).toContain('Completar configuración pendiente');
  });

  it('stays silent about recovery on a failure before the deployment or on success (AC17)', () => {
    const early = runShell('trap hp_on_exit EXIT; exit 3');
    expect(early.status).toBe(3);
    expect(early.stdout).not.toContain('quedó desplegado');
    const ok = runShell('hp_stage=post_deploy; trap hp_on_exit EXIT; exit 0');
    expect(ok.status).toBe(0);
    expect(ok.stdout).not.toContain('quedó desplegado');
  });

  it('marks the post-deployment stage around Cloudflare, pairing and binding only (AC17)', () => {
    const source = readFileSync('scripts/lib/homepilot-global-installer.sh', 'utf8');
    expect(source).toMatch(/hp_deploy\n\s+hp_stage=post_deploy\n\s+hp_configure_cloudflared\n\s+hp_pair_directory\n\s+hp_bind_identity\n\s+hp_stage=''/);
    expect(readFileSync('scripts/homepilot-install.sh', 'utf8')).toContain("trap 'hp_on_exit' EXIT");
  });

  it('flags a missing Directory SSO key in the final summary without fetching it (AC17)', () => {
    const missing = runShell(`
      hp_remote=true hp_profile=bridge_ha hp_cameras=false hp_android=false hp_mqtt=false hp_chat=true hp_voice=false
      hp_saved_value() { printf '%s' "$2"; }
      hp_lan_address() { printf 192.168.1.10; }
      hp_finish
    `);
    expect(missing.status).toBe(0);
    expect(missing.stdout).toContain('Llave pública pendiente');
    const present = runShell(`
      hp_remote=true hp_profile=bridge_ha hp_cameras=false hp_android=false hp_mqtt=false hp_chat=true hp_voice=false
      hp_saved_value() { [[ "$1" == DIRECTORY_SSO_PUBLIC_KEY ]] && printf key || printf '%s' "$2"; }
      hp_lan_address() { printf 192.168.1.10; }
      hp_finish
    `);
    expect(present.stdout).not.toContain('Llave pública pendiente');
    expect(readFileSync('scripts/lib/homepilot-global-installer.sh', 'utf8')).not.toContain('directory/sso/public-key');
  });

  it('protects .env and generates the M2M key only when it is empty, without printing it (AC15, AC16)', () => {
    const source = readFileSync('scripts/install-edge-office.sh', 'utf8');
    const created = source.indexOf('ok ".env creado desde $env_template."');
    const protect = source.indexOf('chmod 600 "$ENV_FILE"', created);
    const generate = source.indexOf('openssl rand -hex 32');
    expect(protect).toBeGreaterThan(created);
    expect(generate).toBeGreaterThan(protect);
    const block = source.slice(source.lastIndexOf('if [[ "$status_only" != true', generate), generate + 300);
    expect(block).toContain("-z \"$(env_value HOMEPILOT_INTEGRATION_API_KEY '')\"");
    expect(block).not.toMatch(/(echo|printf|ok|info).*\$\(openssl/);
  });

  it('hands the MQTT credentials to the broker user and pins the broker image (AC19)', () => {
    const script = readFileSync('scripts/configure-pc-agent-mqtt.sh', 'utf8');
    expect(script).toContain('readonly mosquitto_image="eclipse-mosquitto:2.0.22"');
    expect(script).toContain('chown "${broker_uid}:${broker_uid}" "$credentials_dir" "$password_file" "$acl_file"');
    expect(script.match(/^    protect_credentials$/gm)).toHaveLength(2);
    expect(script).not.toMatch(/^s+chmod 600 "$password_file" "$acl_file"$/m);
    expect(script).not.toMatch(/eclipse-mosquitto:2 /);
    for (const compose of ['docker-compose.mqtt-secure.yml', 'docker-compose.pc-agents.yml', 'docker-compose.yml']) {
      expect(readFileSync(compose, 'utf8')).toMatch(/image: eclipse-mosquitto:2.0.22s*$/m);
    }
  });

  it('keeps the voice dependencies reproducible and the companion UI on the reported port (AC18, AC20)', () => {
    expect(readFileSync('services/tts-piper/requirements.txt', 'utf8')).toMatch(/^transformers>=4.51,<5$/m);
    const companion = readFileSync('docker-compose.yml', 'utf8');
    expect(companion).toContain('"${HOMEPILOT_UI_PORT:-8080}:80"');
    expect(companion).not.toContain('"80:80"');
  });

  it('reports what is already available before asking anything and checks ports before the summary (AC22, AC24)', () => {
    const result = runShell(simulatedSystem, 'Cliente Prueba\nCasa Prueba\nhomepilot-test\nn\n3\nn\nn\nn\ns\ns\nn\ns\n');
    expect(result.status).toBe(0);
    const out = result.stdout;
    expect(out.indexOf('PREFLIGHT_OK')).toBeLessThan(out.indexOf('DETECT_OK'));
    expect(out.indexOf('DETECT_OK')).toBeLessThan(out.indexOf('INFORMACIÓN DEL CLIENTE'));
    expect(out).toContain('PORTS_OK:native_only:false:true');
    expect(out.indexOf('PORTS_OK')).toBeLessThan(out.indexOf('REVISAR CONFIGURACIÓN'));
  });

  it('lists the components that are reused and the ones that will be installed (AC22)', () => {
    const present = runShell(`
      hp_docker_operative() { return 0; }
      docker() { printf '28.1.1'; }
      hp_missing_base_packages() { return 0; }
      systemctl() { return 0; }
      hp_diag_http_status() { printf 200; }
      hp_detect_environment
    `);
    expect(present.status).toBe(0);
    expect(present.stdout).toContain('Ya disponible: Docker Engine 28.1.1, Compose y Buildx; se reutilizan.');
    expect(present.stdout).toContain('Ya disponibles: paquetes base, Git y SSH.');
    expect(present.stdout).toContain('Cloudflare Tunnel activo; se reutiliza sin pedir el token.');
    expect(present.stdout).toContain('Home Assistant responde en el puerto 8123');

    const absent = runShell(`
      hp_docker_operative() { return 1; }
      command() { [[ "$2" == docker ]] && return 1; builtin command "$@"; }
      hp_foreign_docker_sources() { :; }
      hp_missing_base_packages() { printf 'git\\njq\\n'; }
      systemctl() { return 3; }
      hp_diag_http_status() { printf 000; }
      hp_detect_environment
    `);
    expect(absent.status).toBe(0);
    expect(absent.stdout).toContain('Docker no está instalado; se instalará.');
    expect(absent.stdout).toContain('Se instalarán los paquetes base que faltan: git jq');
    expect(absent.stdout).toContain('Cloudflare Tunnel no está activo');
    expect(absent.stdout).toContain('No se detectó Home Assistant en el puerto 8123.');
  });

  it('stops before asking anything when another apt source already points at the Docker repository (AC23)', () => {
    const result = runShell(`
      hp_docker_operative() { return 1; }
      command() { [[ "$2" == docker ]] && return 1; builtin command "$@"; }
      hp_foreign_docker_sources() { printf '/etc/apt/sources.list.d/docker.list\\n'; }
      hp_missing_base_packages() { return 0; }
      hp_detect_environment
      printf 'CONTINUED\\n'
    `);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('/etc/apt/sources.list.d/docker.list');
    expect(result.stderr).toContain('No se modificó nada');
    expect(result.stdout).not.toContain('CONTINUED');
    const reuse = runShell(`
      hp_docker_operative() { return 0; }
      docker() { printf 1.0; }
      hp_foreign_docker_sources() { printf '/etc/apt/sources.list.d/docker.list\\n'; }
      hp_missing_base_packages() { return 0; }
      systemctl() { return 3; }
      hp_diag_http_status() { printf 000; }
      hp_detect_environment
    `);
    expect(reuse.status).toBe(0);
  });

  it('never matches the apt source the installer itself writes as a conflict (AC23)', () => {
    const source = readFileSync('scripts/lib/homepilot-global-installer.sh', 'utf8');
    expect(source).toContain("grep -v '^/etc/apt/sources.list.d/docker.sources$'");
  });

  it('stops before changing anything when a required host port is taken, naming port and process (AC24)', () => {
    const result = runShell(`
      hp_profile=native_only hp_mqtt=false hp_voice=false hp_android=false
      hp_port_listening() { [[ "$1" == 8080 ]]; }
      hp_port_owner() { printf nginx; }
      hp_check_ports
      printf 'CONTINUED\\n'
    `);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('El puerto 8080 está ocupado por nginx');
    expect(result.stderr).toContain('No se cambió nada en el sistema');
    expect(result.stdout).not.toContain('CONTINUED');
  });

  it('checks only the ports of the options that were chosen (AC24)', () => {
    const probe = (flags: string) => runShell(`
      ${flags}
      hp_port_listening() { printf 'PROBE:%s\\n' "$1" >&2; return 1; }
      hp_check_ports
    `).stderr.match(/PROBE:\d+/g)?.join(',');
    expect(probe('hp_profile=native_only hp_mqtt=false hp_voice=false hp_android=false')).toBe('PROBE:8080');
    expect(probe('hp_profile=ha_companion hp_mqtt=false hp_voice=false hp_android=false')).toBe('PROBE:8080,PROBE:18123');
    expect(probe('hp_profile=native_only hp_mqtt=true hp_voice=true hp_android=true'))
      .toBe('PROBE:8080,PROBE:1883,PROBE:8090,PROBE:8088,PROBE:5002');
  });

  it('keeps the base package list in one place for detection and installation (AC22)', () => {
    const source = readFileSync('scripts/lib/homepilot-global-installer.sh', 'utf8');
    expect(source.match(/ca-certificates curl jq openssh-server/g)).toHaveLength(1);
    expect(source).toContain('mapfile -t missing < <(hp_missing_base_packages)');
  });

  it('never keeps voice on in maintenance when the chat is off', () => {
    const source = readFileSync('scripts/homepilot-maintenance.sh', 'utf8');
    expect(source).toContain('[[ "$home_chat_enabled" == true ]] || voice_enabled=false');
  });
});
