import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const sourceRoots = ['apps/api', 'apps/operator-console/src', 'packages'];
const forbiddenRoute = /\/api\/v1\/integrations\/tuya/iu;
const forbiddenEnv = /\bTUYA_[A-Z_]*\b/u;

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(path);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [path] : [];
  });
}

const violations = sourceRoots
  .flatMap(walk)
  .filter((file) => forbiddenRoute.test(readFileSync(file, 'utf8')));
const composeFiles = ['docker-compose.yml', 'docker-compose.office.yml', 'docker-compose.office.windows.yml', 'docker-compose.desktop.yml'];
for (const file of composeFiles) {
  if (existsSync(file) && forbiddenEnv.test(readFileSync(file, 'utf8'))) violations.push(file);
}

if (violations.length > 0) {
  console.error(`Tuya policy failed: direct integration references found in ${violations.join(', ')}`);
  process.exit(1);
}
console.log('Tuya policy passed: HomePilot exposes no direct Tuya integration surface.');