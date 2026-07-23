import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const sourceRoot = join(root, 'apps', 'operator-console', 'src');
const uiDirectory = `${sep}components${sep}ui${sep}`;
const specializedTextareaFiles = new Set([
  'apps/operator-console/src/components/HomeConversationComposer.tsx',
]);

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
  const fileViolations = [];
  if (/<button(?:\s|>)/.test(source)) fileViolations.push('button');
  if (/<input\b(?:(?!\/?>)[\s\S])*?\btype\s*=\s*["'](?:text|password|email|search)["']/.test(source)) {
    fileViolations.push('text input');
  }
  if (/<select(?:\s|>)/.test(source) || /<option(?:\s|>)/.test(source)) fileViolations.push('select');
  if (/<textarea(?:\s|>)/.test(source) && !specializedTextareaFiles.has(relativePath.replaceAll(sep, '/'))) {
    fileViolations.push('textarea');
  }
  if (fileViolations.length > 0) violations.push(`${relativePath} (${fileViolations.join(', ')})`);
}

if (violations.length > 0) {
  console.error('UI primitive coverage failed: use shared UI primitives for conventional actions, fields and selects outside components/ui.');
  for (const filePath of violations) console.error(`- ${filePath}`);
  process.exit(1);
}

console.log(`UI primitive coverage passed: ${listSourceFiles(sourceRoot).length} console source file(s) scanned.`);
