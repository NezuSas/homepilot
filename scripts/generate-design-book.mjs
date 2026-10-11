// Generates the printable design book (specs/operator-console-design-book-v1.md).
// Every shared component of components/ui is captured full-screen from the dev-only gallery
// (apps/operator-console/design-book.html) on each device and theme; the layout module draws each
// capture inside a device (phone, tablet, kiosk, monitor) and the result is printed to a PDF.
//   node scripts/generate-design-book.mjs                 full book
//   node scripts/generate-design-book.mjs --only Button   one component
//   node scripts/generate-design-book.mjs --no-pdf        captures and HTML only
//   node scripts/generate-design-book.mjs --reuse         rebuild HTML/PDF from existing captures
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildBookHtml } from './design-book-layout.mjs';

const root = process.cwd();
const consoleDir = join(root, 'apps', 'operator-console');
const uiDir = join(consoleDir, 'src', 'components', 'ui');
const outDir = join(root, 'docs', 'design-book');
const imgDir = join(outDir, 'img');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const noPdf = args.includes('--no-pdf');
const reuse = args.includes('--reuse');
const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}`;

/** Device matrix in CSS pixels (the formats of the responsive suite and the wall kiosk). */
const devices = [
  { id: 'celular-vertical', width: 390, height: 844, scale: 2, touch: true },
  { id: 'celular-horizontal', width: 844, height: 390, scale: 2, touch: true },
  { id: 'tableta-vertical', width: 768, height: 1024, scale: 1, touch: true },
  { id: 'tableta-horizontal', width: 1024, height: 768, scale: 1, touch: true },
  { id: 'kiosko-vertical', width: 1080, height: 1920, scale: 1, touch: true },
  { id: 'kiosko-horizontal', width: 1920, height: 1080, scale: 1, touch: true },
  { id: 'escritorio', width: 1440, height: 900, scale: 1, touch: false },
];
const themes = ['dark', 'light'];

const components = readdirSync(uiDir)
  .filter((name) => /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name))
  .map((name) => name.replace(/\.tsx$/, ''))
  .sort((a, b) => a.localeCompare(b));
const selected = only ? components.filter((name) => name === only) : components;
if (selected.length === 0) {
  console.error(`Unknown component: ${only}`);
  process.exit(1);
}
const purposes = JSON.parse(readFileSync(join(root, 'scripts', 'design-book-purposes.json'), 'utf8'));

function readVariants() {
  const catalogPath = join(root, 'docs', 'design-system-catalog.md');
  const map = {};
  if (!existsSync(catalogPath)) return map;
  const part = readFileSync(catalogPath, 'utf8').replace(/\r/g, '').split('## Components')[1] ?? '';
  for (const block of part.split(/\n### /).slice(1)) {
    const [name, ...rest] = block.split('\n');
    map[name.trim()] = [...rest.join('\n').matchAll(/^\| `([a-zA-Z]+)` \| (.+) \|$/gm)].map((m) => `${m[1]}: ${m[2].replace(/`/g, '')}`);
  }
  return map;
}

async function startVite() {
  const child = spawn(process.execPath, ['../../node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: consoleDir, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited early (${child.exitCode}):\n${output.slice(-600)}`);
    try {
      const response = await fetch(`${BASE}/design-book.html`);
      if (response.ok) return child;
    } catch { /* not ready yet */ }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  child.kill();
  throw new Error(`Vite did not serve ${BASE}/design-book.html in time:\n${output.slice(-600)}`);
}

/** Opens a gallery URL and waits for it to be ready, retrying: Vite may stall while it optimizes dependencies. */
async function openGallery(page, url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(url, { timeout: 60_000 });
      await page.waitForFunction(() => window.__bookReady === true, null, { timeout: 30_000 });
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`retrying ${url} (${attempt}/3)`);
    }
  }
}

async function capture(manifest) {
  const require = createRequire(join(consoleDir, 'package.json'));
  const { chromium } = require('@playwright/test');
  const vite = await startVite();
  const browser = await chromium.launch();
  try {
    for (const device of devices) {
      for (const theme of themes) {
        const context = await browser.newContext({
          viewport: { width: device.width, height: device.height },
          deviceScaleFactor: device.scale,
          hasTouch: device.touch,
          isMobile: device.touch,
          colorScheme: theme === 'light' ? 'light' : 'dark',
        });
        const page = await context.newPage();
        for (const name of selected) {
          await openGallery(page, `${BASE}/design-book.html?theme=${theme}&only=${name}`);
          const openSelector = await page.locator(`section[data-book-component="${name}"]`).getAttribute('data-book-open');
          if (openSelector) {
            await page.locator(openSelector).first().click();
            await page.waitForTimeout(250);
          }
          await page.waitForTimeout(300);
          const dir = join(imgDir, name);
          mkdirSync(dir, { recursive: true });
          const file = join(dir, `${device.id}-${theme}.jpg`);
          await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
          manifest[`${name}/${device.id}-${theme}`] = { file: relative(outDir, file).split('\\').join('/'), width: device.width, height: device.height };
        }
        await context.close();
        console.log(`captured ${device.id} · ${theme} (${selected.length} component(s))`);
      }
    }
  } finally {
    await browser.close();
    vite.kill();
  }
}

async function writePdf(htmlPath) {
  const require = createRequire(join(consoleDir, 'package.json'));
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const pdfPath = join(outDir, 'HomePilot-libro-de-diseno.pdf');
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
    console.log(`PDF written: ${relative(root, pdfPath)}`);
  } finally {
    await browser.close();
  }
}

mkdirSync(outDir, { recursive: true });
const manifestPath = join(outDir, 'manifest.json');
let manifest = {};
if (reuse) {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} else {
  if (!only && existsSync(imgDir)) rmSync(imgDir, { recursive: true, force: true });
  if (only && existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  await capture(manifest);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
const htmlPath = join(outDir, 'index.html');
const { html, pageCount } = buildBookHtml({
  selected: components.filter((name) => Object.keys(manifest).some((key) => key.startsWith(`${name}/`))),
  manifest,
  devices,
  purposes,
  variants: readVariants(),
  date: new Date().toISOString().slice(0, 10),
});
writeFileSync(htmlPath, html);
console.log(`Book HTML written: ${relative(root, htmlPath)} (${pageCount} pages, ${Object.keys(manifest).length} capture(s))`);
if (!noPdf) await writePdf(htmlPath);
