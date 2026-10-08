import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface Receipt { version: number; digest: string; stages: string[]; completedAt: number }
const quality = require('../scripts/verify-quality-receipt.cjs') as {
  fingerprint(root: string, files: string[], env?: Record<string, string>): string;
  checkReceipt(receipt: Receipt | null, digest: string, now?: number): void;
  validate(root: string, file: string, options: {
    snapshot: () => string; run: (stage: string) => void; now?: () => number;
  }): Receipt;
  checkPushTargets(input: string, head: string): void;
  MAX_AGE_MS: number;
};

describe('Feature: Reusable complete quality evidence (Engineering Quality AC6)', () => {
  let root: string;
  let receiptPath: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'homepilot-quality-'));
    receiptPath = join(root, 'receipt.json');
    writeFileSync(join(root, 'source.ts'), 'export const value = 1;');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const good = (now = 1000): Receipt => ({ version: 1, digest: 'same',
    stages: ['verify:ci', 'test:responsive'], completedAt: now });

  it('Scenario: Complete success records both stages in order, without filtered arguments', () => {
    const run = jest.fn();
    quality.validate(root, receiptPath, { snapshot: () => 'same', run, now: () => 1000 });
    expect(run.mock.calls).toEqual([['verify:ci'], ['test:responsive']]);
    expect(JSON.parse(readFileSync(receiptPath, 'utf8'))).toEqual(good());
    expect(() => quality.checkReceipt(good(), 'same', 1001)).not.toThrow();
  });
  it.each(['verify:ci', 'test:responsive'])('Scenario: Failure of %s invalidates prior evidence', stage => {
    writeFileSync(receiptPath, JSON.stringify(good()));
    const run = jest.fn((current: string) => { if (current === stage) throw new Error('failed'); });
    expect(() => quality.validate(root, receiptPath, { snapshot: () => 'same', run })).toThrow('failed');
    expect(existsSync(receiptPath)).toBe(false);
    if (stage === 'verify:ci') expect(run).toHaveBeenCalledTimes(1);
  });
  it('Scenario: Source changes during validation prevent evidence creation', () => {
    const snapshot = jest.fn().mockReturnValueOnce('before').mockReturnValueOnce('after');
    expect(() => quality.validate(root, receiptPath, { snapshot, run: jest.fn() })).toThrow('cambió');
    expect(existsSync(receiptPath)).toBe(false);
  });
  it.each([
    null, { ...good(), version: 0 }, { ...good(), digest: 'old' },
    { ...good(), stages: ['test:responsive'] }, { ...good(), completedAt: NaN },
    { ...good(), completedAt: 2000 },
  ])('Scenario: Missing, partial, incompatible or future evidence is rejected', receipt => {
    expect(() => quality.checkReceipt(receipt, 'same', 1001)).toThrow('verify:quality');
  });
  it('Scenario: Evidence expires after 24 hours', () => {
    expect(() => quality.checkReceipt(good(), 'same', 1000 + quality.MAX_AGE_MS)).not.toThrow();
    expect(() => quality.checkReceipt(good(), 'same', 1001 + quality.MAX_AGE_MS)).toThrow();
  });
  it('Scenario: File order and duplicate entries do not alter the content identity', () => {
    writeFileSync(join(root, 'other.ts'), 'same');
    expect(quality.fingerprint(root, ['source.ts', 'other.ts'], {}))
      .toBe(quality.fingerprint(root, ['other.ts', 'source.ts', 'source.ts'], {}));
  });
  it('Scenario: Changed, deleted and newly added source invalidate evidence', () => {
    const before = quality.fingerprint(root, ['source.ts'], {});
    writeFileSync(join(root, 'source.ts'), 'export const value = 2;');
    expect(quality.fingerprint(root, ['source.ts'], {})).not.toBe(before);
    rmSync(join(root, 'source.ts'));
    expect(quality.fingerprint(root, ['source.ts'], {})).not.toBe(before);
    writeFileSync(join(root, 'source.ts'), 'export const value = 1;');
    writeFileSync(join(root, 'new.ts'), 'new');
    expect(quality.fingerprint(root, ['source.ts', 'new.ts'], {})).not.toBe(before);
  });
  it('Scenario: Environment and installed dependency lock changes invalidate evidence', () => {
    const before = quality.fingerprint(root, ['source.ts'], {});
    expect(quality.fingerprint(root, ['source.ts'], { TZ: 'UTC' })).not.toBe(before);
    mkdirSync(join(root, 'node_modules'));
    writeFileSync(join(root, 'node_modules/.package-lock.json'), '{"version":1}');
    expect(quality.fingerprint(root, ['source.ts'], {})).not.toBe(before);
  });
  it('Scenario: Committing unchanged validated bytes does not depend on a commit SHA', () => {
    const digest = quality.fingerprint(root, ['source.ts'], {});
    expect(quality.fingerprint(root, ['source.ts'], {})).toBe(digest);
    expect(() => quality.checkReceipt({ ...good(), digest }, digest, 1001)).not.toThrow();
  });
  it('Scenario: Referencing files outside the repository fails closed', () => {
    expect(() => quality.fingerprint(root, ['../outside'], {})).toThrow('fuera');
  });
  it('Scenario: Pushes of another revision cannot reuse HEAD evidence', () => {
    const head = 'a'.repeat(40);
    expect(() => quality.checkPushTargets(`refs/heads/main ${head} refs/heads/main ${'b'.repeat(40)}\n`, head)).not.toThrow();
    expect(() => quality.checkPushTargets(`refs/heads/old ${'c'.repeat(40)} refs/heads/old ${'b'.repeat(40)}`, head)).toThrow('otra revisión');
    expect(() => quality.checkPushTargets(`(delete) ${'0'.repeat(40)} refs/heads/old ${head}`, head)).not.toThrow();
    expect(() => quality.checkPushTargets('invalid', head)).toThrow('inválida');
  });
});
