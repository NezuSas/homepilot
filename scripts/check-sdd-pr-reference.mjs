const body = process.env.PR_BODY ?? '';
const hasSpec = /Spec primaria:\s*`?specs\/[\w.-]+\.md`?/i.test(body);
const isNonFunctional = /Spec primaria:\s*N\/A\s*\(no funcional\)/i.test(body);
if (!hasSpec && !isNonFunctional) {
  console.error('La PR debe declarar una spec primaria o N/A (no funcional).');
  process.exit(1);
}
if (hasSpec && !/AC-\d+:/i.test(body)) {
  console.error('La PR funcional debe declarar evidencia identificada por AC-##.');
  process.exit(1);
}
