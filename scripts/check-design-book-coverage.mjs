// Design book coverage (specs/operator-console-design-book-v1.md, REQ-02 / AC2).
// Every component file in components/ui needs a quoted key in design-book/demos*.tsx, and every key must match a file.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const consoleSrc = join(root, 'apps', 'operator-console', 'src');
const uiDir = join(consoleSrc, 'components', 'ui');
const bookDir = join(consoleSrc, 'design-book');

const components = readdirSync(uiDir)
  .filter((name) => /^[A-Z].*\.tsx$/.test(name) && !/\.test\.tsx$/.test(name))
  .map((name) => name.replace(/\.tsx$/, ''));

const keys = readdirSync(bookDir)
  .filter((name) => /^demos.*\.tsx$/.test(name))
  .flatMap((name) => [...readFileSync(join(bookDir, name), 'utf8').matchAll(/^\s*'([A-Z][A-Za-z0-9]*)'\s*:/gm)].map((match) => match[1]));

const errors = [
  ...components.filter((name) => !keys.includes(name)).map((name) => `Missing demo for components/ui/${name}.tsx`),
  ...keys.filter((key) => !components.includes(key)).map((key) => `Demo key "${key}" has no components/ui/${key}.tsx`),
  ...keys.filter((key, index) => keys.indexOf(key) !== index).map((key) => `Duplicate demo key "${key}"`),
];

if (errors.length > 0) {
  console.error('Design book coverage failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Design book coverage passed: ${components.length} component(s), ${keys.length} demo(s).`);
