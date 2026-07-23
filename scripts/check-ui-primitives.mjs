import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const sourceRoot = join(root, 'apps', 'operator-console', 'src');
const uiDirectory = `${sep}components${sep}ui${sep}`;

const listSourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return listSourceFiles(path);
  return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
});

const violations = [];
for (const filePath of listSourceFiles(sourceRoot)) {
  const relativePath = relative(root, filePath);
  if (filePath.includes(uiDirectory) || /\.(test|spec)\.[tj]sx?$/.test(filePath)) continue;

  const source = readFileSync(filePath, 'utf8');
  if (/<button(?:\s|>)/.test(source)) {
    violations.push(relativePath);
  }
}

if (violations.length > 0) {
  console.error('UI primitive coverage failed: use Button or IconButton for conventional actions outside components/ui.');
  for (const filePath of violations) console.error(`- ${filePath}`);
  process.exit(1);
}

console.log(`UI primitive coverage passed: ${listSourceFiles(sourceRoot).length} console source file(s) scanned.`);
