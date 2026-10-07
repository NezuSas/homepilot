import { spawn } from 'node:child_process';

const host = '127.0.0.1';
const port = 4173;
const baseUrl = `http://${host}:${port}`;
const uiDirectory = 'apps/operator-console';
const clockContractPattern = 'Clock size contract';
const forwardedArgs = process.argv.slice(2);

function run(command, args, options = {}) {
  return spawn(command, args, {
    stdio: 'inherit',
    ...options,
  });
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      resolve({
        code: code ?? 1,
        signal,
      });
    });
  });
}

async function waitForPreview(child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Vite Preview exited before becoming ready with code ${child.exitCode}.`,
      );
    }

    try {
      const response = await fetch(baseUrl);

      if (response.ok) {
        const html = await response.text();

        if (html.includes('/assets/')) {
          return;
        }
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(
    `Production preview did not become ready at ${baseUrl}.`,
  );
}

async function stopProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    const killer = run(
      'taskkill',
      ['/pid', String(child.pid), '/t', '/f'],
      { stdio: 'ignore' },
    );

    try {
      await waitForExit(killer);
    } catch {}

    return;
  }

  child.kill('SIGTERM');

  try {
    await waitForExit(child);
  } catch {}
}

function runNpm(args) {
  const npmExecPath = process.env.npm_execpath;

  if (npmExecPath) {
    return run(process.execPath, [npmExecPath, ...args]);
  }

  return run(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args,
    process.platform === 'win32'
      ? { shell: true }
      : {},
  );
}

function runPlaywright(args, env) {
  return run(
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'apps/operator-console/playwright.config.ts',
      ...args,
    ],
    { env },
  );
}

function splitForwardedArgs(args) {
  const passThrough = [];
  let grep = null;
  let grepInvert = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--grep' || argument === '-g') {
      if (index + 1 >= args.length) {
        throw new Error(argument + ' requires a pattern.');
      }

      grep = args[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith('--grep=')) {
      grep = argument.slice('--grep='.length);
      continue;
    }

    if (argument === '--grep-invert') {
      if (index + 1 >= args.length) {
        throw new Error('--grep-invert requires a pattern.');
      }

      grepInvert = args[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith('--grep-invert=')) {
      grepInvert = argument.slice('--grep-invert='.length);
      continue;
    }

    passThrough.push(argument);
  }

  return {
    passThrough,
    grep,
    grepInvert,
  };
}

function combinePositivePatterns(requiredPattern, forwardedPattern) {
  if (!forwardedPattern) return requiredPattern;

  return '(?=.*(?:' + requiredPattern + '))'
    + '(?=.*(?:' + forwardedPattern + ')).*';
}

function combineNegativePatterns(requiredPattern, forwardedPattern) {
  return forwardedPattern
    ? '(?:' + requiredPattern + ')|(?:' + forwardedPattern + ')'
    : requiredPattern;
}

async function capturePlaywright(args, env) {
  const child = run(
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'apps/operator-console/playwright.config.ts',
      ...args,
    ],
    {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const result = await waitForExit(child);

  return {
    ...result,
    stdout,
    stderr,
  };
}

async function resolveResponsiveSelection() {
  const filters = splitForwardedArgs(forwardedArgs);

  if (forwardedArgs.length === 0) {
    return {
      runClock: true,
      runDevelopment: true,
      clockArgs: [
        '--grep',
        clockContractPattern,
      ],
      developmentArgs: [
        '--grep-invert',
        clockContractPattern,
      ],
    };
  }

  const discoveryEnvironment = {
    ...process.env,
    HOMEPILOT_RESPONSIVE_SERVER_MANAGED: 'true',
  };

  const discovery = await capturePlaywright(
    [
      ...forwardedArgs,
      '--list',
      '--reporter=list',
    ],
    discoveryEnvironment,
  );

  if (discovery.code !== 0) {
    if (discovery.stdout) process.stdout.write(discovery.stdout);
    if (discovery.stderr) process.stderr.write(discovery.stderr);

    throw new Error(
      'Playwright could not resolve the forwarded responsive-test arguments.',
    );
  }

  const testLines = discovery.stdout
    .split(/\r?\n/)
    .filter((line) =>
      /\.spec\.[cm]?[jt]sx?:\d+:\d+\s+›/.test(line),
    );

  if (testLines.length === 0) {
    if (discovery.stdout) process.stdout.write(discovery.stdout);

    throw new Error(
      'No responsive tests matched the forwarded Playwright arguments.',
    );
  }

  const runClock = testLines.some((line) =>
    line.includes(clockContractPattern),
  );

  const runDevelopment = testLines.some((line) =>
    !line.includes(clockContractPattern),
  );

  const clockArgs = [
    ...filters.passThrough,
    '--grep',
    combinePositivePatterns(clockContractPattern, filters.grep),
  ];

  if (filters.grepInvert) {
    clockArgs.push(
      '--grep-invert',
      filters.grepInvert,
    );
  }

  const developmentArgs = [
    ...filters.passThrough,
  ];

  if (filters.grep) {
    developmentArgs.push(
      '--grep',
      filters.grep,
    );
  }

  developmentArgs.push(
    '--grep-invert',
    combineNegativePatterns(clockContractPattern, filters.grepInvert),
  );

  console.log('');
  console.log(
    'Responsive selection: '
      + (runClock ? 'production-clock ' : '')
      + (runDevelopment ? 'development' : ''),
  );

  return {
    runClock,
    runDevelopment,
    clockArgs,
    developmentArgs,
  };
}

async function runClockContractPhase(playwrightArgs) {
  console.log('');
  console.log('=== Responsive tests: production Clock contract ===');
  console.log('');

  const build = runNpm([
    'run',
    'build',
    '--prefix',
    uiDirectory,
  ]);

  const buildResult = await waitForExit(build);

  if (buildResult.code !== 0) {
    return buildResult.code;
  }

  let preview = null;
  let playwright = null;

  try {
    preview = run(
      process.execPath,
      [
        '../../node_modules/vite/bin/vite.js',
        'preview',
        '--host',
        host,
        '--port',
        String(port),
        '--strictPort',
      ],
      {
        cwd: uiDirectory,
      },
    );

    await waitForPreview(preview);

    playwright = runPlaywright(
      playwrightArgs,
      {
        ...process.env,
        HOMEPILOT_RESPONSIVE_SERVER_MANAGED: 'true',
      },
    );

    const result = await Promise.race([
      waitForExit(playwright).then((value) => ({
        process: 'playwright',
        ...value,
      })),
      waitForExit(preview).then((value) => ({
        process: 'preview',
        ...value,
      })),
    ]);

    if (result.process === 'preview') {
      throw new Error(
        `Vite Preview exited during Clock contract tests with code ${result.code}.`,
      );
    }

    return result.code;
  } finally {
    await stopProcessTree(playwright);
    await stopProcessTree(preview);
  }
}

async function runDevelopmentPhase(playwrightArgs) {
  console.log('');
  console.log('=== Responsive tests: development application suite ===');
  console.log('');

  const env = {
    ...process.env,
  };

  delete env.HOMEPILOT_RESPONSIVE_SERVER_MANAGED;

  const playwright = runPlaywright(
    playwrightArgs,
    env,
  );

  const result = await waitForExit(playwright);

  return result.code;
}

let exitCode = 1;

try {
  const selection = await resolveResponsiveSelection();

  let clockExitCode = 0;

  if (selection.runClock) {
    clockExitCode = await runClockContractPhase(
      selection.clockArgs,
    );
  } else {
    console.log('');
    console.log(
      '=== Responsive tests: production Clock contract skipped ===',
    );
  }

  if (clockExitCode !== 0) {
    exitCode = clockExitCode;
  } else if (selection.runDevelopment) {
    exitCode = await runDevelopmentPhase(
      selection.developmentArgs,
    );
  } else {
    console.log('');
    console.log(
      '=== Responsive tests: development application suite skipped ===',
    );
    exitCode = 0;
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.stack ?? error.message
      : error,
  );

  exitCode = 1;
}

process.exitCode = exitCode;
