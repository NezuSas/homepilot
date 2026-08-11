import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['packages'];
const violations = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(fullPath);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue;
    if (!fullPath.split(/[\\/]/).includes('application')) continue;

    const lines = readFileSync(fullPath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/^\s*import(?:\s+type)?\s+.*?from\s+['\"][^'\"]*\/infrastructure\//.test(line)) {
        violations.push(`${relative(process.cwd(), fullPath)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

for (const root of roots) collect(root);

if (violations.length > 0) {
  console.error('Architecture boundary failed: application code must not import infrastructure.');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log('Architecture boundary passed: application code has no infrastructure imports.');