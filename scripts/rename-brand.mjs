// Renames the product everywhere a person reads it: brand.json (which feeds the console, the backend and the
// scripts) and the documentation text. It is a dry run unless --apply is given.
//
//   node scripts/rename-brand.mjs --product "New Name" [--company "New Company"] [--apply]
//
// Technical identifiers (environment variables, container and image names, database files, HTTP headers and
// class names) are deliberately left alone; docs/brand-and-naming.md explains how to rename those separately.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const valueOf = (flag) => { const at = args.indexOf(flag); return at >= 0 ? args[at + 1] : undefined; };
const apply = args.includes('--apply');
const newProduct = valueOf('--product');
const newCompany = valueOf('--company');

const invalid = (value) => typeof value !== 'string' || !value.trim() || /["\\\n\r]/.test(value) || value.length > 60;
if (invalid(newProduct) || (newCompany !== undefined && invalid(newCompany))) {
  console.error('Usage: node scripts/rename-brand.mjs --product "New Name" [--company "New Company"] [--apply]');
  console.error('Names must be 1-60 characters, with no quotes, backslashes or line breaks.');
  process.exit(1);
}

const brandPath = join(root, 'brand.json');
const brand = JSON.parse(readFileSync(brandPath, 'utf8'));
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const olds = [...new Set([brand.productName, 'HomePilot'])].filter((name) => name !== newProduct);

const documentation = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n')
  .filter((file) => file === 'README.md' || /^docs\/.+\.md$/.test(file));

const plan = [];
for (const file of documentation) {
  const text = readFileSync(join(root, file), 'utf8');
  let next = text;
  let count = 0;
  for (const old of olds) {
    const pattern = new RegExp(`(?<![A-Za-z0-9_\\-\\[/.])${escape(old)}(?![A-Za-z0-9_\\-:\\]/]|\\.[A-Za-z0-9])`, 'g');
    next = next.replace(pattern, () => { count += 1; return newProduct; });
  }
  if (count > 0) plan.push({ file, count, next });
}

console.log(`${apply ? 'Applying' : 'Dry run'}: "${brand.productName}" -> "${newProduct}"${newCompany ? `, company "${brand.companyName}" -> "${newCompany}"` : ''}`);
console.log(`brand.json: productName${newCompany ? ' and companyName' : ''} change.`);
for (const entry of plan) console.log(`${String(entry.count).padStart(5)}  ${entry.file}`);
console.log(`${plan.reduce((sum, entry) => sum + entry.count, 0)} mention(s) in ${plan.length} documentation file(s).`);

if (!apply) {
  console.log('Nothing was written. Add --apply to make the change.');
  process.exit(0);
}

writeFileSync(brandPath, `${JSON.stringify({ ...brand, productName: newProduct, ...(newCompany ? { companyName: newCompany } : {}) }, null, 2)}\n`);
for (const entry of plan) writeFileSync(join(root, entry.file), entry.next);
console.log('Done. Technical identifiers were not changed; see docs/brand-and-naming.md. Rebuild the images to see the new name.');
