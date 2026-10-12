// Fails when a text a person reads has the product name written by hand instead of coming from brand.json.
// Technical identifiers (HomePilotRequest, X-HomePilot-Bridge-Token, [HomePilot] log tags) and comments are allowed.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const brand = JSON.parse(readFileSync(join(root, 'brand.json'), 'utf8'));
if (typeof brand.productName !== 'string' || !brand.productName.trim()) {
  console.error('brand.json must define productName.');
  process.exit(1);
}

// The current name and the historical one must never be typed into a message.
const names = [...new Set([brand.productName, 'HomePilot'])];
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const included = [
  /^apps\/operator-console\/(index\.html|src\/.+\.(ts|tsx|json))$/,
  /^(packages|apps\/api|infrastructure)\/.+\.ts$/,
  /^(bootstrap|main)\.ts$/,
  /^scripts\/(.+\.sh|claim-cloud-pairing\.mjs)$/,
];
const excluded = [
  /\.test\.(ts|tsx)$/,
  /(^|\/)__tests__\//,
  /\/fixtures\//,
  /^packages\/shared\/config\/brand\.ts$/,
  /^apps\/operator-console\/src\/brand\.ts$/,
  /^scripts\/lib\/brand\.sh$/,
];

const files = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n')
  .filter((file) => included.some((rule) => rule.test(file)) && !excluded.some((rule) => rule.test(file)));

const isCommentLine = (line) => /^\s*(\/\/|\/\*|\*|#|<!--)/.test(line);
const violations = [];

for (const file of files) {
  const lines = readFileSync(join(root, file), 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (isCommentLine(line)) return;
    for (const name of names) {
      const pattern = new RegExp(`(?<![A-Za-z0-9_\\-\\[])${escape(name)}(?![A-Za-z0-9_\\-:\\]])`, 'g');
      if (pattern.test(line)) violations.push(`${file}:${index + 1}  ${line.trim().slice(0, 120)}`);
    }
  });
}

if (violations.length > 0) {
  console.error(`Brand check failed: ${violations.length} place(s) write the product name by hand.`);
  console.error('Use BRAND.productName (code), {{brand}} (translations), $HP_BRAND (shell) or %BRAND_PRODUCT_NAME% (index.html).');
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log(`Brand check passed: ${files.length} user-facing file(s) take the product name from brand.json.`);
