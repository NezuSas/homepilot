import { expect, test } from '@playwright/test';
import { clockSweepPlan } from './clockSweepPlan';
import {
  enterDashboardEdit,
  responsiveDashboard,
  prepareAuthenticatedDashboard,
} from './helpers/responsiveShell';

for (const fallback of [false, true]) {
  test(`Feature: Clock size contract — Scenario: ${fallback ? 'Unsupported queries retain a bounded dial' : 'Default content matrix'} (AC56)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const section = responsiveDashboard.tabs[0]!.widgets[1]!;
    const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [
      { ...section, config: { ...section.config, extra: { ...section.config.extra, cards: [
        { id: 'compat-clock', kind: 'clock_premium', title: 'Reloj', span: 'full', gridOptions: { columns: 12, rows: 6 } },
      ] } } },
      { id: 'compat-independent', type: 'clock_display', config: { layout: { x: 0, y: 0, w: 12, h: 6, span: 1 }, binding: { entityId: '', entityType: 'system' }, visibility: { rules: [], defaultState: 'show' }, appearance: { title: 'Reloj' } } },
    ] }] };
    await prepareAuthenticatedDashboard(page, dashboard);
    await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { current: { temperature_2m: 19, weather_code: 0, wind_speed_10m: 3, time: '2026-10-05T12:34' } } }));
    let removedGuards = 0;
    if (fallback) await page.route('**/assets/*.css', async route => {
      const response = await route.fetch();
      const { default: postcss } = await import('postcss');
      const css = postcss.parse(await response.text());
      // Emulate an engine ignoring unsupported enhancement, not a fake CSS override.
      // This exercises the actual built baseline; it does not certify an old engine.
      css.walkAtRules('supports', rule => {
        if (rule.params.includes('container-type') && rule.params.includes('1cqi')) {
          rule.remove(); removedGuards++;
        }
      });
      await route.fulfill({ response, body: css.toString() });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    await expect(page.locator('[data-homepilot-clock]')).toHaveCount(2);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    expect(await page.locator('script[src*="/assets/"]').count()).toBeGreaterThan(0);
    if (fallback) expect(removedGuards).toBe(1);
    const result = await page.evaluate(({ fallback }) => {
      const originals = [...document.querySelectorAll<HTMLElement>('[data-homepilot-clock]')].map(clock => clock.closest<HTMLElement>('[data-dashboard-card-id],.homepilot-dashboard-widget')!);
      const records: Array<Record<string, unknown>> = [], failures: string[] = [];
      let combinations = 0;
      for (const [path, original] of originals.entries()) {
        const frame = original.cloneNode(true) as HTMLElement;
        frame.style.cssText = 'position:fixed;left:0;top:0;container:clock-card / size;min-height:0;min-width:0;display:grid;';
        frame.style.borderWidth = getComputedStyle(original).borderWidth;
        const host = document.createElement('div'); host.className = 'homepilot-dashboard-screen'; host.append(frame); document.body.append(host);
        // AC56: short/wide cards center the visible group, not a reserved text column.
        if (!fallback) for (const width of [197.333, 300, 700, 906.667]) {
          frame.style.width = `${width}px`; frame.style.height = '104px';
          const dial = frame.querySelector<HTMLElement>('.homepilot-clock-reference-dial-frame')!.getBoundingClientRect();
          const time = frame.querySelector<HTMLElement>('.homepilot-clock-reference-time')!;
          const accessibleTime = frame.querySelector<HTMLElement>('.homepilot-clock-reference-accessible-time')!;
          const bounds = frame.getBoundingClientRect();
          const text = time.getBoundingClientRect();
          const digital = text.height > 0;
          const right = digital ? text.right : dial.right;
          if (Math.abs((dial.left + right) / 2 - (bounds.left + bounds.right) / 2) > 1) failures.push(`visible group centering ${path}/${width}`);
          if ((getComputedStyle(accessibleTime).display !== 'none') === digital) failures.push(`accessible time level ${path}/${width}`);
          if (digital && (Number.parseFloat(getComputedStyle(time).fontSize) > 28 || text.left - dial.right > 16.1)) failures.push(`analog hierarchy ${path}/${width}`);
        }
        for (const sectionWidth of fallback ? [300, 700, 1364] : [243, 244, 300, 700, 1364]) for (const columns of fallback ? [4,5,6,7,8,9,10,11,12] : [12]) for (const rows of fallback ? [4,5,6,7,8] : [6,7]) {
          frame.style.width = `${(sectionWidth + 8) * columns / 12 - 8}px`; frame.style.height = `${rows * 28 - 8}px`;
          const visible = (part: string) => frame.querySelector<HTMLElement>(`.homepilot-clock-reference-${part}`)!.getBoundingClientRect().height > 0;
          const dial = frame.querySelector<HTMLElement>('.homepilot-clock-reference-dial-frame')!.getBoundingClientRect();
          const bounds = frame.getBoundingClientRect();
          const level = Number(getComputedStyle(frame.querySelector<HTMLElement>('.homepilot-clock-reference-main')!).getPropertyValue('--clock-level'));
          const accessibleTime = frame.querySelector<HTMLElement>('.homepilot-clock-reference-accessible-time')!;
          if ((getComputedStyle(accessibleTime).display !== 'none') !== (level === 4)) failures.push(`accessible time ${path}/${sectionWidth}/${columns}/${rows}`);
          combinations++;
          if (!fallback) records.push({ path: path === 0 ? 'section' : 'independent', sectionWidth, columns, rows, level, header: visible('header'), brand: visible('brand'), digital: visible('time'), weekday: visible('weekday'), date: visible('date'), weather: visible('weather') });
          if (fallback && (level !== 4 || visible('details') || visible('header') || visible('brand') || Math.abs(dial.width - 72) > .1 || Math.abs(dial.height - 72) > .1)) failures.push(`fallback content/diameter ${path}/${sectionWidth}/${columns}/${rows}`);
          if (Math.abs(dial.width - dial.height) > .1 || dial.left < bounds.left || dial.top < bounds.top || dial.right > bounds.right + .1 || dial.bottom > bounds.bottom + .1 || frame.scrollWidth > frame.clientWidth + 1 || frame.scrollHeight > frame.clientHeight + 1) failures.push(`geometry ${path}/${sectionWidth}/${columns}/${rows}`);
          for (const element of frame.querySelectorAll<HTMLElement>('.homepilot-clock-reference-layout,.homepilot-clock-reference-brand')) if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) failures.push(`overflow ${path}/${sectionWidth}/${columns}/${rows}`);
          if (!fallback) {
            const expected = sectionWidth >= 244 ? 1 : 2;
            if (level !== expected) failures.push(`content level ${path}/${sectionWidth}/${rows}: ${level}`);
          }
        }
        host.remove();
      }
      return { combinations, records, failures };
    }, { fallback });
    console.log(JSON.stringify({ fallback, ...result }));
    await testInfo.attach('content-evidence.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.failures).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(fallback ? 'fallback.png' : 'content-matrix.png'), animations: 'disabled' });
  });
}

test.describe('Clock geometry sweep', () => {
test.describe.configure({ mode: 'parallel' });
for (const width of [360, 768, 1024, 1440]) {
  const plan = clockSweepPlan(width, Number(process.env.HOMEPILOT_CLOCK_SAMPLE_STEP ?? 1));
  for (const [batchIndex, sampleWidths] of plan.batches.entries()) {
  test(`Feature: Clock size contract — Scenario: Built clock geometry sweep at ${width}px batch ${batchIndex + 1}/${plan.batches.length} (AC56)`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    const section = responsiveDashboard.tabs[0]!.widgets[1]!;
    const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [
      responsiveDashboard.tabs[0]!.widgets[0]!,
      { ...section, config: { ...section.config, extra: { ...section.config.extra, cards: [
        { id: 'clock-manual', kind: 'clock_premium', title: 'Clock manual', span: 'full', gridOptions: { columns: 12, rows: 6 } },
        { id: 'clock-auto', kind: 'clock_premium', title: 'Clock historical auto', span: 'full' },
      ] } } },
      { id: 'clock-independent', type: 'clock_display', config: { layout: { x: 0, y: 0, w: 12, h: 6, span: 1 }, binding: { entityId: '', entityType: 'system' }, visibility: { rules: [], defaultState: 'show' }, appearance: { title: 'Clock independent' } } },
    ] }] };
    await prepareAuthenticatedDashboard(page, dashboard);
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    await expect(page.locator('[data-homepilot-clock]')).toHaveCount(3);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    // This suite must run against vite preview, not a development server.
    expect(await page.locator('script[src*="/assets/"]').count()).toBeGreaterThan(0);
    expect(await page.locator('script[src*="/@vite/client"]').count()).toBe(0);
    const result = await page.evaluate(({ sampleWidths }) => {
      const originals = [...document.querySelectorAll<HTMLElement>('[data-homepilot-clock]')].map(clock => clock.closest<HTMLElement>('[data-dashboard-card-id],.homepilot-dashboard-widget')!);
      const failures: Array<Record<string, unknown>> = [];
      const levels: Record<string, number> = {}; let combinations = 0;
      const parity = new Map<string, string>();
      // Sidebar closed + one Section spanning all slots is the widest case for this viewport.
      // Canvas padding 16px mobile / 32px tablet+, Section padding 40px + grid padding 4px.
      const maxUsefulWidth = Math.max(300, innerWidth - (innerWidth < 640 ? 16 : 32) - 44);
      const paths: Array<{ height: number; type: string; name: string }> = [];
      for (const original of originals) {
      paths.push({ height: original.getBoundingClientRect().height, type: getComputedStyle(original).containerType, name: getComputedStyle(original).containerName });
      const frame = original.cloneNode(true) as HTMLElement;
      frame.style.cssText = 'position:fixed;left:0;top:0;container:clock-card / size;min-height:0;min-width:0;display:grid;';
      frame.style.borderWidth = getComputedStyle(original).borderWidth;
      const host = document.createElement('div'); host.className = 'homepilot-dashboard-screen'; host.append(frame); document.body.append(host);
      for (const sectionWidth of sampleWidths) for (let columns = 4; columns <= 12; columns++) for (let rows = 4; rows <= 8; rows++) {
        const w = (sectionWidth + 8) * columns / 12 - 8, h = rows * 28 - 8;
        frame.style.width = `${w}px`; frame.style.height = `${h}px`;
        const dial = frame.querySelector<HTMLElement>('.homepilot-clock-reference-dial-frame')!;
        const main = frame.querySelector<HTMLElement>('.homepilot-clock-reference-main')!;
        const bounds = frame.getBoundingClientRect(), sphere = dial.getBoundingClientRect();
        const level = Number(getComputedStyle(main).getPropertyValue('--clock-level'));
        // Queries use the content box, not the exterior box (standalone has a border).
        const style = getComputedStyle(frame);
        const cw = w - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth) - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const ch = h - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        const horizontal = cw >= 244 && ch >= 160 ? 1 : cw >= 228 && ch >= 132 ? 2 : cw >= 200 && ch >= 104 ? 3 : 4;
        const vertical = cw >= 146 && ch >= 172 ? 2 : cw >= 94 && ch >= 132 ? 3 : 4;
        const expected = Math.min(horizontal, vertical);
        const arrangement = expected === 4 ? 'solo' : horizontal < vertical || horizontal === vertical && cw / ch > 1.2 ? 'horizontal' : 'vertical';
        const actualArrangement = getComputedStyle(main).getPropertyValue('--clock-arrangement').trim();
        levels[level] = (levels[level] ?? 0) + 1; combinations++;
        let issue = '';
        // cqw resolves to ClockShell's nearer inline-size container; cqh to clock-card.
        const shell = frame.querySelector<HTMLElement>('.homepilot-clock-surface')!;
        const shellStyle = getComputedStyle(shell);
        const inlineBudget = shell.getBoundingClientRect().width - parseFloat(shellStyle.borderLeftWidth) - parseFloat(shellStyle.borderRightWidth);
        const gap = Math.min(16, Math.max(8, inlineBudget * .03));
        const detailWidth = level === 1 ? 144 : level === 2 ? 128 : 100;
        const expectedDiameter = arrangement === 'horizontal'
          ? Math.min(inlineBudget - 18 - detailWidth - gap, ch - 18, inlineBudget * .42, 448)
          : Math.min(inlineBudget - 18, ch - (arrangement === 'vertical' ? level === 2 ? 90 : 54 : 18), 448);
        if (Math.abs(sphere.width - expectedDiameter) > 0.2 || Math.abs(sphere.height - expectedDiameter) > 0.2) issue = 'dial does not fill available budget';
        if (Math.abs(sphere.width - sphere.height) > 0.1 || sphere.width < 70 - 0.1) issue = 'dial not square/readable';
        if (frame.scrollWidth > frame.clientWidth + 1 || frame.scrollHeight > frame.clientHeight + 1) issue = 'card scroll overflow';
        if (sphere.left < bounds.left || sphere.top < bounds.top || sphere.right > bounds.right + 0.1 || sphere.bottom > bounds.bottom + 0.1) issue = 'dial outside card';
        if (level !== expected) issue = 'unexpected level';
        if (actualArrangement !== arrangement) issue = 'not the best feasible arrangement';
        const key = `${sectionWidth}/${columns}/${rows}`, signature = `${level}/${actualArrangement}/${sphere.width.toFixed(1)}`;
        if (parity.has(key) && parity.get(key) !== signature) issue = 'section/independent parity';
        parity.set(key, signature);
        const visible = (selector: string) => frame.querySelector<HTMLElement>(selector)!.getBoundingClientRect().height > 0;
        if (visible('.homepilot-clock-reference-time') !== (level <= 3) || visible('.homepilot-clock-reference-date') !== (level <= 2) || visible('.homepilot-clock-reference-weather') !== (level === 1)) issue = 'content does not match level';
        const details = frame.querySelector<HTMLElement>('.homepilot-clock-reference-details')!.getBoundingClientRect();
        if (arrangement === 'horizontal') {
          if (Math.abs(details.left - sphere.right - gap) > .2) issue = 'excess gap';
          if (Math.abs((sphere.left + details.right) / 2 - (bounds.left + bounds.right) / 2) > .2) issue = 'block not centered';
        }
        if (visible('.homepilot-clock-reference-brand') !== (sphere.width >= 100 - .1)) issue = 'small dial brand policy';
        if (details.width && details.height && Math.min(details.right, sphere.right) - Math.max(details.left, sphere.left) > 1 && Math.min(details.bottom, sphere.bottom) - Math.max(details.top, sphere.top) > 1) issue = 'dial overlaps details';
        const elements = [...frame.querySelectorAll<HTMLElement>('.homepilot-clock-reference-layout,.homepilot-clock-reference-main,.homepilot-clock-reference-details,.homepilot-clock-reference-time,.homepilot-clock-reference-weekday,.homepilot-clock-reference-date,.homepilot-clock-reference-location,.homepilot-clock-reference-temperature,.homepilot-clock-reference-condition,.homepilot-clock-reference-brand')];
        for (const element of elements) {
          const r = element.getBoundingClientRect(); if (!r.width || !r.height) continue;
          if (!element.classList.contains('homepilot-clock-reference-brand') && element.textContent?.trim() && parseFloat(getComputedStyle(element).fontSize) < 12) issue = 'detail font below 12px';
          if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) issue = `overflow ${element.className}`;
          if (r.left < bounds.left - 0.1 || r.top < bounds.top - 0.1 || r.right > bounds.right + 0.1 || r.bottom > bounds.bottom + 0.1) issue = `outside ${element.className}`;
        }
        const leaves = elements.filter(e => !e.querySelector('.homepilot-clock-reference-time,.homepilot-clock-reference-weather-info') && !e.classList.contains('homepilot-clock-reference-layout') && !e.classList.contains('homepilot-clock-reference-main') && !e.classList.contains('homepilot-clock-reference-brand'));
        for (let a = 0; a < leaves.length; a++) for (let b = a + 1; b < leaves.length; b++) {
          const x = leaves[a].getBoundingClientRect(), y = leaves[b].getBoundingClientRect();
          if (x.width && x.height && y.width && y.height && Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1) issue = 'text overlap';
        }
        if (issue && failures.length < 20) failures.push({ sectionWidth, columns, rows, w, h, level, issue, sphere: { w: sphere.width, h: sphere.height } });
      }
      host.remove();
      }
      return { combinations, maxUsefulWidth, levels, failures, paths };
    }, { sampleWidths });
    expect(result.maxUsefulWidth).toBe(plan.maxUsefulWidth);
    expect(result.combinations).toBe(sampleWidths.length * 45 * 3);
    await testInfo.attach('clock-sweep.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    console.log('CLOCK_SWEEP', testInfo.project.name, JSON.stringify({ combinations: result.combinations, failures: result.failures, levels: result.levels }));
    expect(result.failures).toEqual([]);
    for (const path of result.paths) expect(path).toEqual({ height: 160, type: 'size', name: 'clock-card' });
    await page.screenshot({ path: testInfo.outputPath('clock-contract.png'), animations: 'disabled' });
  });
  }
}
});

for (const viewport of [
  { width: 360, height: 800 }, { width: 768, height: 1024 },
  { width: 1024, height: 768 }, { width: 1440, height: 900 },
]) {
  test(`Feature: Clock size contract — Scenario: Visual QA of dashboard and editor at ${viewport.width}px (AC56)`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    await page.clock.setFixedTime(new Date('2026-10-05T17:34:00Z'));
    const section = responsiveDashboard.tabs[0]!.widgets[1]!;
    const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [
      { ...section, config: { ...section.config, extra: { ...section.config.extra, cards: [
        { id: 'visual-qa-clock', kind: 'clock_premium', title: 'Reloj', span: 'full', gridOptions: { columns: 12, rows: 6 } },
      ] } } },
      { id: 'visual-qa-independent', type: 'clock_display', config: {
        layout: { x: 0, y: 1, w: 12, h: 6, span: 1 },
        binding: { entityId: '', entityType: 'system' }, visibility: { rules: [], defaultState: 'show' },
        appearance: { title: 'Reloj', showTitle: true },
      } },
    ] }] };
    await prepareAuthenticatedDashboard(page, dashboard);
    let saved = dashboard;
    await page.route('**/api/v1/dashboards/responsive-dashboard', async route => {
      if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
      await route.fulfill({ json: saved });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    await expect(page.locator('[data-homepilot-clock]')).toHaveCount(2);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const backdrop = page.getByTestId('mobile-sidebar-backdrop');
    if (await backdrop.isVisible()) await backdrop.click({ position: { x: viewport.width - 16, y: 96 } });
    await enterDashboardEdit(page);
    const sectionClock = page.locator('[data-dashboard-card-id="visual-qa-clock"]');
    const independentClock = page.locator('.homepilot-dashboard-widget')
      .filter({ has: page.locator('[data-homepilot-clock]') })
      .filter({ hasNot: page.locator('[data-dashboard-card-id]') });
    const geometry = (clock: import('@playwright/test').Locator) => clock.evaluate(element => {
      let frame: HTMLElement | null = element as HTMLElement;
      while (frame && !getComputedStyle(frame).containerName.split(' ').includes('clock-card')) frame = frame.parentElement;
      if (!frame) throw new Error('Clock has no sizing container');
      const bounds = frame.getBoundingClientRect();
      const dial = element.querySelector<HTMLElement>('.homepilot-clock-reference-dial-frame')!.getBoundingClientRect();
      const main = element.querySelector<HTMLElement>('.homepilot-clock-reference-main')!;
      const previewRegion = element.closest('[role="dialog"]') ? element.closest('[role="region"]')?.getBoundingClientRect() : null;
      const previewFits = !previewRegion || bounds.left >= previewRegion.left - 1 && bounds.top >= previewRegion.top - 1
        && bounds.right <= previewRegion.right + 1 && bounds.bottom <= previewRegion.bottom + 1;
      const tools = element.closest('.homepilot-dashboard-widget')?.querySelector<HTMLElement>('[data-clock-edit-tools]');
      const toolsBounds = tools?.getBoundingClientRect();
      const toolsFit = !toolsBounds || toolsBounds.bottom <= bounds.top - 1
        && toolsBounds.left >= bounds.left - 1 && toolsBounds.right <= bounds.right + 1
        && tools!.scrollWidth <= tools!.clientWidth + 1;
      const scale = bounds.width / frame.offsetWidth;
      const visible = (part: string) => element.querySelector<HTMLElement>(`.homepilot-clock-reference-${part}`)!.getBoundingClientRect().height > 0;
      return {
        width: frame.offsetWidth, height: frame.offsetHeight, dial: dial.width / scale,
        radius: getComputedStyle(element.closest('.homepilot-clock-surface')!).borderTopLeftRadius,
        level: Number(getComputedStyle(main).getPropertyValue('--clock-level')),
        arrangement: getComputedStyle(main).getPropertyValue('--clock-arrangement').trim(),
        digital: visible('time'), date: visible('date'), weather: visible('weather'),
        fits: previewFits && toolsFit && Math.abs(dial.width - dial.height) < 1 && dial.left >= bounds.left - 1 && dial.top >= bounds.top - 1
          && dial.right <= bounds.right + 1 && dial.bottom <= bounds.bottom + 1
          && frame.scrollWidth <= frame.clientWidth + 1 && frame.scrollHeight <= frame.clientHeight + 1,
      };
    });
    const evidence: Array<Record<string, unknown>> = [];
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      for (const [path, card] of [['section', sectionClock], ['independent', independentClock]] as const) {
        for (const [columns, rows] of [[4, 4], [12, 6], [12, 8]]) {
          await card.scrollIntoViewIfNeeded(); await card.hover();
          if (path === 'independent') await expect(card.locator('[data-clock-edit-tools]')).toHaveCount(1);
          await card.getByRole('button', { name: path === 'section' ? /^(Edit|Editar)$/i : /^(Configure|Configurar)$/i }).click();
          const editor = page.getByRole('dialog', { name: /^(Edit|Editar)$/i });
          if (path === 'section') await editor.getByRole('radio', { name: /^(Design|Diseño)$/i }).click();
          await editor.getByRole('gridcell', { name: new RegExp(`: ${columns}, .*: ${rows}$`, 'i') }).click();
          const preview = editor.locator('[data-homepilot-clock]');
          await expect.poll(async () => (await geometry(preview)).fits).toBe(true);
          const before = await geometry(preview);
          const stem = `${viewport.width}-${theme}-${path}-${columns}x${rows}`;
          await editor.screenshot({ path: testInfo.outputPath(`${stem}-editor.png`), animations: 'disabled' });
          await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
          await expect(editor).not.toBeVisible();
          const rendered = card.locator('[data-homepilot-clock]');
          await expect.poll(async () => (await geometry(rendered)).fits).toBe(true);
          await expect.poll(async () => {
            const after = await geometry(rendered);
            return after.level === before.level && after.arrangement === before.arrangement && after.radius === before.radius
              && after.digital === before.digital && after.date === before.date && after.weather === before.weather
              && Math.abs(after.width - before.width) <= 1 && after.height === before.height && Math.abs(after.dial - before.dial) <= 1;
          }).toBe(true);
          const after = await geometry(rendered);
          evidence.push({ viewport, theme, path, columns, rows, preview: before, dashboard: after });
          await card.screenshot({ path: testInfo.outputPath(`${stem}-card.png`), animations: 'disabled' });
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
      await page.screenshot({ path: testInfo.outputPath(`${viewport.width}-${theme}-dashboard.png`), fullPage: true, animations: 'disabled' });
    }
    await testInfo.attach('clock-visual-qa.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  });
}

test('Feature: Clock size contract — Scenario: Contact sheet preserves real dimensions (AC56)', async ({ page }, testInfo) => {
  // WebKit captures 27 independent cards plus the full sheet; geometry has the
  // same assertions, but artifact generation needs more than the default 30s.
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(new Date('2026-10-05T17:34:00Z'));
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [{ ...section,
    config: { ...section.config, extra: { ...section.config.extra, cards: [{ id: 'contact-clock', kind: 'clock_premium', title: 'Reloj', span: 'full', gridOptions: { columns: 12, rows: 6 } }] } },
  }] }] };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { current: { temperature_2m: 19, weather_code: 0, wind_speed_10m: 3, time: '2026-10-05T12:34' } } }));
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await expect(page.locator('[data-homepilot-clock]')).toHaveCount(1);
  await expect(page.locator('.homepilot-clock-reference-temperature')).toHaveText(/19/);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.setViewportSize({ width: 2840, height: 1400 });
  const measurements = await page.evaluate(() => {
    const original = document.querySelector<HTMLElement>('[data-dashboard-card-id="contact-clock"]')!;
    const sheet = document.createElement('main'); sheet.className = 'homepilot-dashboard-screen';
    sheet.style.cssText = 'display:grid;grid-template-columns:1380px 1380px;gap:20px;padding:20px;width:2820px;background:hsl(var(--background));color:hsl(var(--foreground));';
    const measurements: Array<{ columns: number; rows: number; sectionWidth: number; width: number; height: number; level: number; arrangement: string; dial: number; brandFont: number; brandOverflow: boolean }> = [];
    for (const [columns, rows] of [[4,4],[6,4],[8,4],[12,4],[4,6],[6,6],[12,6],[12,7],[12,8]]) for (const sectionWidth of [300,700,1364]) {
      const tile = document.createElement('section'); tile.style.cssText = 'padding:8px;min-width:0;';
      const label = document.createElement('div'); label.style.cssText = 'font:14px/22px Inter,sans-serif;margin-bottom:8px;';
      label.textContent = `${columns}×${rows} · sección ${sectionWidth} px`;
      const frame = original.cloneNode(true) as HTMLElement;
      frame.dataset.contactClock = `${sectionWidth}-${columns}x${rows}`;
      frame.style.cssText = `container:clock-card / size;width:${(sectionWidth + 8) * columns / 12 - 8}px;height:${rows * 28 - 8}px;min-width:0;min-height:0;display:grid;`;
      tile.append(label, frame); sheet.append(tile);
    }
    document.body.replaceChildren(sheet);
    for (const frame of sheet.querySelectorAll<HTMLElement>('[data-contact-clock]')) {
      const [sectionWidth, dimensions] = frame.dataset.contactClock!.split('-');
      const [columns, rows] = dimensions!.split('x').map(Number);
      const bounds = frame.getBoundingClientRect();
      const brand = frame.querySelector<HTMLElement>('.homepilot-clock-reference-brand')!;
      const level = Number(getComputedStyle(frame.querySelector('.homepilot-clock-reference-main')!).getPropertyValue('--clock-level'));
      const arrangement = getComputedStyle(frame.querySelector('.homepilot-clock-reference-main')!).getPropertyValue('--clock-arrangement').trim();
      const label = frame.previousElementSibling!; label.textContent += ` · ${bounds.width.toFixed(2)}×${bounds.height} px · nivel ${level}`;
      measurements.push({ columns: columns!, rows: rows!, sectionWidth: Number(sectionWidth), width: bounds.width, height: bounds.height, level, arrangement, dial: frame.querySelector('.homepilot-clock-reference-dial-frame')!.getBoundingClientRect().width, brandFont: parseFloat(getComputedStyle(brand).fontSize), brandOverflow: brand.scrollWidth > brand.clientWidth + 1 });
    }
    return measurements;
  });
  const folder = process.env.HOMEPILOT_CLOCK_EVIDENCE_DIR ?? testInfo.outputPath('contact');
  for (const entry of measurements) await page.locator(`[data-contact-clock="${entry.sectionWidth}-${entry.columns}x${entry.rows}"]`).screenshot({ path: `${folder}/${entry.sectionWidth}-${entry.columns}x${entry.rows}.png`, animations: 'disabled' });
  await page.screenshot({ path: `${folder}/contact-sheet.png`, fullPage: true, animations: 'disabled' });
  console.log('CLOCK_CONTACT_MEASUREMENTS', JSON.stringify(measurements));
  await testInfo.attach('clock-contact-measurements.json', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
  expect(measurements).toHaveLength(27);
  expect(measurements.every(entry => !entry.brandOverflow && entry.dial >= 70)).toBe(true);
});
