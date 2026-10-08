import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

function run(body: string, input = '') {
  return spawnSync(bash, ['-c', `set -euo pipefail
    source scripts/lib/homepilot-global-installer.sh
    hp_color_init
    docker() { printf 'UNEXPECTED_DOCKER\\n' >&2; return 99; }
    systemctl() { printf 'UNEXPECTED_SYSTEMCTL\\n' >&2; return 99; }
    ${body}`], { cwd: process.cwd(), input, encoding: 'utf8', env: { ...process.env, TERM: 'dumb' } });
}

describe('Feature: Unified HomePilot administration console (AC9/AC10/AC11)', () => {
  test.each([[true, '0', false], [true, '1', true], [false, '0', true]])(
    'Scenario: Operation progress respects TTY=%s verbose=%s and preserves command result (AC13)', (tty, verbose, visible) => {
      const result = run(`
        HP_UI_TTY=${tty}; HOMEPILOT_VERBOSE=${verbose}
        tput() { printf 80; }
        result=0
        hp_ui_run 'Construcción simulada' '${bash.replaceAll('\\', '/')}' -c 'printf RAW_OPERATION_OUTPUT; exit 7' || result=$?
        printf '\\nRESULT:%s PID:%s\\n' "$result" "\${HP_UI_PROGRESS_PID:-}"
      `);
      expect(result.status).toBe(0);
      expect(result.stdout.includes('RAW_OPERATION_OUTPUT')).toBe(visible);
      expect(result.stdout).toContain('RESULT:7 PID:');
      expect(result.stdout).toContain('falló (código 7)');
      expect(result.stdout).not.toContain('· completado');
      if (!tty) expect(result.stdout).not.toMatch(/\x1b\[/);
    }
  );

  test('Scenario: Successful quiet operation stops its indicator and reports completion (AC13)', () => {
    const result = run(`
      HP_UI_TTY=true; HOMEPILOT_VERBOSE=0
      tput() { printf 80; }
      hp_ui_run 'Preparando dependencias' '${bash.replaceAll('\\', '/')}' -c 'exit 0'
      [[ -z "\${HP_UI_PROGRESS_PID:-}" ]]
      printf INDICATOR_STOPPED
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Preparando dependencias · completado');
    expect(result.stdout).toContain('INDICATOR_STOPPED');
  });

  test('Scenario: Progress line fits a narrow terminal without invented percentages (AC13)', () => {
    const result = run(`
      HP_UI_TTY=true
      tput() { printf 20; }
      hp_ui_progress_line 'Construyendo servicios HomePilot' 125 O
    `);
    expect(result.status).toBe(0);
    const text = result.stdout.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
    expect(text.length).toBeLessThanOrEqual(20);
    expect(text).toContain('125s');
    expect(text).not.toContain('%');
  });

  test('Scenario: Menu toggles detailed output without executing operations (AC13)', () => {
    const result = run(`
      HOMEPILOT_VERBOSE=0
      hp_admin_execute() { printf UNEXPECTED_OPERATION; }
      hp_admin_menu
      printf 'VERBOSE:%s' "$HOMEPILOT_VERBOSE"
    `, '8\n0\n');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Salida técnica: detallada');
    expect(result.stdout).toContain('VERBOSE:1');
    expect(result.stdout).not.toContain('UNEXPECTED_OPERATION');
  });

  test('Scenario: Verbose CLI flag preserves the selected operation (AC13)', () => {
    const result = run(`
      hp_admin_execute() { printf 'OP:%s VERBOSE:%s' "$1" "$HOMEPILOT_VERBOSE"; }
      hp_main --verbose --status
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OP:status VERBOSE:1');
  });

  test('Scenario: Existing installation shows one brand and can exit without system operations', () => {
    const result = run('hp_existing_installation() { return 0; }; hp_main', '0\n');
    expect(result.status).toBe(0);
    expect(result.stdout.match(/Bienvenido a/g)).toHaveLength(1);
    expect(result.stdout).toContain('Administración de la instalación');
    expect(result.stdout).toContain('Actualizar instalación existente');
    expect(result.stdout).toContain('Backups y recuperación · consultar');
    expect(result.stdout + result.stderr).not.toContain('UNEXPECTED_');
    expect(result.stdout).not.toMatch(/\x1b\[/);
  });

  test('Scenario: Invalid selection retries without executing an operation', () => {
    const result = run('hp_admin_execute() { printf "UNEXPECTED_OPERATION\\n"; }; hp_admin_menu', '999\nabc\n0\n');
    expect(result.status).toBe(0);
    expect(result.stdout.match(/Selecciona una opción entre/g)).toHaveLength(2);
    expect(result.stdout).not.toContain('UNEXPECTED_OPERATION');
  });

  test('Scenario: Menu executes only the selected operation and returns without repeating the brand', () => {
    const result = run('hp_admin_execute() { printf "OPERATION:%s\\n" "$1"; }; hp_admin_menu', '1\n2\n0\n');
    expect(result.status).toBe(0);
    expect(result.stdout.match(/OPERATION:/g)).toHaveLength(2);
    expect(result.stdout).toContain('OPERATION:status');
    expect(result.stdout).toContain('OPERATION:update');
    expect(result.stdout.match(/Bienvenido a/g)).toHaveLength(1);
  });

  test('Scenario: Failed operation returns to menu but is not reported as success', () => {
    const result = run('hp_admin_execute() { return 7; }; hp_admin_menu', '2\n0\n');
    expect(result.status).toBe(7);
    expect(result.stdout).toContain('Operación no completada (código 7)');
    expect(result.stdout).not.toContain('Operación finalizada');
  });

  test('Scenario: Child keeps strict error handling even when the menu catches its failure', () => {
    const result = run(`
      bash() { command '${bash.replaceAll('\\', '/')}' -c "$2
        printf UNREACHED" homepilot-operation invalid; }
      HP_ADMIN_LAST_RESULT=0
      hp_admin_present TEST invalid
      printf 'RESULT:%s\\n' "$HP_ADMIN_LAST_RESULT"
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULT:1');
    expect(result.stdout).not.toContain('UNREACHED');
    expect(result.stdout + result.stderr).not.toContain('UNEXPECTED_DOCKER');
  });

  test('Scenario: Component and storage submenus execute no actions when returning', () => {
    const result = run('hp_admin_execute() { printf "UNEXPECTED_OPERATION\\n"; }; hp_admin_menu', '3\n0\n4\n0\n0\n');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Configuración actual · solo lectura');
    expect(result.stdout).toContain('Limpiar imágenes HomePilot verificadas');
    expect(result.stdout).not.toContain('UNEXPECTED_OPERATION');
  });

  test.each([
    ['--status', 'status'], ['--deploy', 'update'], ['--clean', 'clean'],
    ['--gc-homepilot', 'images'], ['--components', 'components'],
    ['--storage', 'storage'], ['--recovery', 'recovery']
  ])('Scenario: %s delegates to the existing operation contract', (option, operation) => {
    const result = run(`hp_admin_execute() { printf 'OPERATION:%s\\n' "$1"; }; hp_main '${option}'`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`OPERATION:${operation}`);
  });

  test('Scenario: Unknown flags and unsafe combinations cannot execute an operation', () => {
    for (const args of ['--unknown', '--status --yes', '--deploy --unknown', '--deploy --yes extra']) {
      const result = run(`hp_admin_execute() { printf UNEXPECTED_OPERATION; }; hp_main ${args}`);
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain('UNEXPECTED_OPERATION');
    }
  });

  test('Scenario: Help requires no Docker, root, configuration or terminal effects', () => {
    const result = run('hp_main --help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--recovery');
    expect(result.stdout + result.stderr).not.toContain('UNEXPECTED_');
    expect(result.stdout).not.toMatch(/\x1b\[/);
  });

  test('Scenario: Deploy and explicit cleanup reuse their engines, without automatic GC', () => {
    const result = run(`bash() { printf 'DELEGATE:%s\\n' "$*"; }
      hp_admin_operation update
      hp_admin_operation clean --yes
      hp_admin_operation images
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('DELEGATE:scripts/homepilot-maintenance.sh --deploy');
    expect(result.stdout).toContain('DELEGATE:scripts/homepilot-maintenance.sh --clean --yes');
    expect(result.stdout).toContain('DELEGATE:scripts/homepilot-maintenance.sh --gc-homepilot');
    expect(result.stdout.match(/DELEGATE:/g)).toHaveLength(3);
  });

  test.each([20, 32, 44, 80, 120])('Scenario: Messages and long identifiers fit a %s-column terminal', width => {
    const result = run(`
      HP_UI_TTY=true
      tput() { [[ "$1" == cols ]] && printf '${width}'; }
      hp_ui_block '' 'Un mensaje largo de administración que debe adaptarse sin desbordar la pantalla.'
      hp_ui_status '*' '' 'Cloudflare Tunnel' 'Servicio activo; conexión no verificada'
      hp_ui_wrap_block '' 'sha256:0123456789012345678901234567890123456789012345678901234567890123456789'
    `);
    expect(result.status).toBe(0);
    for (const line of result.stdout.trimEnd().split('\n')) expect([...line].length).toBeLessThanOrEqual(width);
  });

  test('Scenario: Selectors reject invalid values and normalize a valid ordinal', () => {
    const result = run('hp_ui_select Elige Uno Dos; printf "CHOICE:%s\\n" "$REPLY"', '99\nabc\n02\n');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CHOICE:2');
  });

  test('Scenario: Read-only identity check cannot invoke bootstrap, migrations or enrollment', () => {
    const source = readFileSync('scripts/lib/homepilot-runtime-preservation.sh', 'utf8');
    expect(source).toContain('readonly: true, fileMustExist: true');
    expect(source).toContain("db.pragma('query_only = ON')");
    expect(source).not.toMatch(/buildDatabase|db\.exec|dist\/scripts\/enroll-edge-device/);
    const global = readFileSync('scripts/lib/homepilot-global-installer.sh', 'utf8');
    expect(global).toContain('hp_binding_status() { homepilot_runtime_identity_status; }');
    expect(global).not.toContain("'Connected'");
  });

  test('Scenario: Component operations reuse the existing Compose project', () => {
    const result = run(`unset COMPOSE_PROJECT_NAME
      docker() { [[ "$1" == inspect ]] || return 99; printf 'customer-homepilot\\n'; }
      hp_admin_existing_project
      printf 'PROJECT:%s\\n' "$COMPOSE_PROJECT_NAME"
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('PROJECT:customer-homepilot');
  });

  test('Scenario: Conflicting project and unavailable recovery inspection fail without mutations', () => {
    const conflict = run(`export COMPOSE_PROJECT_NAME=another
      docker() { [[ "$1" == inspect ]] || return 99; printf 'customer-homepilot\\n'; }
      hp_admin_existing_project
      printf UNREACHED
    `);
    expect(conflict.status).not.toBe(0);
    expect(conflict.stdout).not.toContain('UNREACHED');
    const unavailable = run('docker() { return 1; }; hp_admin_operation recovery');
    expect(unavailable.status).not.toBe(0);
    expect(unavailable.stderr).toContain('Docker no disponible');
  });

  test.each([20, 32, 80])('Scenario: Header fits %s columns and only wide TTY reserves a scrolling region', width => {
    const result = run(`
      hp_color_init() { HP_UI_TTY=true; HP_UI_FIXED=false; HP_UI_HEADER_LINES=13; }
      tput() { case "$1" in cols) printf '${width}' ;; lines) printf 30 ;; *) return 0 ;; esac; }
      hp_ui_header
      printf 'FIXED:%s\\n' "$HP_UI_FIXED"
      hp_ui_shutdown
    `);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`FIXED:${width >= 44}`);
    for (const line of result.stdout.trimEnd().split('\n')) expect([...line].length).toBeLessThanOrEqual(width);
  });

  test('Scenario: Operational modules have no competing logos or terminal clearing', () => {
    for (const file of ['scripts/install-edge-office.sh', 'scripts/homepilot-maintenance.sh']) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('███╗');
      expect(source).not.toContain('_   _ _____');
      expect(source).not.toMatch(/^\s+clear\s*$/m);
      expect(source).toContain('hp_ui_separator');
    }
  });

  test.each(['--help', '--list'])('Scenario: Wake-on-LAN %s leaves configuration and registry unchanged', option => {
    const directory = mkdtempSync(path.join(tmpdir(), 'homepilot-wol-readonly-'));
    try {
      mkdirSync(path.join(directory, 'scripts'));
      mkdirSync(path.join(directory, 'ha-config'));
      copyFileSync('scripts/configure-wol-devices.sh', path.join(directory, 'scripts/configure-wol-devices.sh'));
      const config = path.join(directory, 'ha-config/configuration.yaml');
      writeFileSync(config, 'default_config:\n');
      const result = spawnSync(bash, [path.join(directory, 'scripts/configure-wol-devices.sh').replaceAll('\\', '/'), option],
        { cwd: tmpdir(), encoding: 'utf8' });
      expect(result.status).toBe(0);
      expect(readFileSync(config, 'utf8')).toBe('default_config:\n');
      expect(readdirSync(path.join(directory, 'ha-config'))).toEqual(['configuration.yaml']);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  test.each([
    ['scripts/check-pc-integration-readiness.sh', '--mode'],
    ['scripts/configure-pc-agent-mqtt.sh', 'init', '--ha-username'],
    ['scripts/configure-pc-agent-mqtt.sh', 'add-device', '--device-name']
  ])('Scenario: Incomplete arguments fail explicitly without system operations: %s', (...args) => {
    const result = spawnSync(bash, [path.resolve(args[0]).replaceAll('\\', '/'), ...args.slice(1)],
      { cwd: tmpdir(), encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toContain('falta valor');
    expect(result.stderr).not.toContain('shift');
  });

  test.each(['scripts', 'scripts/lib'].flatMap(directory =>
    readdirSync(directory).filter(file => file.endsWith('.sh')).map(file => `${directory}/${file}`)
  ))('Scenario: %s has valid Bash syntax', file => {
    const result = spawnSync(bash, ['-n', path.resolve(file).replaceAll('\\', '/')], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });
});
