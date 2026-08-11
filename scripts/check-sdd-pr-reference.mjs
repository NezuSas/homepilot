import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const body = process.env.PR_BODY ?? '';
const root = process.cwd();
const primarySpecMatch = body.match(/Spec primaria:\s*`?(specs\/[\w.-]+\.md)`?/i);
const isNonFunctional = /Spec primaria:\s*N\/A\s*\(no funcional\)/i.test(body);

if (!primarySpecMatch && !isNonFunctional) {
  console.error('La PR debe declarar una spec primaria o N/A (no funcional).');
  process.exit(1);
}
if (isNonFunctional) process.exit(0);

const specRelativePath = primarySpecMatch[1];
const specPath = resolve(root, specRelativePath);
const specsDirectory = resolve(root, 'specs');
const specPathRelativeToDirectory = relative(specsDirectory, specPath);
if (isAbsolute(specPathRelativeToDirectory) || specPathRelativeToDirectory.startsWith('..') || !existsSync(specPath)) {
  console.error(`La spec primaria no existe: ${specRelativePath}`);
  process.exit(1);
}

const spec = readFileSync(specPath, 'utf8');
const status = spec.match(/^\*\*Estado:\*\*\s*(.+)$/m)?.[1]?.trim();
if (status !== 'Aprobado' && status !== 'Implementado') {
  console.error(`La spec primaria debe estar Aprobada o Implementada; estado actual: ${status ?? 'ausente'}.`);
  process.exit(1);
}

const declaredAcceptanceCriteria = new Set([...spec.matchAll(/\bAC-?(\d+)\b/gi)].map((match) => Number.parseInt(match[1], 10)));
const evidenceCriteria = [...body.matchAll(/\bAC-(\d+)\s*:/gi)].map((match) => Number.parseInt(match[1], 10));
if (evidenceCriteria.length === 0) {
  console.error('La PR funcional debe declarar evidencia identificada por AC-##.');
  process.exit(1);
}

const unknownCriteria = evidenceCriteria.filter((criterion) => !declaredAcceptanceCriteria.has(criterion));
if (unknownCriteria.length > 0) {
  console.error(`La evidencia referencia AC inexistentes en ${specRelativePath}: ${unknownCriteria.map((criterion) => `AC-${criterion}`).join(', ')}.`);
  process.exit(1);
}