import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

describe('Feature: Explicit full quality validation (Engineering Quality AC6)', () => {
  it('Scenario: Ordinary CI keeps all non-visual controls and full Jest coverage', () => {
    for (const check of ['check:i18n', 'check:assistant-response-catalog', 'check:ui-primitives',
      'check:spec-coverage', 'check:no-production-any', 'check:architecture-boundaries',
      'check:bdd-traceability', 'check:module-test-coverage', 'check:tuya-policy', 'check:docker-profiles',
      'lint --prefix apps/operator-console', 'test:coverage', 'typecheck', 'build', 'build --prefix apps/operator-console']) {
      expect(scripts['verify:ci'].split(' && ')).toContain(`npm run ${check}`);
    }
    expect(scripts['verify:ci']).not.toContain('test:responsive');
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('  push:');
    expect(ci).toContain('  pull_request:');
    expect(ci).toContain('run: npm run verify:ci');
    expect(ci).not.toContain('playwright install');
    expect(ci).not.toContain('continue-on-error');
  });

  it('Scenario: Full validation still executes every visual test after non-visual controls', () => {
    expect(scripts['verify:quality']).toBe('npm run verify:ci && npm run test:responsive');
    expect(scripts['test:responsive']).toBe('node scripts/run-responsive-tests.mjs');
  });

  it('Scenario: Remote full validation is explicit, not repeated on every push', () => {
    const workflow = read('.github/workflows/full-quality-validation.yml');
    expect(workflow).toContain('  workflow_dispatch:');
    expect(workflow).not.toContain('  push:');
    expect(workflow).not.toContain('  pull_request:');
    expect(workflow).toContain('run: npx playwright install --with-deps chromium');
    expect(workflow).toContain('run: npm run verify:quality');
    expect(workflow).not.toContain('continue-on-error');
  });
});
