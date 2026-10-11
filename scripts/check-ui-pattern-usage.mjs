// Operator Console shared-pattern usage (specs/operator-console-pattern-adoption-v1.md).
// Finds UI patterns that a shared component already owns but that are rebuilt by hand
// outside components/ui. The count per file and rule may only go down: it is compared with
// scripts/ui-pattern-baseline.json, so new hand-built copies fail while migration proceeds.
//   --report          print the findings without failing
//   --by-file         group the report by file
//   --write-baseline  rewrite the baseline from the current findings (only after a migration)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const reportOnly = process.argv.includes('--report');
const byFile = process.argv.includes('--by-file');
const writeBaseline = process.argv.includes('--write-baseline');
const srcDir = join(root, 'apps', 'operator-console', 'src');
const baselinePath = join(root, 'scripts', 'ui-pattern-baseline.json');
const uiSegment = `${sep}components${sep}ui${sep}`;

/**
 * Each rule: the shared component that should own the pattern, and a predicate over a JSX
 * element (tag name + the static text of its className/class attribute).
 * Decorative layers (`pointer-events-none`) and overlays on video/photos (`bg-black`,
 * `bg-white`) are not patterns of the design system and are skipped.
 */
const rules = [
  {
    id: 'heading',
    use: 'Heading / SectionHeader',
    test: (tag) => /^h[1-4]$/.test(tag),
  },
  {
    id: 'card',
    use: 'Card',
    test: (tag, cls) => /\brounded-(card|section|panel|xl|2xl|control)\b/.test(cls) && /\bborder\b/.test(cls) && /\bbg-(card|popover)(\/\d+)?\b/.test(cls) && !/\bpointer-events-none\b/.test(cls),
  },
  {
    id: 'chip',
    use: 'StatusPill',
    test: (tag, cls) => /\brounded-full\b/.test(cls) && /\bborder\b/.test(cls) && /\bpx-\d/.test(cls) && /\btext-/.test(cls) && !/\bbg-(black|white)\b|\bbg-(black|white)\//.test(cls),
  },
  {
    id: 'banner',
    use: 'AlertBanner',
    test: (tag, cls) => /\bborder-(danger|warning|success|primary)\/\d+/.test(cls) && /\bbg-(danger|warning|success|primary)\/\d+/.test(cls) && /\brounded/.test(cls) && /\bp[xy]?-\d/.test(cls),
  },
  {
    id: 'empty-state',
    use: 'EmptyState',
    test: (tag, cls) => /\bborder-dashed\b/.test(cls) && /\brounded/.test(cls),
  },
  {
    id: 'spinner',
    use: 'LoadingState / Button isLoading',
    test: (tag, cls) => /\banimate-spin\b/.test(cls),
  },
  {
    id: 'skeleton',
    use: 'ComponentSkeletons / DashboardCardSkeleton',
    test: (tag, cls) => /\banimate-pulse\b/.test(cls) && /\bbg-muted/.test(cls),
  },
  {
    id: 'overlay',
    use: 'Modal / Drawer',
    test: (tag, cls) => /\bfixed\b/.test(cls) && /\binset-0\b/.test(cls) && /\bz-\[?\d+/.test(cls) && !/\bpointer-events-none\b/.test(cls),
  },
];

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(path);
  return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
});

function staticClassText(attribute) {
  const initializer = attribute.initializer;
  if (!initializer) return '';
  const pieces = [];
  const collect = (node) => {
    if (ts.isStringLiteralLike(node)) pieces.push(node.text);
    else if (ts.isTemplateExpression(node)) {
      pieces.push(node.head.text);
      node.templateSpans.forEach((span) => { pieces.push(span.literal.text); collect(span.expression); });
    } else ts.forEachChild(node, collect);
  };
  collect(initializer);
  return pieces.join(' ');
}

const findings = [];
for (const file of walk(srcDir)) {
  if (file.includes(uiSegment)) continue;
  const rel = relative(root, file).split(sep).join('/');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      // Only intrinsic elements: a capitalised tag is already a component.
      if (/^[a-z]/.test(tag)) {
        const classAttr = node.attributes.properties.find((attr) => ts.isJsxAttribute(attr) && ['className', 'class'].includes(attr.name.getText(source)));
        const cls = classAttr ? staticClassText(classAttr) : '';
        for (const rule of rules) {
          if (rule.test(tag, cls)) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            findings.push({ rule: rule.id, use: rule.use, file: rel, line: line + 1, tag });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

/** file -> rule -> count */
const counts = {};
for (const finding of findings) {
  counts[finding.file] ??= {};
  counts[finding.file][finding.rule] = (counts[finding.file][finding.rule] ?? 0) + 1;
}

if (writeBaseline) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Baseline written: ${findings.length} finding(s) in ${Object.keys(sorted).length} file(s).`);
  process.exit(0);
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};
const regressions = [];
let improved = 0;
for (const [file, perRule] of Object.entries(counts)) {
  for (const [rule, count] of Object.entries(perRule)) {
    const allowed = baseline[file]?.[rule] ?? 0;
    if (count > allowed) regressions.push(`${file}: ${rule} ${count} > ${allowed}`);
  }
}
for (const [file, perRule] of Object.entries(baseline)) {
  for (const [rule, allowed] of Object.entries(perRule)) {
    if ((counts[file]?.[rule] ?? 0) < allowed) improved += allowed - (counts[file]?.[rule] ?? 0);
  }
}

const perRuleTotals = Object.fromEntries(rules.map((rule) => [rule.id, findings.filter((finding) => finding.rule === rule.id).length]));
if (byFile) {
  for (const [file, perRule] of Object.entries(counts).sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0))) {
    const lines = findings.filter((finding) => finding.file === file).map((finding) => `${finding.rule}@${finding.line}`);
    console.log(`${String(lines.length).padStart(3)}  ${file}  ${lines.join(' ')}`);
  }
} else {
  for (const rule of rules) console.log(`${rule.id.padEnd(12)} -> ${rule.use.padEnd(42)} ${perRuleTotals[rule.id]}`);
}
console.log(`Pattern findings: ${findings.length} in ${Object.keys(counts).length} file(s); regressions: ${regressions.length}; below baseline: ${improved}`);
if (improved > 0) console.log('Some counts are below the baseline: run with --write-baseline to lock the improvement.');

// Every file that keeps a hand-built pattern must say why (exceptions are documented, not silent).
const exceptionsPath = join(root, 'scripts', 'ui-pattern-exceptions.json');
const reasons = existsSync(exceptionsPath) ? JSON.parse(readFileSync(exceptionsPath, 'utf8')) : {};
for (const file of Object.keys(counts)) {
  if (!reasons[file]) regressions.push(`${file}: remaining pattern has no documented reason in scripts/ui-pattern-exceptions.json`);
}
for (const file of Object.keys(reasons)) {
  if (!counts[file]) regressions.push(`${file}: stale exception reason; remove it from scripts/ui-pattern-exceptions.json`);
}

if (regressions.length > 0 && !reportOnly) {
  console.error('Shared pattern usage failed: use the shared component instead of rebuilding the pattern by hand.');
  for (const regression of regressions) console.error(`- ${regression}`);
  process.exitCode = 1;
}
