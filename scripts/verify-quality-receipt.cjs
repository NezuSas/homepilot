const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const STAGES = ['verify:ci', 'test:responsive'];
const ENV_KEYS = ['CI', 'NODE_ENV', 'NODE_OPTIONS', 'TZ', 'LANG', 'LC_ALL',
  'PLAYWRIGHT_BROWSERS_PATH', 'HOMEPILOT_RESPONSIVE_SERVER_MANAGED'];

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function listFiles(root) {
  return git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .split('\0').filter(Boolean);
}

function fingerprint(root, files = listFiles(root), env = process.env) {
  const hash = createHash('sha256');
  const add = value => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    hash.update(`${bytes.length}:`);
    hash.update(bytes);
  };
  add(JSON.stringify({ version: VERSION, node: process.version,
    platform: process.platform, arch: process.arch,
    environment: ENV_KEYS.map(key => [key, env[key] ?? '']) }));
  for (const file of [...new Set(files)].sort()) {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) {
      throw new Error('Ruta fuera del repositorio; validación abortada.');
    }
    add(file);
    if (!fs.existsSync(absolute)) { add('missing'); continue; }
    const stat = fs.lstatSync(absolute);
    add(stat.isSymbolicLink() ? 'symlink' : 'file');
    add(stat.isSymbolicLink() ? fs.readlinkSync(absolute) : fs.readFileSync(absolute));
  }
  // Installed dependency lock and npm itself are local inputs, not committed evidence.
  for (const file of ['node_modules/.package-lock.json', env.npm_execpath]) {
    if (!file) continue;
    const absolute = path.resolve(root, file);
    add(fs.existsSync(absolute) ? fs.readFileSync(absolute) : 'missing dependency input');
  }
  const playwrightPath = path.join(root, 'node_modules/playwright');
  if (fs.existsSync(playwrightPath)) {
    const playwright = require(playwrightPath);
    for (const name of ['chromium', 'firefox', 'webkit']) {
      const executable = playwright[name].executablePath();
      const stat = fs.existsSync(executable) ? fs.statSync(executable) : null;
      add(JSON.stringify([name, executable, stat?.size ?? null, stat?.mtimeMs ?? null]));
    }
  }
  return hash.digest('hex');
}

function checkReceipt(receipt, digest, now = Date.now()) {
  if (!receipt || receipt.version !== VERSION || receipt.digest !== digest ||
      JSON.stringify(receipt.stages) !== JSON.stringify(STAGES) ||
      !Number.isFinite(receipt.completedAt) || receipt.completedAt > now ||
      now - receipt.completedAt > MAX_AGE_MS) {
    throw new Error('Validación completa ausente, caducada o de otro código/entorno. Ejecuta npm run verify:quality y vuelve a intentar el push.');
  }
}

function validate(root, receiptPath, { snapshot = () => fingerprint(root), run, now = Date.now } = {}) {
  // A failed/interrupted retry must never leave a previously valid receipt.
  fs.rmSync(receiptPath, { force: true });
  const before = snapshot();
  for (const stage of STAGES) run(stage);
  if (snapshot() !== before) {
    throw new Error('El código o entorno cambió durante las pruebas; no se registró evidencia.');
  }
  const receipt = { version: VERSION, digest: before, stages: STAGES, completedAt: now() };
  const temporary = `${receiptPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(receipt)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, receiptPath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return receipt;
}

function checkPushTargets(input, head) {
  for (const line of input.trim().split('\n').filter(Boolean)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 4) throw new Error('Referencia de push inválida.');
    const localSha = parts[1];
    if (/^0+$/.test(localSha)) continue; // A ref deletion publishes no source tree.
    if (localSha !== head) throw new Error('El push contiene otra revisión distinta de HEAD; valida y publica esa revisión por separado.');
  }
}

function main(args) {
  if (args.length !== 1 || !['--validate', '--check-push'].includes(args[0])) {
    throw new Error('Uso: verify-quality-receipt.cjs --validate | --check-push. No se admiten filtros de pruebas.');
  }
  const root = path.resolve(__dirname, '..');
  const receiptPath = path.resolve(root, git(root, ['rev-parse', '--git-path', 'homepilot-quality-receipt.json']).trim());
  if (args[0] === '--validate') {
    const npmPath = process.env.npm_execpath;
    if (!npmPath || !fs.existsSync(npmPath)) throw new Error('Ejecuta mediante npm run verify:quality.');
    validate(root, receiptPath, { run: stage => execFileSync(process.execPath,
      [npmPath, 'run', stage], { cwd: root, stdio: 'inherit' }) });
    console.log('Validación completa registrada durante 24 horas para este código y entorno. El push no repetirá las suites.');
  } else {
    checkPushTargets(fs.readFileSync(0, 'utf8'), git(root, ['rev-parse', 'HEAD']).trim());
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { cwd: root });
    if (git(root, ['ls-files', '--others', '--exclude-standard']).trim()) {
      throw new Error('Hay archivos sin seguimiento; registra o retira los archivos antes de publicar.');
    }
    const receipt = fs.existsSync(receiptPath) ? JSON.parse(fs.readFileSync(receiptPath, 'utf8')) : null;
    checkReceipt(receipt, fingerprint(root));
    console.log('Evidencia completa vigente: suites no repetidas. Se comprobará el runtime actual.');
  }
}

module.exports = { fingerprint, checkReceipt, validate, checkPushTargets, MAX_AGE_MS };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudo comprobar la validación completa.');
    process.exitCode = 1;
  }
}
