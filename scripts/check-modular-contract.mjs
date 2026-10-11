// Operator Console modular contract (specs/operator-console-modular-contract-v1.md).
// Measures each modular component against C1-C6. Fails on any violation that is
// not listed in `exceptions` with a reason. Use --report to print without failing.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';
import { modularComponentsOutsideUi } from './modular-components.mjs';

const root = process.cwd();
const reportOnly = process.argv.includes('--report');
const srcDir = join(root, 'apps', 'operator-console', 'src');
const uiDir = join(srcDir, 'components', 'ui');
const docsDir = join(root, 'docs', 'components');

/** component -> { rule -> reason }. A rule listed here is not enforced for that component. */
const exceptions = {
  ComponentSkeletons: { C2: 'Collection of independent skeleton compositions, not a single native-element wrapper.' },
};

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name === 'node_modules' || entry.name === 'dist') return [];
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});

const allFiles = [...walk(srcDir), ...walk(join(root, 'apps', 'operator-console', 'tests'))];
const testFiles = allFiles.filter((file) => /\.test\.tsx?$/.test(file));
const testSources = testFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const barrelPath = join(uiDir, 'index.ts');
const barrel = existsSync(barrelPath) ? readFileSync(barrelPath, 'utf8') : '';

const uiComponents = readdirSync(uiDir)
  .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
  .map((name) => ({ name: name.replace(/\.tsx$/, ''), path: join(uiDir, name), inUi: true }));
const domainComponents = modularComponentsOutsideUi
  .map((name) => ({ name, path: join(srcDir, 'components', `${name}.tsx`), inUi: false }))
  .filter((component) => existsSync(component.path));
const components = [...uiComponents, ...domainComponents].sort((a, b) => a.name.localeCompare(b.name));

function importedModules(source) {
  const sf = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const modules = [];
  sf.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) modules.push(node.moduleSpecifier.text);
  });
  return { sf, modules };
}

function evaluate(component) {
  const source = readFileSync(component.path, 'utf8');
  const { modules } = importedModules(source);
  const result = {};
  // C1: composes className through cn()
  result.C1 = /\bclassName\b/.test(source) && modules.some((m) => /lib\/utils$/.test(m)) && /\bcn\(/.test(source);
  // C2: native element contract (forwardRef or native attributes) or no native wrapper
  result.C2 = /forwardRef|HTMLAttributes|ComponentProps(?:WithoutRef|WithRef)?<|ButtonHTMLAttributes|InputHTMLAttributes/.test(source);
  // C3: presentational only
  const importsStore = modules.some((m) => /(^|\/)stores\//.test(m));
  const importsI18n = modules.some((m) => /^(react-i18next|i18next)$/.test(m)) || /\buseTranslation\b|\bi18n\b/.test(source);
  const fetches = /\bfetch\(|\bapiFetch\b/.test(source);
  result.C3 = !importsStore && !importsI18n && !fetches;
  // C4: an own test imports the component
  const importPattern = new RegExp(`from ['"][^'"]*/${component.name}['"]`);
  result.C4 = importPattern.test(testSources);
  // C5: documented
  result.C5 = existsSync(join(docsDir, `${component.name}.md`));
  // C6: exported from the barrel (components/ui only)
  result.C6 = component.inUi ? new RegExp(`from ['"]\\./${component.name}['"]`).test(barrel) : null;
  return result;
}

const RULES = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
const labels = { C1: 'className+cn', C2: 'native contract', C3: 'presentational', C4: 'own test', C5: 'docs', C6: 'barrel' };
let violations = 0;
let waived = 0;
const rows = [];

for (const component of components) {
  const result = evaluate(component);
  const failed = [];
  for (const rule of RULES) {
    if (result[rule] === null || result[rule] === true) continue;
    if (exceptions[component.name]?.[rule]) { waived += 1; continue; }
    failed.push(rule);
  }
  violations += failed.length;
  rows.push({ name: component.name, location: relative(root, component.path).split(sep).join('/'), result, failed });
}

const pad = (text, size) => String(text).padEnd(size);
console.log(`Modular contract: ${components.length} component(s). Rules: ${RULES.map((rule) => `${rule}=${labels[rule]}`).join(', ')}`);
console.log(pad('Component', 26) + RULES.map((rule) => pad(rule, 4)).join(''));
for (const row of rows) {
  const marks = RULES.map((rule) => pad(row.result[rule] === null ? '-' : row.result[rule] ? 'ok' : (exceptions[row.name]?.[rule] ? 'ex' : 'X'), 4)).join('');
  console.log(pad(row.name, 26) + marks);
}
const perRule = Object.fromEntries(RULES.map((rule) => [rule, rows.filter((row) => row.failed.includes(rule)).length]));
console.log(`Violations: ${violations} (${RULES.map((rule) => `${rule}:${perRule[rule]}`).join(' ')}); waived: ${waived}`);

if (violations > 0 && !reportOnly) {
  console.error('Modular contract failed. Fix the components or add a documented exception.');
  process.exitCode = 1;
} else if (violations === 0) {
  console.log('Modular contract passed.');
}
