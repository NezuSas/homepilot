import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

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
  hp_install_base() { printf 'BASE_OK\\n'; }
  hp_install_docker() { printf 'DOCKER_OK\\n'; }
  hp_verify_tpm() { printf 'TPM_OK\\n'; }
  hp_prepare_mqtt() { printf 'MQTT_PREPARE:%s\\n' "$hp_mqtt"; }
  hp_deploy() { printf 'DEPLOY:%s:%s:%s:%s:%s\\n' "$hp_profile" "$hp_cameras" "$hp_android" "$hp_mqtt" "$hp_voice"; }
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
  it('shows one branded diagnostic summary without legacy banners or technical inventories by default', () => {
    const result = runShell(`${diagnosticSystem}
      bash() { printf 'UNEXPECTED_DOCKER_PS\\n'; }
      hp_existing_menu
    `, '1\nn\n');
    expect(result.status).toBe(0);
    expect(result.stdout.match(/Welcome to/g)).toHaveLength(1);
    expect(result.stdout).toContain('ESTADO / DIAGNÓSTICO');
    expect(result.stdout).toContain('HomePilot API');
    expect(result.stdout).toContain('Healthy');
    expect(result.stdout).toContain('Home Assistant');
    expect(result.stdout).toContain('Online');
    expect(result.stdout).toContain('Directory Edge');
    expect(result.stdout).toContain('TPM 2.0');
    expect(result.stdout).toContain('Android Display');
    expect(result.stdout).toContain('Not installed');
    expect(result.stdout).toContain('Sistema operativo correctamente');
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
      hp_existing_menu
    `, '1\ns\n');
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Android Display\s+Running/);
    expect(result.stdout).toMatch(/MQTT\s+Running/);
    expect(result.stdout).toContain('TECHNICAL:scripts/check-edge-install.sh:embedded=1');
    expect(result.stdout.match(/Welcome to/g)).toHaveLength(1);
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
    ['existing Home Assistant', '1\nn\nn\nn\nn\ns\nn\ns\n', 'bridge_ha'],
    ['managed Home Assistant', '2\nn\nn\nn\ns\nn\ns\n', 'ha_companion'],
    ['no Home Assistant', '3\nn\nn\nn\ns\nn\ns\n', 'native_only'],
  ])('maps %s to its existing installation profile', (_label, architectureInput, profile) => {
    const input = `Cliente Prueba\nCasa Prueba\nhomepilot-test\nn\n${architectureInput}`;
    const result = runShell(simulatedSystem, input);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`DEPLOY:${profile}:false:false:false:true`);
    expect(result.stdout).toContain('TPM_OK');
    expect(result.stdout).toContain('FINISHED');
    expect(result.stdout).toContain('Welcome to');
    expect(result.stdout).toContain('H O M E P I L O T');
    expect(result.stdout).toContain('SYSTEM CHECK');
    expect(result.stdout).toContain('REVISAR CONFIGURACIÓN');
    expect(result.stdout).not.toMatch(/\x1b\[/);
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
    const input = 'Cliente Prueba\nCasa Prueba\nhomepilot-test\nn\n3\ns\ns\n192.168.1.0/24\ns\n192.168.1.10\nhomeassistant\nn\nn\ns\n';
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
      hp_profile=bridge_ha hp_cameras=false hp_android=false hp_mqtt=false hp_voice=false
      hp_client='Cliente Prueba' hp_installation='Casa Prueba' hp_community=false
      bash() { printf 'DELEGATE:%s\\nCAMERA:%s VOICE:%s MQTT:%s TPM:%s REV:%s\\n' "$*" "$HOMEPILOT_INSTALL_CAMERA_ENABLED" "$HOMEPILOT_INSTALL_VOICE_ENABLED" "$HOMEPILOT_INSTALL_MQTT_ENABLED" "$HOMEPILOT_INSTALL_TPM_ENABLED" "$HOMEPILOT_BUILD_REVISION"; }
      hp_deploy
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('DELEGATE:scripts/install-edge-office.sh --profile bridge_ha --start --yes');
    expect(result.stdout).toContain('CAMERA:false VOICE:false MQTT:false TPM:true REV:installer-v1');
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
      hp_existing_menu
    `, '2\n');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Instalación histórica');
    expect(result.stdout).not.toContain('UNEXPECTED_DEPLOY');
  });

  it('offers safe choices on a second run without deploying or changing configuration', () => {
    const result = runShell(`
      hp_existing_installation() { return 0; }
      hp_deploy() { printf 'UNEXPECTED_DEPLOY\\n'; return 1; }
      hp_main
    `, '4\n');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Existing HomePilot installation detected');
    expect(result.stdout).toContain('Sin cambios');
    expect(result.stdout).not.toContain('UNEXPECTED_DEPLOY');
  });
});
