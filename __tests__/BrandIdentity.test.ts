import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BRAND } from '../packages/shared/config/brand';

const root = process.cwd();
const checkScript = join(root, 'scripts', 'check-brand.mjs');
const brandJson = JSON.parse(readFileSync(join(root, 'brand.json'), 'utf8')) as { productName: string; companyName: string };

describe('Feature: the product name has a single source', () => {
  it('Scenario: Given brand.json When the backend reads its names Then they are exactly the ones in the file', () => {
    expect(BRAND).toEqual({ productName: brandJson.productName, companyName: brandJson.companyName });
    expect(brandJson.productName.trim()).not.toBe('');
  });

  it('Scenario: Given a domain error When it is raised Then its message carries the name from brand.json', async () => {
    const { SingleHomeInstallationError } = await import('../packages/topology/domain/errors');

    expect(new SingleHomeInstallationError().message).toContain(brandJson.productName);
  });
});

describe('Feature: shell messages take the name from brand.json', () => {
  const run = (script: string, environment: Record<string, string> = {}) => spawnSync('bash', ['-c', script], { cwd: root, encoding: 'utf8', env: { ...process.env, HP_BRAND: '', ...environment } });

  it('Scenario: Given brand.json When the loader is sourced Then both names are exported', () => {
    const result = run('source scripts/lib/brand.sh && echo "$HP_BRAND|$HP_BRAND_COMPANY"');

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(`${brandJson.productName}|${brandJson.companyName}`);
  });

  it('Scenario: Given the loader sourced twice When the second load runs Then nothing changes', () => {
    const result = run('source scripts/lib/brand.sh && source scripts/lib/brand.sh && echo "$HP_BRAND"');

    expect(result.stdout.trim()).toBe(brandJson.productName);
  });

  it('Scenario: Given another name When a script prints its help Then the new name appears and the old one does not', () => {
    const result = run('bash scripts/homepilot-maintenance.sh --help', { HP_BRAND: 'Acme Home', HP_BRAND_COMPANY: 'Acme' });

    expect(result.stdout).toContain('Acme Home');
    expect(result.stdout).not.toContain('HomePilot');
  });
});

describe('Feature: nobody types the product name into a message again', () => {
  it('Scenario: Given the repository When the brand check runs Then it passes', () => {
    const result = spawnSync(process.execPath, [checkScript], { cwd: root, encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Brand check passed');
  });

  function sandbox(files: Record<string, string>) {
    const directory = mkdtempSync(join(tmpdir(), 'hp-brand-'));
    writeFileSync(join(directory, 'brand.json'), JSON.stringify({ productName: 'Acme Home', companyName: 'Acme' }));
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(directory, name, '..'), { recursive: true });
      writeFileSync(join(directory, name), content);
    }
    spawnSync('git', ['init', '-q'], { cwd: directory });
    spawnSync('git', ['add', '-A'], { cwd: directory });
    return directory;
  }
  const check = (directory: string) => spawnSync(process.execPath, [checkScript], { cwd: directory, encoding: 'utf8' });

  it('Scenario: Given a message with the old name typed by hand When checked Then it fails and points at the line', () => {
    const directory = sandbox({ 'packages/demo/message.ts': "export const hello = 'Bienvenido a HomePilot';\n" });
    try {
      const result = check(directory);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('packages/demo/message.ts:1');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('Scenario: Given the new name typed by hand When checked Then it fails as well', () => {
    const directory = sandbox({ 'apps/api/message.ts': "export const hello = 'Bienvenido a Acme Home';\n" });
    try {
      expect(check(directory).status).toBe(1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('Scenario: Given only identifiers, log tags, comments and tests When checked Then it passes', () => {
    const directory = sandbox({
      'packages/demo/ok.ts': [
        '// HomePilot is described in this comment',
        'export interface HomePilotRequest { id: string }',
        "export const header = 'X-HomePilot-Bridge-Token';",
        "console.log('[HomePilot] starting');",
        "console.log('[HomePilot:CORS] allowed');",
        'export const executableInHomePilot = true;',
      ].join('\n'),
      'packages/demo/__tests__/spec.test.ts': "expect('HomePilot').toBe('HomePilot');\n",
      'docs/readme.md': 'HomePilot documentation\n',
    });
    try {
      expect(check(directory).status).toBe(0);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});

describe('Feature: renaming the product in one command', () => {
  const renameScript = join(root, 'scripts', 'rename-brand.mjs');
  function repository() {
    const directory = mkdtempSync(join(tmpdir(), 'hp-rename-'));
    writeFileSync(join(directory, 'brand.json'), JSON.stringify({ productName: 'HomePilot', companyName: 'NEZU' }, null, 2));
    writeFileSync(join(directory, 'README.md'), 'HomePilot is a home system. See https://github.com/org/homepilot and the class HomePilotRequest.\n');
    mkdirSync(join(directory, 'docs'), { recursive: true });
    writeFileSync(join(directory, 'docs', 'guide.md'), 'Install HomePilot. Run `docker compose up homepilot-api` and set HOMEPILOT_DB_PATH.\n');
    mkdirSync(join(directory, 'specs'), { recursive: true });
    writeFileSync(join(directory, 'specs', 'history.md'), 'HomePilot spec, kept as written.\n');
    spawnSync('git', ['init', '-q'], { cwd: directory });
    spawnSync('git', ['add', '-A'], { cwd: directory });
    return directory;
  }
  const rename = (directory: string, ...args: string[]) => spawnSync(process.execPath, [renameScript, ...args], { cwd: directory, encoding: 'utf8' });

  it('Scenario: Given no --apply When run Then it only reports and writes nothing', () => {
    const directory = repository();
    try {
      const result = rename(directory, '--product', 'Acme Home');

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Dry run');
      expect(readFileSync(join(directory, 'brand.json'), 'utf8')).toContain('HomePilot');
      expect(readFileSync(join(directory, 'README.md'), 'utf8')).toContain('HomePilot is a home system');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('Scenario: Given --apply When run Then brand.json and the documentation change but technical names and specs do not', () => {
    const directory = repository();
    try {
      const result = rename(directory, '--product', 'Acme Home', '--company', 'Acme', '--apply');

      expect(result.status).toBe(0);
      expect(JSON.parse(readFileSync(join(directory, 'brand.json'), 'utf8'))).toEqual({ productName: 'Acme Home', companyName: 'Acme' });
      const readme = readFileSync(join(directory, 'README.md'), 'utf8');
      expect(readme).toContain('Acme Home is a home system');
      expect(readme).toContain('github.com/org/homepilot');
      expect(readme).toContain('HomePilotRequest');
      const guide = readFileSync(join(directory, 'docs', 'guide.md'), 'utf8');
      expect(guide).toContain('Install Acme Home.');
      expect(guide).toContain('homepilot-api');
      expect(guide).toContain('HOMEPILOT_DB_PATH');
      expect(readFileSync(join(directory, 'specs', 'history.md'), 'utf8')).toContain('HomePilot spec');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it.each([[[]], [['--product', '']], [['--product', 'Bad "Name"']], [['--product', 'x'.repeat(61)]]])('Scenario: Given invalid arguments %j When run Then it refuses', (args) => {
    const directory = repository();
    try {
      const result = rename(directory, ...args);

      expect(result.status).toBe(1);
      expect(readFileSync(join(directory, 'brand.json'), 'utf8')).toContain('HomePilot');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
