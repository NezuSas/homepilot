import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface TranslationTree {
  [key: string]: TranslationTree | string;
}

function readLocale(language: 'en' | 'es'): TranslationTree {
  const filePath = join(process.cwd(), 'apps', 'operator-console', 'src', 'locales', language, 'common.json');
  return JSON.parse(readFileSync(filePath, 'utf8')) as TranslationTree;
}

function flattenKeys(tree: TranslationTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : flattenKeys(value, path);
  });
}

describe('Operator Console locales', () => {
  it('keeps Spanish and English translation keys in sync', () => {
    const englishKeys = flattenKeys(readLocale('en')).sort();
    const spanishKeys = flattenKeys(readLocale('es')).sort();

    expect(spanishKeys).toEqual(englishKeys);
  });
});
