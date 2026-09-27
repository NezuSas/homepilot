import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe'
  : 'bash';

function runInstaller(args: string, mockDocker = false) {
  const dockerGuard = mockDocker
    ? 'docker() { return 1; }; export -f docker;'
    : '';
  return spawnSync(bash, ['-lc', `
    export PATH=/usr/bin:/mingw64/bin:$PATH
    ${dockerGuard}
    bash scripts/install-edge-office.sh ${args}
  `], { cwd: process.cwd(), encoding: 'utf8' });
}

describe('install-edge-office argument parsing under set -u', () => {
  it('prints help with an explicit profile', () => {
    const result = runInstaller('--profile bridge_ha --help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Uso: bash scripts/install-edge-office.sh');
    expect(result.stderr).not.toContain('unbound variable');
  });

  it('parses a normal invocation without --wizard before checking Docker', () => {
    const result = runInstaller('--profile bridge_ha --status', true);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Docker Compose v2 no esta disponible');
    expect(result.stderr).not.toContain('unbound variable');
  });
});
