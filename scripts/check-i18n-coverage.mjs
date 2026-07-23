import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const localeRoot = join(root, 'apps', 'operator-console', 'src', 'locales');
const sourceRoot = join(root, 'apps', 'operator-console', 'src');

const flattenKeys = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  return child !== null && typeof child === 'object' && !Array.isArray(child)
    ? flattenKeys(child, path)
    : [path];
});

const listSourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return listSourceFiles(path);
  return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
});

const readLocaleKeys = (language) => new Set(flattenKeys(JSON.parse(readFileSync(join(localeRoot, language, 'common.json'), 'utf8'))));
const englishKeys = readLocaleKeys('en');
const spanishKeys = readLocaleKeys('es');
const errors = [];
const hasTranslationKey = (keys, key) => (
  keys.has(key) || (keys.has(`${key}_one`) && keys.has(`${key}_other`))
);

for (const key of englishKeys) {
  if (!spanishKeys.has(key)) errors.push(`Missing Spanish key: ${key}`);
}

for (const key of spanishKeys) {
  if (!englishKeys.has(key)) errors.push(`Missing English key: ${key}`);
}

const literalKeyPatterns = [
  /\bt\(\s*(['"])([^'"`]+)\1/g,
  /\bt\(\s*`([^`$]+)`/g,
];
for (const filePath of listSourceFiles(sourceRoot)) {
  const source = readFileSync(filePath, 'utf8');
  for (const pattern of literalKeyPatterns) {
    for (const match of source.matchAll(pattern)) {
      const key = match[2] ?? match[1];
      if (!hasTranslationKey(englishKeys, key) || !hasTranslationKey(spanishKeys, key)) {
        errors.push(`Unknown translation key in ${relative(root, filePath)}: ${key}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`i18n coverage failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`i18n coverage passed: ${englishKeys.size} shared locale key(s), ${listSourceFiles(sourceRoot).length} console source file(s) scanned.`);
