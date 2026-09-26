import { spawn } from 'node:child_process';

const host = '127.0.0.1';
const port = '4173';
const baseUrl = `http://${host}:${port}`;

function run(command, args, options = {}) {
  return spawn(command, args, { stdio: 'inherit', ...options });
}

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The local Vite process is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Responsive test server did not become ready at ${baseUrl}.`);
}

function stopProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    const killer = run('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    killer.unref();
    return;
  }
  child.kill('SIGTERM');
}

const vite = run(process.execPath, ['../../node_modules/vite/bin/vite.js', '--host', host, '--port', port], {
  cwd: 'apps/operator-console',
});
let exitCode = 1;

try {
  await waitForServer();
  const playwright = run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'apps/operator-console/playwright.config.ts', ...process.argv.slice(2)], {
    env: { ...process.env, HOMEPILOT_RESPONSIVE_SERVER_MANAGED: 'true' },
  });
  exitCode = await new Promise((resolve) => playwright.once('exit', (code) => resolve(code ?? 1)));
} finally {
  stopProcessTree(vite);
}

process.exit(exitCode);
