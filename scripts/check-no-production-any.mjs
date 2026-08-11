import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['apps', 'packages'];
const files = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
}

for (const root of roots) collect(root);
files.push('bootstrap.ts');

const unsafeAny = /(?:\:\s*any\b|\bas\s+any\b|\bArray\s*<\s*any\s*>|\bPromise\s*<\s*any\s*>|\bRecord\s*<[^>]*\bany\b)/;
const violations = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('//') && !trimmed.startsWith('*') && unsafeAny.test(line)) {
      violations.push(relative(process.cwd(), file) + ':' + (index + 1) + ': ' + line.trim());
    }
  });
}

if (violations.length > 0) {
  console.error('Se detectaron usos de `any` en código de producción:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`No se detectaron usos de \`any\` en ${files.length} archivos de producción.`);