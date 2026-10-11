import { expect, test } from '@playwright/test';
import {
  enterDashboardEdit,
  openSectionEditor,
  viewports,
  portraitKioskViewport,
  dashboardUser,
  responsiveDevices,
  responsiveDashboard,
  prepareAuthenticatedDashboard,
} from './helpers/responsiveShell';

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
  test(`Feature: Weather label single line — Scenario: One icon and inline reading at ${viewport.width} (AC55)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.route('**/api.open-meteo.com/**', route => route.fulfill({ json: { current: { temperature_2m: 19, weather_code: 0, wind_speed_10m: 1 } } }));
    const section = responsiveDashboard.tabs[0].widgets[1];
    const fixture = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [responsiveDashboard.tabs[0].widgets[0], {
      ...section, config: { ...section.config, extra: { badgeRow: true, cards: [
        { id: 'weather-label', kind: 'info_weather', title: 'Clima' },
      ] } },
    }] }] };
    await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [fixture] }));
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const chip = page.locator('[data-dashboard-badge-row] .dashboard-context-chip');
    await expect(chip).toContainText('19°C');
    await expect(chip.locator('svg')).toHaveCount(1);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      const geometry = await chip.evaluate(element => {
        const icon = element.querySelector('svg')!.getBoundingClientRect();
        const text = element.querySelector('span.truncate')!;
        const bounds = text.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(text);
        return { iconCenter: icon.y + icon.height / 2, textCenter: bounds.y + bounds.height / 2,
          lines: new Set(Array.from(range.getClientRects(), rect => Math.round(rect.top))).size, whiteSpace: getComputedStyle(text).whiteSpace,
          right: element.getBoundingClientRect().right, viewport: document.documentElement.clientWidth };
      });
      expect(Math.abs(geometry.iconCenter - geometry.textCenter)).toBeLessThan(2);
      expect(geometry.lines).toBe(1);
      expect(geometry.whiteSpace).toBe('nowrap');
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);
      await page.screenshot({ path: testInfo.outputPath(`weather-label-${theme}.png`), animations: 'disabled' });
    }
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
  test(`Feature: Dashboard label row — Scenario: Separate labels persist and edit controls remain explicit at ${viewport.width} (AC55)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    let saved = responsiveDashboard;
    await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
    await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
      if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
      return route.fulfill({ json: saved });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab'); await enterDashboardEdit(page);
    const card = page.locator('[data-dashboard-card-id="responsive-sensor"]');
    await expect(card.getByRole('button', { name: /Card actions|Acciones de tarjeta/i })).toHaveCount(0);
    await card.dispatchEvent('pointerup', { pointerType: 'touch' });
    await expect(card.getByRole('button', { name: /^(Edit|Editar)$/i })).toBeVisible();
    await card.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
    const editor = page.getByRole('dialog', { name: /^(Edit|Editar)$/i });
    await expect(editor.getByRole('heading', { name: /^(Preview|Vista previa)$/i })).toBeVisible();
    const remove = (await editor.getByRole('button', { name: /^(Delete|Eliminar)$/i }).boundingBox())!;
    const save = (await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).boundingBox())!;
    expect(remove.x).toBeLessThan(save.x);
    await page.screenshot({ path: testInfo.outputPath('card-editor.png'), animations: 'disabled' });
    await editor.getByRole('button', { name: /^(Cancel|Cancelar)$/i }).click();
    await page.getByRole('button', { name: /^(Add label|Añadir etiqueta)$/i }).click();
    const row = page.locator('[data-dashboard-badge-row]');
    await row.getByRole('button', { name: /^(Add label|Añadir etiqueta)$/i }).click();
    const catalog = page.locator('.max-h-section-modal');
    await catalog.getByRole('button', { name: /^(Time|Hora)$/i }).click();
    await page.getByRole('dialog', { name: /^(Edit|Editar)$/i }).getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    await expect(row.locator('.dashboard-context-chip')).toHaveCount(1);
    await row.locator('.group\\/badge').dispatchEvent('pointerup', { pointerType: 'touch' });
    const pencil = row.getByRole('button', { name: /^(Edit|Editar)$/i });
    await expect(pencil).toBeVisible();
    await expect(pencil).toHaveText('');
    await pencil.click();
    const labelEditor = page.getByRole('dialog', { name: /^(Edit|Editar)$/i });
    await expect(labelEditor.locator('[data-card-editor-preview] .dashboard-context-chip')).toHaveCount(1);
    await labelEditor.getByRole('button', { name: /^(Icon|Icono)$/i }).click();
    await page.getByRole('searchbox', { name: /Search by name|Buscar por nombre/i }).fill('battery');
    await page.getByRole('option', { name: 'battery', exact: true }).click();
    const iconPath = await labelEditor.locator('[data-card-editor-preview] .dashboard-context-chip svg path').first().getAttribute('d');
    expect(iconPath).toBeTruthy();
    await labelEditor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    await expect(row.locator('.dashboard-context-chip svg path').first()).toHaveAttribute('d', iconPath!);
    await expect(page.locator('.homepilot-dashboard-titlebar').getByRole('status')).toHaveText(/Cambios guardados|Changes saved/);
    await page.reload();
    await expect(row.locator('.dashboard-context-chip')).toHaveCount(1);
    await expect(row.locator('.dashboard-context-chip svg path').first()).toHaveAttribute('d', iconPath!);
    await expect(row.getByRole('button')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: testInfo.outputPath('label-row.png'), animations: 'disabled' });
  });
}

for (const viewport of [{ name: 'mobile portrait', width: 390, height: 844 }, { name: 'tablet portrait', width: 768, height: 1024 }, { name: 'tablet landscape', width: 1024, height: 768 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`Feature: Adaptive sensor editor — Scenario: Adaptive panels, bounded readings and explicit switch fit ${viewport.name} (AC54/AC55)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const section = responsiveDashboard.tabs[0]!.widgets[1]!;
    let dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [{ ...section, config: { ...section.config, extra: { cards: [{ ...section.config.extra.cards[0]!, gridOptions: { columns: 4, rows: 4 }, visualStyle: 'gauge' }] } } }] }] };
    await prepareAuthenticatedDashboard(page, dashboard);
    await page.route('**/api/v1/devices', route => route.fulfill({ json: responsiveDevices.map(device => device.id === 'sensor-climate' ? { ...device, lastKnownState: { state: '1', unit_of_measurement: '°C' } } : device) }));
    await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [dashboard] }));
    await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
      if (route.request().method() === 'PATCH') dashboard = { ...dashboard, ...route.request().postDataJSON() };
      return route.fulfill({ json: dashboard });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab'); await enterDashboardEdit(page);
    const card = page.locator('[data-dashboard-card-id="responsive-sensor"]');
    await expect(card.locator('.sensor-reading-number')).toHaveText('1');
    await expect.poll(() => card.evaluate(el => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect((await card.boundingBox())!.height).toBeCloseTo(104, 0);
    await card.hover(); await card.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
    const editor = page.getByRole('dialog', { name: /^(Edit|Editar)$/i });
    await expect(editor).toHaveCSS('transform', 'none');
    const initial = (await editor.boundingBox())!;
    for (const panel of [/^(Design|Diseño)$/i, /^(Visibility|Visibilidad)$/i, /^(Configuration|Configuración)$/i]) {
      await editor.getByRole('radio', { name: panel }).click();
      const bounds = (await editor.boundingBox())!;
      expect(bounds.y).toBeCloseTo(initial.y, 0); expect(bounds.width).toBeCloseTo(initial.width, 0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    const controls = (await editor.locator('[data-card-editor-controls]').boundingBox())!;
    const preview = (await editor.locator('[data-card-editor-preview]').boundingBox())!;
    if (viewport.width >= 900) expect(preview.x).toBeGreaterThan(controls.x + controls.width);
    else expect(controls.y).toBeGreaterThanOrEqual(preview.y + preview.height);
    await editor.getByRole('button', { name: /^(Visualization|Visualización)$/i }).click();
    await expect(page.getByRole('option')).toHaveCount(6);
    await page.getByRole('option', { name: /^(Switch|Interruptor) \(ON\/OFF\)$/i }).click();
    await expect(editor.locator('[data-sensor-visualizer="switch"]')).toContainText('ON');
    const checkBinaryFit = async (root: import('@playwright/test').Locator) => {
      const header = (await root.locator('.sensor-premium-header').boundingBox())!;
      const track = (await root.locator('.sensor-binary-track').boundingBox())!;
      const shell = (await root.locator('.sensor-metric-card').boundingBox())!;
      expect(track.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
      expect(track.y + track.height).toBeLessThanOrEqual(shell.y + shell.height + 1);
    };
    await checkBinaryFit(editor);
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      await page.screenshot({ path: testInfo.outputPath(`adaptive-editor-${theme}.png`), animations: 'disabled' });
    }
    await page.evaluate(() => { Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 420 }); window.visualViewport?.dispatchEvent(new Event('resize')); });
    await expect.poll(async () => { const box = (await editor.boundingBox())!; return box.y + box.height <= 421; }).toBe(true);
    await expect(editor.getByRole('button', { name: /^(Save|Guardar)$/i })).toBeInViewport();
    await page.evaluate(height => { Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: height }); window.visualViewport?.dispatchEvent(new Event('resize')); }, viewport.height);
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    await expect(card.locator('[data-sensor-visualizer="switch"]')).toContainText('ON');
    await page.reload(); await expect(card.locator('[data-sensor-visualizer="switch"]')).toContainText('ON');
    await checkBinaryFit(card);
    await expect.poll(() => card.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await page.route('**/api/v1/devices', route => route.fulfill({ json: responsiveDevices }));
    await page.reload(); await expect(card.getByText(/^(No reading|Sin lectura)$/i)).toBeVisible();
    await checkBinaryFit(card);
  });
}

test('Feature: Sections editor — Scenario: Editor sizing writes once, serializes edits, supports undo/redo and rolls back errors (AC48–AC49)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const template = responsiveDashboard.tabs[0].widgets[1];
  const initial = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [{ ...template, config: { ...template.config, extra: { cards: [
    { id: 'resize-a', kind: 'light', title: 'A', span: 'small' },
    { id: 'resize-b', kind: 'light', title: 'B', span: 'small' },
  ] } } }] }] };
  await prepareAuthenticatedDashboard(page, initial);
  let saved = initial;
  let writes = 0;
  let failNext = false;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard', async route => {
    if (route.request().method() !== 'PATCH') return route.fulfill({ json: saved });
    writes += 1;
    if (writes === 1) await gate;
    if (failNext) { failNext = false; return route.fulfill({ status: 500, json: { error: 'Test save rejected' } }); }
    saved = { ...saved, ...route.request().postDataJSON() };
    return route.fulfill({ json: saved });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  const header = page.locator('.homepilot-dashboard-titlebar');
  await header.getByLabel(/^(More|Más)$/i).click();
  await page.getByRole('menu', { name: /^(More|Más)$/i }).getByRole('menuitem', { name: /^(Edit|Editar)$/i }).click();
  const card = (id: string) => page.locator(`[data-dashboard-card-id="${id}"]`);
  const editor = page.getByRole('dialog', { name: /^(Edit|Editar)$/i });
  const editSize = async (id: string, columns: number, rows?: number) => {
    await card(id).hover();
    await card(id).getByRole('button', { name: /^(Edit|Editar)$/i }).click();
    await editor.getByRole('radio', { name: /^(Design|Diseño)$/i }).click();
    const sizingGrid = editor.getByRole('grid', { name: /^(Design|Diseño)$/i });
    const bounds = await sizingGrid.boundingBox();
    if (!bounds) throw new Error('Interactive sizing grid missing');
    await page.mouse.click(bounds.x + bounds.width * (columns - 0.5) / 12, bounds.y + bounds.height * ((rows ?? 4) - 0.5) / 8);
  };
  await expect(card('resize-a').getByRole('slider')).toHaveCount(0);
  await editSize('resize-a', 5);
  await expect(card('resize-a')).not.toHaveCSS('grid-column-start', 'span 5');
  expect(writes).toBe(0);
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect.poll(() => writes).toBe(1);
  await editSize('resize-b', 4);
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect(card('resize-b')).toHaveCSS('grid-column-start', 'span 4');
  expect(writes).toBe(1);
  release();
  await expect.poll(() => writes).toBe(2);
  await expect(header.getByRole('status')).toHaveText(/Cambios guardados|Changes saved/);
  await header.getByRole('button', { name: /^(Undo|Deshacer)$/i }).click();
  await expect.poll(() => writes).toBe(3);
  await expect(card('resize-b')).toHaveCSS('grid-column-start', 'span 3');
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => writes).toBe(4);
  await expect(card('resize-b')).toHaveCSS('grid-column-start', 'span 4');
  await expect(header.getByRole('status')).toHaveText(/Cambios guardados|Changes saved/);
  failNext = true;
  await editSize('resize-b', 5);
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect.poll(() => writes).toBe(5);
  await expect(page.getByRole('alert').filter({ hasText: /Test save rejected|guardar|save/i })).toBeVisible();
  await expect(card('resize-b')).toHaveCSS('grid-column-start', 'span 4');
  await page.reload();
  await expect(card('resize-a')).toHaveCSS('grid-column-start', 'span 5');
  await expect(card('resize-b')).toHaveCSS('grid-column-start', 'span 4');
  await enterDashboardEdit(page);
  await editSize('resize-b', 4, 5);
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect(card('resize-b')).toHaveCSS('grid-row-start', 'span 5');
  await expect(card('resize-b')).toHaveCSS('height', '132px');
  await expect(header.getByRole('status')).toHaveText(/Cambios guardados|Changes saved/);
  await page.reload();
  await expect(card('resize-b')).toHaveCSS('height', '132px');
});

test('Feature: Sections editor — Scenario: Design and visibility previews are drafts until saved (AC48–AC49)', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await prepareAuthenticatedDashboard(page);
  let saved = responsiveDashboard;
  await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
    if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
    return route.fulfill({ json: saved });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  const card = page.locator('[data-dashboard-card-id="responsive-sensor"]');
  await card.hover(); await card.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  const editor = page.getByRole('dialog', { name: /^(Edit|Editar)$/i });
  const preview = editor.getByRole('region', { name: /^(Preview|Vista previa)$/i });
  await editor.getByRole('radio', { name: /^(Design|Diseño)$/i }).click();
  const sizingGrid = editor.getByRole('grid', { name: /^(Design|Diseño)$/i });
  await sizingGrid.getByRole('gridcell', { name: /^(Columns \(of 12\)|Columnas \(de 12\)): 8, (Rows|Filas): 6$/i }).click();
  const previewCard = preview.locator('.homepilot-sized-card').first();
  await expect(previewCard).toHaveCSS('height', '160px');
  await expect(sizingGrid).not.toHaveJSProperty('tagName', 'INPUT');
  await page.screenshot({ path: testInfo.outputPath('card-design-tablet.png') });
  await expect(card).not.toHaveCSS('grid-column-start', 'span 8');
  await editor.getByRole('button', { name: /^(Cancel|Cancelar)$/i }).click();
  await expect(card).not.toHaveCSS('grid-column-start', 'span 8');
  await card.hover(); await card.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  await editor.getByRole('radio', { name: /^(Visibility|Visibilidad)$/i }).click();
  await editor.getByRole('switch').click();
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect(card).toBeVisible();
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Done|Finalizar)$/i }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(card).toHaveCount(0);
  await enterDashboardEdit(page);
  await expect(card).toBeVisible();
});

test('Feature: Sections editor — Scenario: Section duplication and maximum columns persist (AC46–AC49)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await prepareAuthenticatedDashboard(page);
  let saved = responsiveDashboard;
  await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
    if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
    return route.fulfill({ json: saved });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  const original = responsiveDashboard.tabs[0].widgets[1];
  const source = page.locator(`[data-dashboard-section-id="${original.id}"]`);
  await source.getByLabel(/^(Section actions|Acciones de sección)$/i).click();
  const sectionMenu = page.getByRole('menu', { name: /^(Section actions|Acciones de sección)$/i });
  const intrinsic = await sectionMenu.evaluate(element => ({ width: element.getBoundingClientRect().width, items: Array.from(element.querySelectorAll('[role="menuitem"]')).map(item => item.getBoundingClientRect().width), padding: parseFloat(getComputedStyle(element).paddingLeft) + parseFloat(getComputedStyle(element).paddingRight) + 2 }));
  expect(intrinsic.width).toBeLessThanOrEqual(Math.max(...intrinsic.items) + intrinsic.padding + 1);
  expect(intrinsic.width).toBeLessThan(180);
  await page.getByRole('menu', { name: /^(Section actions|Acciones de sección)$/i }).getByRole('menuitem', { name: /^(Duplicate|Duplicar)$/i }).click();
  await expect(page.locator('[data-dashboard-section-id]')).toHaveCount(2);
  await expect.poll(() => saved.tabs[0].widgets.filter(widget => widget.type === 'section').length).toBe(2);
  const copied = saved.tabs[0].widgets.find(widget => widget.type === 'section' && widget.id !== original.id)!;
  expect(copied.config.extra.cards.map(card => card.id)).not.toEqual(original.config.extra.cards.map(card => card.id));
  expect(copied.config.extra.cards.map(card => card.entityId)).toEqual(original.config.extra.cards.map(card => card.entityId));
  await page.getByRole('button', { name: /Configure view:|Configurar vista:/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /^(Maximum columns|Máximo de columnas)$/i }).click();
  await page.getByRole('option', { name: '1', exact: true }).click();
  await dialog.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect(page.locator('.homepilot-dashboard-titlebar').getByRole('status')).toHaveText(/Cambios guardados|Changes saved/);
  await page.reload();
  const first = (await source.boundingBox())!;
  const second = (await page.locator(`[data-dashboard-section-id="${copied.id}"]`).boundingBox())!;
  expect(second.x).toBeCloseTo(first.x, 0);
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
});

test('Feature: Sensor fixed scale — Scenario: Editor preview and reload keep optional bounds (AC42)', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  let dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [section] }] };
  await prepareAuthenticatedDashboard(page, dashboard);
  let reading = '22.4567';
  await page.route('**/api/v1/devices', route => route.fulfill({ json: responsiveDevices.map(device => device.id === 'sensor-climate'
    ? { ...device, lastKnownState: { state: reading, unit_of_measurement: '°C', attributes: { min: 0, max: 50 } } } : device) }));
  let savedScale: unknown;
  await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [dashboard] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
    if (route.request().method() === 'PATCH') {
      dashboard = { ...dashboard, ...route.request().postDataJSON() };
      savedScale = (dashboard.tabs[0]!.widgets[0]!.config.extra.cards[0] as { sensorScale?: unknown }).sensorScale;
    }
    return route.fulfill({ json: dashboard });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab'); await enterDashboardEdit(page);
  const sensor = page.locator('[data-dashboard-card-id="responsive-sensor"]');
  await sensor.hover(); await sensor.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  const heading = page.getByRole('heading', { name: /^(Edit|Editar)$/i });
  const editor = heading.locator('..').locator('..').locator('..');
  const minimum = editor.getByLabel(/^(Minimum|Mínimo)$/i), maximum = editor.getByLabel(/^(Maximum|Máximo)$/i);
  await expect(minimum).toHaveValue(''); await minimum.fill('-20');
  const save = editor.getByRole('button', { name: /^(Save|Guardar)$/i });
  await expect(save).toBeDisabled(); await maximum.fill('100'); await expect(save).toBeEnabled();
  const decimals = editor.getByRole('switch', { name: /Show up to two decimal places|Mostrar hasta dos decimales/ });
  await expect(decimals).toHaveAttribute('aria-checked', 'false'); await decimals.click();
  await expect(decimals).toHaveAttribute('aria-checked', 'true');
  const preview = editor.getByRole('meter'); await expect(preview).toHaveAttribute('aria-valuemin', '-20'); await expect(preview).toHaveAttribute('aria-valuemax', '100');
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
    await minimum.scrollIntoViewIfNeeded(); await page.screenshot({ path: testInfo.outputPath(`sensor-scale-${theme}.png`), animations: 'disabled' });
  }
  await save.click(); await expect.poll(() => savedScale).toEqual({ min: -20, max: 100 });
  await page.reload(); await expect(sensor.getByRole('meter')).toHaveAttribute('aria-valuemin', '-20');
  await expect(sensor.locator('.sensor-reading-number')).toHaveText(/22[.,]46/);
  await expect(sensor.getByRole('meter')).toHaveAttribute('aria-valuetext', '22.4567 °C');
  reading = '123.4567'; await page.reload();
  await expect(sensor.getByRole('meter')).toHaveAttribute('aria-valuemin', '-20'); await expect(sensor.getByRole('meter')).toHaveAttribute('aria-valuemax', '100');
  await expect(sensor.locator('.sensor-reading-number')).toHaveText(/123[.,]46/);
  await expect(sensor.getByRole('meter')).toHaveAttribute('aria-valuetext', '123.4567 °C');
  reading = 'unavailable'; await page.reload(); await expect(sensor.getByRole('meter')).toHaveCount(0); await expect(sensor.locator('.sensor-scale-caption')).toHaveCount(0);
  reading = '22.4567'; await page.reload();
  await enterDashboardEdit(page); await sensor.hover(); await sensor.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  await expect(minimum).toHaveValue('-20'); await expect(maximum).toHaveValue('100');
  await expect(decimals).toHaveAttribute('aria-checked', 'true'); await decimals.click();
  await minimum.fill(''); await maximum.fill(''); await save.click(); await expect.poll(() => savedScale).toBeUndefined();
  await expect(sensor.locator('.sensor-reading-number')).toHaveText('22');
});

test('Feature: Dashboard idle preference — Scenario: Optional local stay preserves only the open dashboard (AC34)', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1024 }); await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/settings/home-personalization', route => route.fulfill({ json: { morningPhrase: '', afternoonPhrase: '', nightPhrase: '', heroImages: [] } }));
  await page.goto('/system/home-personalization');
  const selector = page.getByRole('button', { name: /Dashboard navigation|Navegación del tablero/ });
  await expect(selector).toContainText(/Return to Home|Volver a Inicio/);
  // Freeze time only once authentication, the route and its form have settled.
  const start = Date.now(); await page.clock.install({ time: start }); await page.clock.pauseAt(start);
  await selector.click(); await page.getByRole('option', { name: /Stay on the dashboard|Permanecer en el tablero/ }).click();
  await page.screenshot({ path: testInfo.outputPath('dashboard-idle-preference.png'), animations: 'disabled' });
  await page.clock.resume();
  await page.goto('/dashboards/responsive-dashboard/responsive-tab'); await expect(page.locator('[data-dashboard-card-id="responsive-sensor"]')).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
  await page.clock.fastForward(121_000); await expect(page).toHaveURL(/\/dashboards\/responsive-dashboard\/responsive-tab$/);
  await page.clock.resume();
  await page.reload(); await expect(page.locator('[data-dashboard-card-id="responsive-sensor"]')).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
  await page.clock.fastForward(121_000); await expect(page).toHaveURL(/\/dashboards\/responsive-dashboard\/responsive-tab$/);
  expect(await page.evaluate(() => localStorage.getItem('__homepilot_keep_dashboard'))).toBe('true');

  await page.clock.resume();
  await page.goto('/system/home-personalization');
  await expect(selector).toContainText(/Stay on the dashboard|Permanecer en el tablero/);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
  // Start the inactivity window from a real user event after the form is ready.
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/system\/home-personalization$/);

  await page.clock.fastForward(119_000);
  await expect(page).toHaveURL(/\/system\/home-personalization$/);

  await page.clock.fastForward(2_000);
  await expect(page).toHaveURL(/\/$/);

  await page.evaluate(() => localStorage.setItem('__homepilot_keep_dashboard', 'false'));
  await page.clock.resume();
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await expect(page.locator('[data-dashboard-card-id="responsive-sensor"]')).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
  await page.keyboard.press('Escape');

  await page.clock.fastForward(121_000);
  await expect(page).toHaveURL(/\/$/);
});

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1280, height: 900 }]) {
  test(`Feature: Dashboard unified editing — Scenario: Stable sections and cross-section movement on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const template = responsiveDashboard.tabs[0].widgets[1];
    const makeSection = (id: string, title: string, cards: Array<Record<string, unknown>>) => ({ ...template, id, config: { ...template.config, layout: { ...template.config.layout, span: 1 }, appearance: { title, showTitle: true }, extra: { cards } } });
    const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [responsiveDashboard.tabs[0].widgets[0],
      makeSection('tech', 'Tech', [{ id: 'movable', kind: 'light', title: 'Gata', entityId: 'light-kitchen', span: 'small', icon: 'Lightbulb' }]),
      makeSection('patio', 'Patio', [{ id: 'tall', kind: 'clock_minimal', title: 'Reloj', span: 'full', icon: 'Clock' }]),
      makeSection('cocina', 'Cocina', [{ id: 'second-light', kind: 'light', title: 'Cocina', span: 'small', icon: 'Lightbulb' }]),
    ] }] };
    await prepareAuthenticatedDashboard(page, dashboard);
    let saved = dashboard;
    await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
    await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
      if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
      return route.fulfill({ json: saved });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const regions = ['Tech', 'Patio', 'Cocina'].map(name => page.getByRole('region', { name, exact: true }));
    const bounds = async () => Promise.all(regions.map(region => region.boundingBox()));
    await expect(regions[2]).toBeVisible();
    const before = await bounds();
    await enterDashboardEdit(page);
    await expect.poll(async () => {
      const after = await bounds();

      if (before.some((box) => !box) || after.some((box) => !box)) {
        return false;
      }

      const verticalShift = after[0]!.y - before[0]!.y;

      return after.every((box, index) => {
        const previous = before[index]!;
        return Math.abs(box!.x - previous.x) <= 2
          && Math.abs(box!.width - previous.width) <= 2
          && Math.abs(box!.height - previous.height) <= 2
          && Math.abs((box!.y - previous.y) - verticalShift) <= 2;
      });
    }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('dashboard-editing.png'), fullPage: true });
    const header = page.locator('.homepilot-dashboard-titlebar');
    await expect(header.getByRole('button', { name: /^(Edit|Editar|Rename|Renombrar)$/i })).toHaveCount(0);
    const source = page.locator('[data-dashboard-card-id="movable"]');
    await source.scrollIntoViewIfNeeded();
    await source.focus();
    await page.keyboard.press('Space');
    await expect(source).toHaveAttribute('aria-pressed', 'true');
    await expect(source).toHaveAttribute('data-dashboard-drag-origin', 'true');
    const overlay = page.locator('[data-dashboard-drag-preview="true"]');
    await expect(overlay).toBeVisible();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.keyboard.press('Escape');
    await expect(source).not.toHaveAttribute('aria-pressed', 'true');
    expect(saved.tabs[0].widgets.find(widget => widget.id === 'tech')?.config.extra.cards.map(card => card.id)).toEqual(['movable']);
    const sourceBounds = await source.boundingBox();
    if (!sourceBounds) throw new Error('Missing draggable card bounds');
    const destinationBounds = await regions[1].getByRole('heading', { name: 'Patio' }).boundingBox();
    if (!destinationBounds) throw new Error('Missing destination section bounds');
    await page.mouse.move(sourceBounds.x + sourceBounds.width * 0.1, sourceBounds.y + sourceBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(destinationBounds.x + destinationBounds.width / 2, destinationBounds.y + destinationBounds.height / 2, { steps: 12 });
    await expect(source).toHaveAttribute('aria-pressed', 'true');
    await expect(source).toHaveAttribute('data-dashboard-drag-origin', 'true');
    const dragBounds = (await page.locator('[data-dashboard-drag-preview="true"]').boundingBox())!;
    await expect(regions[1].locator('[data-dashboard-card-id="movable"]')).toBeVisible();
    expect(saved.tabs[0].widgets.find(widget => widget.id === 'tech')?.config.extra.cards.map(card => card.id)).toEqual(['movable']);
    expect(dragBounds.width).toBeCloseTo(sourceBounds.width, 1);
    expect(dragBounds.height).toBeCloseTo(sourceBounds.height, 1);
    await expect(page.locator('[data-dashboard-drop-target="true"]').filter({ visible: true })).not.toHaveCount(0);
    await page.mouse.up();
    await expect.poll(() => saved.tabs[0].widgets.find(widget => widget.id === 'patio')?.config.extra?.cards.map(card => card.id)).toEqual(['tall', 'movable']);
    await expect(regions[0].locator('[data-dashboard-card-id="movable"]')).toHaveCount(0);
    await expect(regions[1].locator('[data-dashboard-card-id="movable"]')).toBeVisible();
    await header.getByRole('textbox', { name: /^(Rename|Renombrar)$/i }).fill('Casa renovada');
    await header.getByRole('button', { name: /^(Done|Listo)$/i }).click();
    await expect.poll(() => saved.title).toBe('Casa renovada');
    await page.reload();
    await expect(regions[1].locator('[data-dashboard-card-id="movable"]')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('dashboard-unified-editing.png'), fullPage: true });
  });
}

test('Feature: Dashboard unified editing — Scenario: Touch hold moves a card into an empty section without executing it', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    const template = responsiveDashboard.tabs[0].widgets[1];
    const makeSection = (id: string, title: string, cards: Array<Record<string, unknown>>) => ({ ...template, id, config: { ...template.config, layout: { ...template.config.layout, span: 1 }, appearance: { title, showTitle: true }, extra: { cards } } });
    const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [responsiveDashboard.tabs[0].widgets[0], makeSection('tech', 'Tech', [{ id: 'touch-card', kind: 'light', title: 'Gata', entityId: 'light-kitchen', span: 'small', icon: 'Lightbulb' }]), makeSection('patio', 'Patio', [])] }] };
    let saved = dashboard;
    let commands = 0;
    await prepareAuthenticatedDashboard(page, dashboard);
    await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
    await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
      if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
      return route.fulfill({ json: saved });
    });
    await page.route('**/api/v1/devices/*/command', route => { commands += 1; return route.fulfill({ json: {} }); });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    await enterDashboardEdit(page, true);
    const card = page.locator('[data-dashboard-card-id="touch-card"]');
    await card.scrollIntoViewIfNeeded();
    const source = await card.boundingBox();
    const target = await page.getByRole('region', { name: 'Patio', exact: true }).boundingBox();
    if (!source || !target) throw new Error('Missing touch drag bounds');
    await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-02T12:00:01Z'));
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: source.x + source.width / 2, y: source.y + source.height / 2 }] });
    await page.clock.runFor(250);
    await expect(card).not.toHaveAttribute('aria-pressed', 'true');
    await page.clock.runFor(100);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    const preview = page.locator('[data-dashboard-drag-preview]');
    await expect(preview).toContainText('Gata');
    const previewBounds = await preview.boundingBox();
    expect(previewBounds!.width).toBeCloseTo(source.width, -1);
    await page.clock.resume();
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2 }] });
    await expect(preview).toContainText('Gata');
    await expect.poll(async () => (await preview.boundingBox())!.x).toBeCloseTo(target.x + target.width / 2 - source.width / 2, -1);
    await page.screenshot({ path: testInfo.outputPath('card-over-other-section.png') });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const landingAnimation = await page.evaluate(() => document.getAnimations().some(animation => {
      const effect = animation.effect;
      return effect instanceof KeyframeEffect && effect.target instanceof Element
        && Boolean(effect.target.querySelector('[data-dashboard-drag-preview]'))
        && effect.getKeyframes().some(frame => typeof frame.transform === 'string');
    }));
    expect(landingAnimation).toBe(true);
    await expect.poll(() => saved.tabs[0].widgets.find(widget => widget.id === 'patio')?.config.extra.cards.map(card => card.id)).toEqual(['touch-card']);
    expect(commands).toBe(0);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Patio', exact: true }).locator('[data-dashboard-card-id="touch-card"]')).toBeVisible();
  } finally { await context.close(); }
});

for (const width of [360, 768, 1440]) {
  test(`Feature: Modular dashboard fields — Scenario: Title and tab keyboard editing at ${width}px (AC79)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [] }] };
    await prepareAuthenticatedDashboard(page, dashboard);
    let saved = dashboard;
    await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
    await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
      if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
      return route.fulfill({ json: saved });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    await enterDashboardEdit(page);
    await page.evaluate(() => document.fonts.ready);
    const titlebar = page.locator('.homepilot-dashboard-titlebar');
    const title = titlebar.getByRole('textbox', { name: /^(Rename|Renombrar)$/i });
    for (const theme of ['dark', 'light']) {
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      await expect(title).toHaveCSS('height', '44px');
      await expect(title).toHaveCSS('border-radius', '12px');
      await expect(title).toHaveCSS('font-size', '15px');
      expect(await titlebar.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.getByRole('button', { name: /^(Add tab|Añadir pestaña)$/i }).click();
      const tab = page.getByRole('textbox', { name: /^(New Tab|Nueva Tab)$/i });
      await expect(tab).toBeFocused();
      await expect(tab).toHaveCSS('height', '44px');
      await expect(tab).toHaveCSS('border-radius', '12px');
      expect((await tab.boundingBox())!.width).toBeGreaterThanOrEqual(96);
      await tab.fill('Sin guardar');
      await tab.press('Escape');
      await expect(tab).not.toBeVisible();
      expect(saved.tabs).toHaveLength(1);
      await page.screenshot({ path: testInfo.outputPath(`dashboard-fields-${theme}-${width}.png`), fullPage: true });
    }
    await title.fill('Casa renovada');
    await title.press('Enter');
    await expect.poll(() => saved.title).toBe('Casa renovada');
    await page.getByRole('button', { name: /^(Add tab|Añadir pestaña)$/i }).click();
    const tab = page.getByRole('textbox', { name: /^(New Tab|Nueva Tab)$/i });
    await tab.fill('  Patio  ');
    await tab.press('Enter');
    await expect.poll(() => saved.tabs.map(item => item.title)).toEqual([dashboard.tabs[0].title, 'Patio']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('Feature: Dashboard tab transfer — Scenario: The active tab exports and imports as a new tab without replacing defaults', async ({ page }) => {
  await page.addInitScript(() => {
    const paths: string[] = [];
    Object.assign(window, { dashboardRouteWrites: paths });
    const replace = history.replaceState.bind(history);
    history.replaceState = (data, unused, url) => { if (url) paths.push(String(url)); replace(data, unused, url); };
  });
  await prepareAuthenticatedDashboard(page);
  const exported = { format: 'homepilot-dashboard-tab', version: 1, tab: { id: 'portable-tab', title: 'Patio', widgets: [] } };
  let exportedTab = '';
  let received: unknown;
  let saved = responsiveDashboard;
  await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard/tabs/responsive-tab/export', route => { exportedTab = 'responsive-tab'; return route.fulfill({ json: exported }); });
  await page.route('**/api/v1/dashboards/responsive-dashboard/tabs/import', route => {
    received = route.request().postDataJSON();
    saved = { ...saved, tabs: [...saved.tabs, { ...saved.tabs[0], id: 'new-tab', title: 'Patio', widgets: [], isDefault: false }] };
    return route.fulfill({ status: 201, json: saved });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  const header = page.locator('.homepilot-dashboard-titlebar');
  await header.getByLabel(/^(More|Más)$/i).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menu', { name: /^(More|Más)$/i }).getByRole('menuitem', { name: /^(Export tab|Exportar pestaña)$/i }).click();
  expect((await download).suggestedFilename()).toBe('principal.homepilot-dashboard-tab.json');
  expect(exportedTab).toBe('responsive-tab');
  await header.getByLabel(/^(More|Más)$/i).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menu', { name: /^(More|Más)$/i }).getByRole('menuitem', { name: /^(Import tab|Importar pestaña)$/i }).click();
  await (await chooser).setFiles({ name: 'patio.homepilot-dashboard-tab.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect.poll(() => received).toEqual(exported);
  await expect(page).toHaveURL(/\/new-tab$/);
  await page.getByRole('button', { name: 'Principal', exact: true }).click();
  await expect(page).toHaveURL(/\/responsive-tab$/);
  await page.getByRole('button', { name: 'Patio', exact: true }).click();
  await expect(page).toHaveURL(/\/new-tab$/);
  const writes = await page.evaluate(() => (window as unknown as { dashboardRouteWrites: string[] }).dashboardRouteWrites.filter(path => path.includes('/dashboards/')));
  expect(writes).toEqual(['/dashboards/responsive-dashboard/new-tab', '/dashboards/responsive-dashboard/responsive-tab', '/dashboards/responsive-dashboard/new-tab']);
  expect(saved.tabs).toHaveLength(2);
  expect(saved.tabs[0].isDefault).toBe(true);
  expect(saved.tabs[1].isDefault).toBe(false);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Patio', exact: true })).toBeVisible();
});

test('Feature: Dashboard unified editing — Scenario: Keyboard transfers a card between sections and Escape cancels a second movement', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const template = responsiveDashboard.tabs[0].widgets[1];
  const makeSection = (id: string, title: string, cardId: string) => ({ ...template, id, config: { ...template.config, layout: { ...template.config.layout, span: 1 }, appearance: { title, showTitle: true }, extra: { cards: [{ id: cardId, kind: 'light', title: cardId, span: 'small', icon: 'Lightbulb' }] } } });
  const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [responsiveDashboard.tabs[0].widgets[0], makeSection('tech', 'Tech', 'keyboard-card'), makeSection('patio', 'Patio', 'target-card')] }] };
  let saved = dashboard;
  let writes = 0;
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
    if (route.request().method() === 'PATCH') { writes += 1; saved = { ...saved, ...route.request().postDataJSON() }; }
    return route.fulfill({ json: saved });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  const card = page.locator('[data-dashboard-card-id="keyboard-card"]');
  await card.focus();
  await page.keyboard.press('Space');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
    // dnd-kit installs its document keyboard listener after activation; let
    // the activated frame settle before the user's next key.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.homepilot-dashboard-content').getByRole('status')).toContainText('Patio');
  await expect(page.getByRole('region', { name: 'Patio', exact: true }).locator('[data-dashboard-card-id="keyboard-card"]')).toBeVisible();
  expect(writes).toBe(0);
  await page.keyboard.press('Space');
  await expect.poll(() => saved.tabs[0].widgets.find(widget => widget.id === 'patio')?.config.extra.cards.map(card => card.id)).toEqual(['keyboard-card', 'target-card']);
  await expect(page.locator('[data-dashboard-drag-preview="true"]')).toHaveCount(0);
  // The transferred node registers its sortable listeners in a layout effect.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await card.focus();
  await expect(card).toBeFocused();
  await page.keyboard.press('Space');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('region', { name: 'Tech', exact: true }).locator('[data-dashboard-card-id="keyboard-card"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).not.toHaveAttribute('aria-pressed', 'true');
  expect(writes).toBe(1);
  await expect(page.getByRole('region', { name: 'Patio', exact: true }).locator('[data-dashboard-card-id="keyboard-card"]')).toBeVisible();
});

test('Feature: Section slots — moving to a gap and swapping Sections persist without changing another profile', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const baseSection = responsiveDashboard.tabs[0]!.widgets[1]!;
  let dashboard = {
    ...responsiveDashboard,
    tabs: [{
      ...responsiveDashboard.tabs[0]!,
      widgets: ['a', 'b', 'c'].map((id) => ({
        ...baseSection, id,
        config: { ...baseSection.config, layout: { x: 0, y: 0, w: 1, h: 2, span: 1 }, appearance: { title: id.toUpperCase(), showTitle: true }, extra: { cards: [] } },
      })),
      sectionLayout: {
        columns4: ['a', 'b', 'c'] as Array<string | null>,
        columns3: ['c', 'b', 'a'] as Array<string | null>,
        columns2: ['b', null, 'a', 'c'] as Array<string | null>,
        columns1: ['a', null, 'c', 'b'] as Array<string | null>,
      },
    }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/dashboards', (route) => route.fulfill({ json: [dashboard] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const patch = route.request().postDataJSON() as Partial<typeof dashboard>;
    dashboard = { ...dashboard, ...patch };
    await route.fulfill({ json: dashboard });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);

  const handle = (name: string) => page.getByRole('button', { name: new RegExp(`^(Drag to reorder|Arrastrar para reordenar): ${name}$`) });
  const moveSectionWithKeyboard = async (name: string, keys: string[]) => {
    const source = handle(name);

    // On a loaded machine the editor can re-render between focusing and the check; focus again until it holds.
    await expect(async () => {
      await source.focus();
      await expect(source).toBeFocused({ timeout: 1000 });
    }).toPass({ timeout: 8000 });

    await page.keyboard.press('Space');
    await expect(source).toHaveAttribute('data-dashboard-drag-origin', 'true');

    await page.evaluate(() => new Promise<void>(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    ));

    for (const key of keys) {
      await page.keyboard.press(key);
      await page.evaluate(() => new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      ));
    }

    await page.keyboard.press('Space');
    await expect(page.locator('[data-dashboard-drag-preview="true"]')).toHaveCount(0);
  };
  await expect(page.locator('[data-section-slot="3"]')).toBeVisible();
  await moveSectionWithKeyboard('B', ['ArrowLeft', 'ArrowDown']);
  await expect.poll(() => dashboard.tabs[0]?.sectionLayout.columns4).toEqual(['a', null, 'c', null, 'b']);
  await moveSectionWithKeyboard('A', ['ArrowRight', 'ArrowRight']);
  await expect.poll(() => dashboard.tabs[0]?.sectionLayout.columns4).toEqual(['c', null, 'a', null, 'b']);
  expect(dashboard.tabs[0]?.sectionLayout.columns3).toEqual(['c', 'b', 'a']);

  await page.reload();
  await expect(page.locator('[data-section-slot="1"] .homepilot-dashboard-widget')).toHaveCount(0);
  await expect(page.locator('[data-section-slot="4"]')).toContainText('B');
  for (const profile of [
    { width: 1440, height: 900, first: 'C', gap: false },
    { width: 768, height: 1024, first: 'B', gap: true },
    { width: 320, height: 720, first: 'A', gap: true },
  ]) {
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await expect(page.locator('[data-section-slot="0"]')).toContainText(profile.first);
    await expect(page.locator('[data-section-slot="1"] .homepilot-dashboard-widget')).toHaveCount(profile.gap ? 0 : 1);
  }
});

test('Feature: Section slots — a historical wide Section stays one slot until an explicit new width is saved', async ({ page }) => {
  const baseSection = responsiveDashboard.tabs[0]!.widgets[1]!;
  let dashboard = {
    ...responsiveDashboard,
    tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [{
      ...baseSection, id: 'legacy-wide-section',
      config: { ...baseSection.config, layout: { x: 0, y: 0, w: 12, h: 2, span: 4 }, appearance: { title: 'Sala', showTitle: true }, extra: { cards: [{ id: 'legacy-card', kind: 'sensor', title: 'Batería' }] } },
    }], sectionLayout: { columns4: ['legacy-wide-section', null] as Array<string | null> } }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/dashboards', (route) => route.fulfill({ json: [dashboard] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard', (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    dashboard = { ...dashboard, ...route.request().postDataJSON() as Partial<typeof dashboard> };
    return route.fulfill({ json: dashboard });
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  await expect(page.locator('[data-section-slot="1"] .homepilot-dashboard-widget')).toHaveCount(0);
  const legacySection = page.locator('[data-dashboard-section-id="legacy-wide-section"]');
  await openSectionEditor(page, legacySection);
  const editor = page.getByRole('dialog', { name: /Editar sección|Edit section/i });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('group', { name: /Ancho de la tarjeta|Card width/i })).toHaveCount(0);
  await editor.getByRole('button', { name: /^(Guardar|Save)$/i }).click();
  await expect.poll(() => dashboard.tabs[0].widgets[0].config.layout.span).toBe(1);
  expect(dashboard.tabs[0].widgets[0].config.extra.cards.map((card) => card.id)).toEqual(['legacy-card']);
  expect(dashboard.tabs[0].sectionLayout.columns4).toEqual(['legacy-wide-section', null]);
  await openSectionEditor(page, legacySection);
  await editor.getByRole('button', { name: /Section width|Ancho de sección/i }).click();
  await page.getByRole('option', { name: '2', exact: true }).click();
  await editor.getByRole('button', { name: /^(Guardar|Save)$/i }).click();
  await expect.poll(() => dashboard.tabs[0].widgets[0].config.layout.span).toBe(2);
  await page.reload();
  await expect(page.locator('[data-dashboard-section-id="legacy-wide-section"]')).toHaveCSS('grid-column-start', 'span 2');
});

test('Feature: Section slots — a shared read-only tab exposes its gaps but no drag controls', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const baseSection = responsiveDashboard.tabs[0]!.widgets[1]!;
  const shared = {
    ...responsiveDashboard, ownerId: 'other-owner',
    tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: ['a', 'b'].map((id) => ({
      ...baseSection, id,
      config: { ...baseSection.config, layout: { x: 0, y: 0, w: 1, h: 2, span: 1 }, appearance: { title: id.toUpperCase(), showTitle: true }, extra: { cards: [] } },
    })), sectionLayout: { columns4: ['a', null, 'b'] } }],
  };
  await prepareAuthenticatedDashboard(page, shared);
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await expect(page.locator('[data-section-slot="1"] .homepilot-dashboard-widget')).toHaveCount(0);
  await expect(page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Drag to reorder|Arrastrar para reordenar/i })).toHaveCount(0);
});

for (const viewport of [viewports[2], viewports[1], viewports[0], { name: 'portrait kiosk', ...portraitKioskViewport }]) {
  test(`Feature: Dashboard layout parity — Scenario: Editing preserves section geometry on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const layoutDevices = [1, 2, 3, 4, 5].map((number) => ({
      id: `layout-light-${number}`,
      homeId: 'responsive-home',
      roomId: 'responsive-room',
      name: `Luz ${number}`,
      type: 'light',
      semanticType: 'light',
      status: 'ASSIGNED',
      lastKnownState: { state: 'off' },
    }));
    const layoutDashboard = {
      ...responsiveDashboard,
      tabs: [{
        ...responsiveDashboard.tabs[0],
        // No title widget: edit controls must not add tracks or change the
        // height of existing sections. Both modes use the same slot profile.
        widgets: ['Tech', 'Patio', 'Sala', 'Cocina'].map((title, index) => ({
          id: `layout-section-${index}`,
          type: 'section',
          config: {
            layout: { x: index, y: 0, w: 1, h: 2, span: 1 },
            binding: { entityId: `layout-section-${index}`, entityType: 'system', entityName: title },
            visibility: { rules: [], defaultState: 'show' },
            appearance: { title, showTitle: true },
            extra: { cards: layoutDevices.map((device) => ({
              id: `${index}-${device.id}`,
              kind: 'light',
              title: device.name,
              entityId: device.id,
              span: 'small',
              icon: 'Lightbulb',
            })) },
          },
        })),
      }],
    };
    await prepareAuthenticatedDashboard(page, layoutDashboard);
    await page.route('**/api/v1/devices', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([...responsiveDevices, ...layoutDevices]) });
    });
    await page.route('**/api/v1/scenes', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/automations', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: '[]' });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');

    const canvas = page.locator('.homepilot-dashboard-content > div.grid');
    const section = (title: string) => page.locator('.homepilot-dashboard-widget').filter({
      has: page.getByRole('heading', { name: title, exact: true }),
    });
    await expect(section('Tech')).toBeVisible();
    await expect(section('Patio')).toBeVisible();

    const geometry = async (title: string) => section(title).evaluate((element) => {
      const content = element.querySelector(':scope > div > section') as HTMLElement | null;
      const cardGrid = content?.querySelector(':scope > div.grid') as HTMLElement | null;
      const canvasElement = document.querySelector('.homepilot-dashboard-content > div.grid') as HTMLElement | null;
      if (!content || !cardGrid || !canvasElement) throw new Error('Dashboard section geometry is unavailable');
      const tracks = (template: string) => template.split(/\s+/).map(Number.parseFloat).filter((width) => Number.isFinite(width) && width > 1);
      const sectionRect = element.getBoundingClientRect();
      const gridRect = cardGrid.getBoundingClientRect();
      const canvasRect = canvasElement.getBoundingClientRect();
      const heading = content.querySelector(':scope > h2') as HTMLElement | null;
      const cardRects = [...cardGrid.querySelectorAll<HTMLElement>(':scope > [data-card-id]')]
        .map((card) => card.getBoundingClientRect());
      const addCardButton = content.querySelector<HTMLElement>('button[aria-label="Add card"], button[aria-label="Añadir tarjeta"]');
      const toolbar = element.querySelector<HTMLElement>(':scope > div.absolute.z-30');
      const addCardRect = addCardButton?.getBoundingClientRect();
      const toolbarRect = toolbar?.getBoundingClientRect();
      return {
        sectionWidth: sectionRect.width,
        sectionHeight: sectionRect.height,
        contentWidth: content.getBoundingClientRect().width,
        cardGridWidth: gridRect.width,
        cardGridHeight: gridRect.height,
        cardGridTop: gridRect.top,
        titleTop: (heading?.getBoundingClientRect().top ?? sectionRect.top) - sectionRect.top,
        titleToCards: cardRects[0] ? cardRects[0].top - (heading?.getBoundingClientRect().bottom ?? 0) : 0,
        sectionBackground: getComputedStyle(element).backgroundColor,
        cardTopOffsets: cardRects.map((card) => card.top - gridRect.top),
        rowGap: getComputedStyle(cardGrid).rowGap,
        transitionProperty: getComputedStyle(element).transitionProperty,
        canvasTransitionProperty: getComputedStyle(canvasElement).transitionProperty,
        canvasTransitionDuration: getComputedStyle(canvasElement).transitionDuration,
        cardTracks: tracks(getComputedStyle(cardGrid).gridTemplateColumns),
        canvasWidth: canvasElement.getBoundingClientRect().width,
        canvasTracks: tracks(getComputedStyle(canvasElement).gridTemplateColumns),
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineOffset: getComputedStyle(element).outlineOffset,
        toolbarPosition: getComputedStyle(toolbar ?? element).position,
        addCardLeft: addCardRect?.left ?? null,
        addCardRight: addCardRect?.right ?? null,
        addCardTop: addCardRect?.top ?? null,
        addCardBottom: addCardRect?.bottom ?? null,
        toolbarTop: toolbarRect?.top ?? null,
        toolbarLeft: toolbarRect?.left ?? null,
        sectionLeft: sectionRect.left,
        sectionRight: sectionRect.right,
        canvasLeft: canvasRect.left,
        canvasRight: canvasRect.right,
        gridBottom: gridRect.bottom,
        addCardInsideGrid: addCardButton ? cardGrid.contains(addCardButton) : false,
      };
    });
    const settleLayout = () => page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await settleLayout();
    const view = await Promise.all(['Tech', 'Patio'].map(geometry));

    await enterDashboardEdit(page);
    await expect(page.getByRole('button', { name: /^(Drag to reorder|Arrastrar para reordenar): Tech$/i })).toBeVisible();
    await settleLayout();
    const edit = await Promise.all(['Tech', 'Patio'].map(geometry));

    await expect(page.getByRole('button', { name: /^(Add title|Añadir título)$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Add section|Añadir sección)$/i })).toBeVisible();
    const addTitle = canvas.getByRole('button', { name: /^(Add title|Añadir título)$/i });
    await expect(addTitle).toHaveCount(1);
    const titleBeforeSections = await addTitle.evaluate(element => {
      const section = document.querySelector('.homepilot-dashboard-content .homepilot-dashboard-widget');
      return section !== null && Boolean(element.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(titleBeforeSections).toBe(true);

    const expectSameWidth = (before: number, after: number, label: string) => {
      expect(Math.abs(after - before), `${viewport.name}: ${label}`).toBeLessThanOrEqual(2);
    };
    for (let index = 0; index < view.length; index += 1) {
      const before = view[index]!;
      const after = edit[index]!;
      expect(before.sectionHeight).toBeGreaterThan(0);
      expect(after.sectionHeight).toBeGreaterThan(0);
      expect(before.sectionHeight).toBeGreaterThanOrEqual(before.cardGridHeight);
      expect(after.sectionHeight).toBeGreaterThanOrEqual(after.cardGridHeight);
      // Floating edit controls reserve no extra row: the entire shell and
      // card grid retain their view-mode geometry, not just the card widths.
      expect(Math.abs(after.sectionHeight - before.sectionHeight)).toBeLessThanOrEqual(2);
      expect(Math.abs(after.cardGridHeight - before.cardGridHeight)).toBeLessThanOrEqual(2);
      expect(Math.abs(after.titleTop - before.titleTop)).toBeLessThanOrEqual(2);
      expect(Math.abs(after.titleToCards - before.titleToCards)).toBeLessThanOrEqual(2);
      expect(before.titleTop).toBeGreaterThanOrEqual(8);
      expect(before.sectionBackground).not.toBe('rgba(0, 0, 0, 0)');
      expect(after.sectionBackground).toBe(before.sectionBackground);
      expect(before.rowGap).toBe('8px');
      expect(after.rowGap).toBe('8px');
      expect(after.cardTopOffsets).toHaveLength(before.cardTopOffsets.length);
      before.cardTopOffsets.forEach((top, card) => {
        expect(Math.abs(after.cardTopOffsets[card]! - top), `${viewport.name}: card ${card + 1} vertical position`).toBeLessThanOrEqual(2);
      });
      expect(after.transitionProperty).not.toContain('all');
      expect(after.transitionProperty).not.toContain('outline');
      expect(after.transitionProperty).toContain('transform');
      expect(after.transitionProperty).toContain('box-shadow');
      expect(after.transitionProperty).toContain('background-color');
      expect(after.transitionProperty).toContain('border-color');
      // CSS defaults transition-property to "all" even when duration is 0s.
      // An effective zero duration means the canvas cannot animate its outline.
      expect(
        after.canvasTransitionDuration.split(',').every((duration) => Number.parseFloat(duration.trim()) === 0),
        `${viewport.name}: canvas transition-property ${after.canvasTransitionProperty} must have zero duration`,
      ).toBe(true);
      expectSameWidth(before.sectionWidth, after.sectionWidth, `section ${index + 1}`);
      expectSameWidth(before.contentWidth, after.contentWidth, `section content ${index + 1}`);
      expectSameWidth(before.cardGridWidth, after.cardGridWidth, `card grid ${index + 1}`);
      expectSameWidth(before.canvasWidth, after.canvasWidth, 'canvas');
      expect(after.canvasTracks).toHaveLength(before.canvasTracks.length);
      expect(after.cardTracks).toHaveLength(before.cardTracks.length);
      before.canvasTracks.forEach((width, track) => expectSameWidth(width, after.canvasTracks[track]!, `canvas track ${track + 1}`));
      before.cardTracks.forEach((width, track) => expectSameWidth(width, after.cardTracks[track]!, `card track ${track + 1}`));
      expect(after.outlineStyle).toBe('dashed');
      expect(Number.parseFloat(after.outlineOffset)).toBeLessThanOrEqual(-2);
      expect(after.sectionLeft).toBeGreaterThanOrEqual(after.canvasLeft - 1);
      expect(after.sectionRight).toBeLessThanOrEqual(after.canvasRight + 1);
      expect(after.toolbarPosition).toBe('absolute');
      expect(after.addCardInsideGrid).toBe(false);
      if (after.addCardLeft === null || after.addCardRight === null || after.addCardTop === null || after.addCardBottom === null || after.toolbarTop === null || after.toolbarLeft === null) {
        throw new Error(`${viewport.name}: edit controls are missing`);
      }
      expect(after.addCardLeft).toBeGreaterThanOrEqual(after.sectionLeft);
      expect(after.addCardRight).toBeLessThanOrEqual(after.sectionRight);
      expect(Math.abs(after.addCardTop - after.toolbarTop)).toBeLessThanOrEqual(2);
      expect(after.addCardBottom).toBeLessThanOrEqual(after.cardGridTop);
    }
  });
}

test('Feature: Section card editing — Scenario: An owner adds and configures a card without losing the dashboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);
  let savedDashboard = responsiveDashboard;
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const changes = route.request().postDataJSON() as Partial<typeof responsiveDashboard>;
    savedDashboard = { ...savedDashboard, ...changes };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(savedDashboard) });
  });
  await page.route('**/api/v1/scenes', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/automations', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');

  await enterDashboardEdit(page);
  const originalCardCount = await page.locator('[class*="group/card"]').count();
  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  await expect(page.getByRole('heading', { name: /Add card to section|Añadir tarjeta a la sección/i })).toBeVisible();

  await page.locator('.max-h-section-editor > div > div > button').first().click();
  await expect(page.getByRole('heading', { name: /^(Edit|Editar)$/i })).toBeVisible();
  await page.getByRole('button', { name: /^(Save|Guardar)$/i }).click();

  await expect(page.getByRole('heading', { name: /Add card to section|Añadir tarjeta a la sección/i })).toHaveCount(0);
  await expect(page.locator('[class*="group/card"]')).toHaveCount(originalCardCount + 1);
  await expect(page.getByText('Lecturas del hogar')).toBeVisible();
});

test('Feature: Section appearance — Scenario: An owner can select and clear an optional section icon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  const dashboard = {
    ...responsiveDashboard,
    tabs: [{
      ...responsiveDashboard.tabs[0]!,
      widgets: [responsiveDashboard.tabs[0]!.widgets[0]!, section, {
        ...section,
        id: 'section-with-icon',
        config: {
          ...section.config,
          layout: { ...section.config.layout, y: 5 },
          binding: { ...section.config.binding, entityId: 'section-with-icon' },
          appearance: { ...section.config.appearance, title: 'Con icono', icon: 'mdi:home' },
          extra: { cards: [] },
        },
      }],
    }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  let savedDashboard = dashboard;
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const changes = route.request().postDataJSON() as Partial<typeof dashboard>;
    savedDashboard = { ...savedDashboard, ...changes };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(savedDashboard) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');

  const sectionWithoutIcon = page.locator('.homepilot-dashboard-widget').filter({ has: page.getByRole('heading', { name: 'Lecturas del hogar', exact: true }) });
  const sectionWithIcon = page.locator('.homepilot-dashboard-widget').filter({ has: page.getByRole('heading', { name: 'Con icono', exact: true }) });
  await expect(sectionWithoutIcon.locator('.homepilot-dashboard-section-heading svg')).toHaveCount(0);
  await expect(sectionWithIcon.locator('.homepilot-dashboard-section-heading svg')).toHaveCount(1);
  const sectionPadding = await sectionWithoutIcon.locator('section').evaluate((element) => ({
    left: getComputedStyle(element).paddingLeft,
    right: getComputedStyle(element).paddingRight,
  }));
  expect(sectionPadding).toEqual({ left: '20px', right: '20px' });

  await enterDashboardEdit(page);
  await openSectionEditor(page, sectionWithoutIcon);
  const editor = page.getByRole('dialog', { name: /^(Edit section|Editar sección)$/i });
  const preview = editor.getByRole('group', { name: /^(Section preview|Vista previa de la sección)$/i });
  await expect(preview.locator('svg')).toHaveCount(0);
  await editor.getByRole('button', { name: /^(Icon|Icono)$/i }).click();
  const iconPicker = page.getByRole('dialog', { name: /^(Icon|Icono)$/i });
  const iconSearch = iconPicker.getByRole('searchbox');
  await expect(iconSearch).toBeFocused();
  await iconSearch.fill('home');
  await expect(iconSearch).toHaveValue('home');
  await expect(editor.getByRole('textbox', { name: /^(Section title|Título de sección)$/i })).toHaveValue('Lecturas del hogar');
  await iconPicker.getByRole('listbox', { name: /^(Icon|Icono)$/i }).getByRole('option', { name: 'home', exact: true }).click();
  await expect(preview.locator('svg')).toHaveCount(1);
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect(sectionWithoutIcon.locator('.homepilot-dashboard-section-heading svg')).toHaveCount(1);
  expect(savedDashboard.tabs[0]?.widgets.find((widget) => widget.id === 'responsive-section')?.config.appearance).toHaveProperty('icon', 'mdi:home');

  await openSectionEditor(page, sectionWithoutIcon);
  await editor.getByRole('button', { name: /^(Remove icon|Quitar icono)$/i }).click();
  await expect(preview.locator('svg')).toHaveCount(0);
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect(sectionWithoutIcon.locator('.homepilot-dashboard-section-heading svg')).toHaveCount(0);
  await expect(sectionWithIcon.locator('.homepilot-dashboard-section-heading svg')).toHaveCount(1);
  expect(savedDashboard.tabs[0]?.widgets.find((widget) => widget.id === 'responsive-section')?.config.appearance).not.toHaveProperty('icon');
});

test.describe('Icon picker on touch tablets', () => {
  test.use({ hasTouch: true });

  for (const viewport of [
    { name: 'portrait', width: 820, height: 1180, keyboardHeight: 520 },
    { name: 'landscape', width: 1180, height: 820, keyboardHeight: 400 },
  ]) {
    test(`opens the icon grid before the keyboard and keeps results visible in tablet ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareAuthenticatedDashboard(page);
      await page.goto('/dashboards/responsive-dashboard/responsive-tab');
      await enterDashboardEdit(page, true);
      const section = page.locator('.homepilot-dashboard-widget').filter({ has: page.getByRole('heading', { name: 'Lecturas del hogar', exact: true }) });
      await openSectionEditor(page, section, true);
      const editor = page.getByRole('dialog', { name: /^(Edit section|Editar sección)$/i });
      await editor.getByRole('button', { name: /^(Icon|Icono)$/i }).tap();
      const picker = page.getByRole('dialog', { name: /^(Icon|Icono)$/i });
      const search = picker.getByRole('searchbox');
      await expect(picker).toBeFocused();
      await expect(search).not.toBeFocused();
      await expect(picker.getByRole('option').first()).toBeVisible();

      await search.tap();
      await expect(search).toBeFocused();
      await search.fill('home');
      await page.setViewportSize({ width: viewport.width, height: viewport.keyboardHeight });
      const option = picker.getByRole('listbox').getByRole('option', { name: 'home', exact: true });
      await expect(option).toBeVisible();
      // Resize dispatch and React's visualViewport bounds update are
      // asynchronous. Visibility alone also accepts an off-screen option.
      // Require the complete option to fit without scrolling it into place.
      await expect(option).toBeInViewport({ ratio: 1 });
      await expect.poll(async () => {
        const bounds = await option.boundingBox();
        return bounds ? bounds.y + bounds.height : Infinity;
      }).toBeLessThanOrEqual(viewport.keyboardHeight);
      await option.tap();
      await expect(picker).toHaveCount(0);
    });
  }
});

test('Feature: Button cards — Scenario: Light and scene-action buttons share a 24px surface in active and inactive states', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  const buttonCards = [
    { id: 'light-on-card', kind: 'light', title: 'Luz activa', entityId: 'light-on', span: 'small' },
    { id: 'light-off-card', kind: 'light', title: 'Luz inactiva', entityId: 'light-off', span: 'small' },
    { id: 'scene-action-card', kind: 'action', title: 'Escena', entityId: 'scene-1', span: 'small' },
  ];
  const dashboard = {
    ...responsiveDashboard,
    tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [responsiveDashboard.tabs[0]!.widgets[0]!, {
      ...section,
      config: { ...section.config, extra: { cards: buttonCards } },
    }] }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([
      { id: 'light-on', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Luz activa', type: 'light', semanticType: 'light', status: 'ASSIGNED', lastKnownState: { state: 'on' } },
      { id: 'light-off', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Luz inactiva', type: 'light', semanticType: 'light', status: 'ASSIGNED', lastKnownState: { state: 'off' } },
    ]) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');

  const geometry = async (id: string) => page.locator(`[data-dashboard-card-id="${id}"] > :first-child`).evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return { radius: style.borderRadius, width: bounds.width, height: bounds.height, padding: style.padding };
  });
  await expect(page.locator('[data-dashboard-card-id="light-on-card"]')).toBeVisible();
  await expect(page.locator('[data-dashboard-card-id="light-off-card"]')).toBeVisible();
  await expect(page.locator('[data-dashboard-card-id="scene-action-card"]')).toBeVisible();
  const active = await geometry('light-on-card');
  const inactive = await geometry('light-off-card');
  const action = await geometry('scene-action-card');
  expect(active.radius).toBe('24px');
  expect(inactive).toEqual(active);
  expect(action.radius).toBe('24px');
  expect(action.padding).toBe(inactive.padding);

  const inactiveSurface = async (id: string) => page.locator(`[data-dashboard-card-id="${id}"] > :first-child`).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderWidth: style.borderWidth,
      borderStyle: style.borderStyle,
      boxSizing: style.boxSizing,
      backgroundColor: style.backgroundColor,
    };
  });
  expect(await inactiveSurface('scene-action-card')).toEqual(await inactiveSurface('light-off-card'));
});

test('Feature: Clock editing — Scenario: A section clock can be resized with bounded design and moved or removed', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  if (!('extra' in section.config)) throw new Error('Responsive fixture has no section cards');
  const dashboard = {
    ...responsiveDashboard,
    tabs: [{
      ...responsiveDashboard.tabs[0]!,
      widgets: [responsiveDashboard.tabs[0]!.widgets[0]!, {
        ...section,
        config: {
          ...section.config,
          extra: { ...section.config.extra, cards: [
            section.config.extra.cards[4]!,
            { ...section.config.extra.cards[0]!, span: 'full' },
          ] },
        },
      }],
    }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  let savedDashboard = dashboard;
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const changes = route.request().postDataJSON() as Partial<typeof dashboard>;
    savedDashboard = { ...savedDashboard, ...changes };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(savedDashboard) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);

  const clock = page.locator('[data-dashboard-card-id="responsive-weather"]');
  const sensor = page.locator('[data-dashboard-card-id="responsive-sensor"]');
  const cardActions = /^(Card actions|Acciones de tarjeta)$/i;
  const edit = /^(Edit|Editar)$/i;
  await expect(clock.getByRole('button', { name: edit })).toHaveCount(1);
  await clock.hover();
  await expect(clock.getByRole('button', { name: cardActions })).toHaveCount(0);
  await clock.getByRole('button', { name: edit }).click();
  const clockEditor = page.getByRole('dialog', { name: edit });
  await clockEditor.getByRole('radio', { name: /^(Design|Diseño)$/i }).click();
  const grid = clockEditor.getByRole('grid');
  await expect(clockEditor.getByRole('button', { name: /^(Auto|Automático|Automatic)$/i })).toHaveCount(0);
  await grid.focus();
  for (let i = 0; i < 20; i++) { await grid.press('ArrowLeft'); await grid.press('ArrowUp'); }
  await expect(grid.getByRole('gridcell', { name: /: 4, .*: 4$/i })).toHaveAttribute('aria-selected', 'true');
  for (let i = 0; i < 20; i++) { await grid.press('ArrowRight'); await grid.press('ArrowDown'); }
  await expect(grid.getByRole('gridcell', { name: /: 12, .*: 8$/i })).toHaveAttribute('aria-selected', 'true');
  await expect(grid.getByRole('gridcell', { name: /: 2, .*: 2$/i })).toHaveAttribute('aria-disabled', 'true');
  await grid.getByRole('gridcell', { name: /: 6, .*: 6$/i }).click();
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const preview = clockEditor.locator('[data-card-editor-preview]');
    for (const size of [{ columns: 6, rows: 6 }, { columns: 12, rows: 8 }]) {
    await grid.getByRole('gridcell', { name: new RegExp(`: ${size.columns}, .*: ${size.rows}$`, 'i') }).click();
    // Measure the same frame: resize observers and layout transitions settle asynchronously.
    await expect.poll(() => preview.evaluate(element => {
      const face = element.querySelector('.homepilot-clock-reference-dial-frame')!.getBoundingClientRect();
      const card = element.querySelector('.homepilot-sized-card')!.getBoundingClientRect();
      const brandElement = element.querySelector('.homepilot-clock-reference-brand')!;
      const brand = brandElement.getBoundingClientRect();
      return { left: face.left >= card.left, top: face.top >= card.top, right: face.right <= card.right + 1, bottom: face.bottom <= card.bottom + 1, brandFits: brand.width <= face.width + 1 && brandElement.scrollWidth <= brandElement.clientWidth };
    })).toEqual({ left: true, top: true, right: true, bottom: true, brandFits: true });
    }
    if (width === 390 || width === 1024) await page.screenshot({ path: testInfo.outputPath(`clock-editor-${width}.png`), animations: 'disabled' });
  }
  await grid.getByRole('gridcell', { name: /: 6, .*: 6$/i }).click();
  await clockEditor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect(clockEditor).not.toBeVisible();
  await expect.poll(() => JSON.stringify(savedDashboard)).toContain('"minColumns":4');
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const sidebarBackdrop = page.getByTestId('mobile-sidebar-backdrop');
    if (await sidebarBackdrop.isVisible()) await sidebarBackdrop.click({ position: { x: viewport.width - 16, y: 96 } });
    await expect(clock.locator('[data-homepilot-clock]')).toBeVisible();
    await expect(clock.locator('.homepilot-clock-reference-weather')).not.toBeVisible();
    // Read both boxes in one frame; viewport/sidebar transitions can move the
    // whole card between separate boundingBox calls without any dial overflow.
    await expect.poll(() => clock.evaluate(element => {
      const exterior = element.getBoundingClientRect();
      const dial = element.querySelector('.homepilot-clock-reference-dial-frame')!.getBoundingClientRect();
      return dial.bottom - exterior.bottom;
    })).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
    if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({ path: testInfo.outputPath(`clock-resized-${viewport.width}.png`), animations: 'disabled' });
  }
  await expect(sensor.getByRole('button', { name: edit })).toHaveCount(1);
  await sensor.hover();
  await sensor.getByRole('button', { name: edit }).click();
  await expect(page.getByRole('heading', { name: edit })).toBeVisible();
  await page.getByRole('button', { name: /^(Close|Cerrar)$/i }).click();

  await clock.dragTo(sensor, { steps: 10 });
  await expect.poll(() => {
    const savedSection = savedDashboard.tabs[0]?.widgets.find((widget) => widget.id === 'responsive-section');
    if (!savedSection || !('extra' in savedSection.config)) return [];
    return savedSection.config.extra.cards.map((card) => card.id);
  }).toEqual(['responsive-sensor', 'responsive-weather']);

  await clock.hover();
  await clock.getByRole('button', { name: edit }).click();
  await page.getByRole('dialog', { name: edit }).getByRole('button', { name: /^(Delete|Eliminar)$/i }).click();
  await page.getByRole('dialog', { name: /^(Delete|Eliminar)$/i }).getByRole('button', { name: /^(Delete|Eliminar)$/i }).click();
  await expect(clock).toHaveCount(0);

  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  const cardCatalog = page.locator('.max-h-section-modal').filter({
    has: page.getByRole('heading', { name: /^(Add card to section|Añadir tarjeta a la sección)$/i }),
  });
  await cardCatalog.getByRole('button', { name: /^(Clock|Reloj)$/i })
    .and(cardCatalog.locator('.max-h-section-editor > div > div > button[type="button"]'))
    .click();
  await expect(page.getByRole('heading', { name: /^(Add card to section|Añadir tarjeta a la sección)$/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: edit })).toBeVisible();
  await page.getByRole('button', { name: /^(Close|Cerrar)$/i }).click();
  await expect(page.locator('[data-homepilot-clock]')).toHaveCount(1);
});

test('Feature: Clock editing — Scenario: A standalone clock shares the bounded design contract (AC56)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const dashboard = {
    ...responsiveDashboard,
    tabs: [{
      ...responsiveDashboard.tabs[0]!,
      widgets: [responsiveDashboard.tabs[0]!.widgets[0]!, {
        id: 'standalone-clock',
        type: 'clock_display',
        config: {
          layout: { x: 0, y: 1, w: 3, h: 4, span: 3 },
          binding: { entityId: 'standalone-clock', entityType: 'system', entityName: 'Reloj' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: { title: 'Reloj', showTitle: true },
        },
      }],
    }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  let savedDashboard = dashboard;
  await page.route('**/api/v1/dashboards/responsive-dashboard', async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    savedDashboard = { ...savedDashboard, ...route.request().postDataJSON() as Partial<typeof dashboard> };
    await route.fulfill({ json: savedDashboard });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);

  const clock = page.locator('.homepilot-dashboard-widget').filter({ has: page.locator('[data-homepilot-clock]') });
  await expect(clock).toHaveCount(1);
  await expect(clock.getByRole('button', { name: /^(Configure|Configurar)$/i })).toHaveCount(1);
  await expect(clock.getByRole('button', { name: /^(Drag to reorder|Arrastrar para reordenar)$/i })).toBeVisible();
  await expect(clock.getByRole('button', { name: /^(Delete|Eliminar)$/i })).toBeVisible();
  await clock.getByRole('button', { name: /^(Configure|Configurar)$/i }).click();
  const editor = page.getByRole('dialog', { name: /^(Edit|Editar)$/i });
  const grid = editor.getByRole('grid');
  await grid.focus();
  for (let i = 0; i < 20; i++) { await grid.press('ArrowLeft'); await grid.press('ArrowUp'); }
  await expect(grid.getByRole('gridcell', { name: /: 4, .*: 4$/i })).toHaveAttribute('aria-selected', 'true');
  for (let i = 0; i < 20; i++) { await grid.press('ArrowRight'); await grid.press('ArrowDown'); }
  await expect(grid.getByRole('gridcell', { name: /: 12, .*: 8$/i })).toHaveAttribute('aria-selected', 'true');
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect(editor).not.toBeVisible();
  // Editing adds a separate toolbar above the clock; the outer widget is not
  // the size container in this mode. Protect the actual 8-row clock surface.
  const renderedClock = clock.locator('[data-homepilot-clock]');
  await expect.poll(() => renderedClock.evaluate(element => {
    let frame: HTMLElement | null = element as HTMLElement;
    while (frame && !getComputedStyle(frame).containerName.split(' ').includes('clock-card')) frame = frame.parentElement;
    if (!frame) throw new Error('Standalone clock has no sizing container');
    return getComputedStyle(frame).height;
  })).toBe('216px');
  await expect(clock.locator('[data-clock-edit-tools]')).toHaveCount(1);
  await expect.poll(() => renderedClock.evaluate(element => {
    let frame: HTMLElement | null = element as HTMLElement;
    while (frame && !getComputedStyle(frame).containerName.split(' ').includes('clock-card')) frame = frame.parentElement;
    const tools = element.closest('.homepilot-dashboard-widget')?.querySelector('[data-clock-edit-tools]');
    if (!frame || !tools) throw new Error('Standalone clock edit geometry missing');
    return tools.getBoundingClientRect().bottom <= frame.getBoundingClientRect().top;
  })).toBe(true);
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Done|Finalizar)$/i }).click();
  await expect(clock.locator('[data-clock-edit-tools]')).toHaveCount(0);
  await expect(clock).toHaveCSS('height', '216px');
});

test('Feature: Media card width — Scenario: A player occupies the full section without a redundant width control', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  let savedDashboard = responsiveDashboard;
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const changes = route.request().postDataJSON() as Partial<typeof responsiveDashboard>;
    savedDashboard = { ...savedDashboard, ...changes };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(savedDashboard) });
  });
  await page.route('**/api/v1/scenes', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/automations', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  await page.getByRole('button', { name: /^(Reproductor|Media player)$/i }).click();

  const editorHeading = page.getByRole('heading', { name: /^(Edit|Editar)$/i });
  await expect(editorHeading).toBeVisible();
  const editor = page.getByRole('dialog', { name: /^(Edit|Editar)$/i });
  const editorPreview = editor.getByRole('region', { name: /^(Preview|Vista previa)$/i });
  await expect(editor.getByRole('button', { name: /^(Premium)$/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(editorPreview.locator('[data-media-player="homepilot-premium"]')).toBeVisible();
  await expect(editor.getByText(/^(Card width|Ancho de tarjeta)$/i)).toHaveCount(0);
  await page.getByRole('button', { name: /^(Save|Guardar)$/i }).click();

  const mediaCard = page.locator('[class*="group/card"]').filter({ hasText: /Reproductor|Media player/i });
  await expect(mediaCard.locator('[data-media-player="homepilot-premium"]')).toBeVisible();
  await expect(mediaCard).toHaveClass(/col-span-full/);
  await expect(mediaCard.getByRole('slider', { name: /resize (?:the )?card|redimensionar/i })).toHaveCount(0);
  await expect.poll(() => {
    const section = savedDashboard.tabs[0]?.widgets.find((widget) => widget.id === 'responsive-section');
    if (!section || !('extra' in section.config)) return undefined;
    const mediaCard = (section.config.extra.cards as Array<{ kind: string; mediaVariant?: string }>).find((card) => card.kind === 'media');
    return mediaCard?.mediaVariant;
  }).toBe('premium');
});

test('Feature: Media Player design — Scenario: Classic preview and persisted design retain the same player controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  const dashboard = {
    ...responsiveDashboard,
    tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [{
      ...section,
      config: { ...section.config, extra: { cards: [{ id: 'media-design', kind: 'media', title: 'Sala', entityId: 'player-1', span: 'full' }] } },
    }] }],
  };
  let savedDashboard: object = dashboard;
  const player = {
    id: 'player-1', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Sala', type: 'media_player', status: 'ASSIGNED',
    profile: { supportedCommands: ['media_play', 'media_pause', 'volume_set'] },
    lastKnownState: { state: 'paused', attributes: { media_title: 'Canción', media_artist: 'Artista', volume_level: 0.4 } },
  };
  const commands: unknown[] = [];
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/dashboards', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([savedDashboard]) });
  });
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    savedDashboard = { ...savedDashboard, ...(route.request().postDataJSON() as object) };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(savedDashboard) });
  });
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([player]) });
  });
  await page.route('**/api/v1/devices/player-1/command', async (route) => {
    commands.push(route.request().postDataJSON());
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(player) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');

  const card = page.locator('[data-dashboard-card-id="media-design"]');
  await expect(card.locator('[data-media-player="homepilot-premium"]')).toBeVisible();
  await expect(card.getByText('Canción')).toBeVisible();
  await card.getByRole('button', { name: /^(Play|Reproducir)$/i }).click();
  await expect.poll(() => commands.length).toBe(1);

  await enterDashboardEdit(page);
  await card.hover();
  await card.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  await expect(page.getByRole('button', { name: /^(Premium)$/i })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^(Classic|Clásico)$/i }).click();
  await expect(page.getByRole('button', { name: /^(Classic|Clásico)$/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-media-player="homepilot-classic"]')).toBeVisible();
  await page.getByRole('button', { name: /^(Save|Guardar)$/i }).click();

  const persistedMedia = () => {
    const stored = savedDashboard as { tabs: Array<{ widgets: Array<{ id: string; config: { extra?: { cards?: Array<{ id: string; entityId?: string; mediaVariant?: string }> } } }> }> };
    return stored.tabs[0]?.widgets.find((widget) => widget.id === 'responsive-section')?.config.extra?.cards?.find((item) => item.id === 'media-design');
  };
  await expect.poll(() => persistedMedia()?.mediaVariant).toBe('classic');
  expect(persistedMedia()?.entityId).toBe('player-1');
  await page.reload();
  await expect(card.locator('[data-media-player="homepilot-classic"]')).toBeVisible();
  await expect(card.getByText('Canción')).toBeVisible();
  await card.getByRole('button', { name: /^(Play|Reproducir)$/i }).click();
  await expect.poll(() => commands.length).toBe(2);
  expect(commands[1]).toEqual(commands[0]);
});

for (const mediaVariant of ['premium', 'classic'] as const) {
test(`Feature: Media player idle — Scenario: ${mediaVariant} reports no playback without stale metadata or changing its controls`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  const mediaDashboard = {
    ...responsiveDashboard,
    tabs: [{
      ...responsiveDashboard.tabs[0]!,
      widgets: [{
        ...section,
        config: {
          ...section.config,
          extra: { cards: [{ id: 'media-idle', kind: 'media', mediaVariant, title: 'Sala', entityId: 'player-1', span: 'full' }] },
        },
      }],
    }],
  };
  await prepareAuthenticatedDashboard(page, mediaDashboard);
  let mediaState = 'idle';
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{
      id: 'player-1', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Sala',
      type: 'media_player', status: 'ASSIGNED',
      profile: { supportedCommands: ['media_play', 'media_pause', 'volume_set'] },
      lastKnownState: mediaState === 'idle'
        ? { state: 'idle', attributes: { media_title: 'Previous session', media_artist: 'Previous artist', entity_picture: '/old-cover.png', volume_level: 0.4 } }
        : { state: 'playing', attributes: { media_title: 'Canción actual', media_artist: 'Artista actual', volume_level: 0.4, ...(mediaVariant === 'classic' ? { media_duration: 180, media_position: 42 } : {}) } },
    }]) });
  });

  const volumeCommands: unknown[] = [];
  await page.route('**/api/v1/devices/player-1/command', route => { volumeCommands.push(route.request().postDataJSON()); return route.fulfill({ json: {} }); });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  const card = page.locator('[data-dashboard-card-id="media-idle"]');
  await expect(card).toBeVisible();
  await expect(card.getByText(/^(Sin reproducción|Nothing playing)$/)).toBeVisible();
  await expect(card).toContainText('Sala');
  await expect(card).not.toContainText('Previous session');
  await expect(card).not.toContainText('Previous artist');
  await expect(card.locator('img')).toHaveCount(0);
  await expect(card.getByRole('button', { name: /^(Reproducir|Play)$/i })).toBeVisible();
  await expect(card.getByRole('button', { name: /^(Reproducir|Play)$/i })).toBeEnabled();
  const volumeSlider = card.getByRole('slider');
  await expect(volumeSlider).toBeEnabled();
  await volumeSlider.fill('65');
  expect(volumeCommands).toHaveLength(0);
  await volumeSlider.dispatchEvent('pointerup');
  await expect.poll(() => JSON.stringify(volumeCommands)).toContain('65');
  await volumeSlider.fill('70');
  await volumeSlider.dispatchEvent('keyup', { key: 'ArrowRight' });
  await expect.poll(() => JSON.stringify(volumeCommands)).toContain('70');
  const idleHeight = await card.evaluate((element) => element.getBoundingClientRect().height);
  const idlePlay = (await card.getByRole('button', { name: /^(Play|Reproducir)$/i }).boundingBox())!;
  const idleControls = await card.locator('button').count();

  mediaState = 'playing';
  await page.reload();
  await expect(card.getByText('Canción actual')).toBeVisible();
  await expect(card.getByText('Artista actual')).toBeVisible();
  await expect(card.getByText(/^(Sin reproducción|Nothing playing)$/)).toHaveCount(0);
  expect(await card.locator('button').count()).toBe(idleControls);
  expect(Math.abs((await card.evaluate((element) => element.getBoundingClientRect().height)) - idleHeight)).toBeLessThanOrEqual(2);
  if (mediaVariant === 'classic') {
    const playingPause = (await card.getByRole('button', { name: /^(Pause|Pausar)$/i }).boundingBox())!;
    expect(playingPause.y).toBeCloseTo(idlePlay.y, 1);
    await expect(card.locator('[data-media-progress-slot]')).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1441);

  await enterDashboardEdit(page);
  await expect(card.locator('[data-media-player] > div').first().locator('p').first().locator('..').locator('svg')).toHaveCount(0);
  await card.hover();
  await card.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  await expect(page.getByRole('dialog', { name: /^(Edit|Editar)$/i })).toBeVisible();
});
}

test('Feature: Button card default — Scenario: A new button persists the first width and previews an inactive compact tile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);
  let savedDashboard = responsiveDashboard;
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const changes = route.request().postDataJSON() as Partial<typeof responsiveDashboard>;
    savedDashboard = { ...savedDashboard, ...changes };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(savedDashboard) });
  });
  await page.route('**/api/v1/scenes', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/automations', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  const catalogButton = page.getByRole('button', { name: /^(Button|Botón)$/i });
  const catalogCard = catalogButton.locator('..');
  const catalogSpacing = await catalogCard.evaluate((element) => {
    const lastLabel = element.querySelector(':scope > div:nth-child(2) > span:last-child');
    return lastLabel ? element.getBoundingClientRect().bottom - lastLabel.getBoundingClientRect().bottom : Number.POSITIVE_INFINITY;
  });
  expect(catalogSpacing).toBeLessThanOrEqual(24);
  await catalogButton.click();

  const editor = page.getByRole('dialog', { name: /^(Edit|Editar)$/i });
  const preview = editor.locator('[data-card-editor-preview] .homepilot-sized-card').first();
  await expect(preview).toBeVisible();
  await expect(preview.locator('.homepilot-section-light-tile-active')).toHaveCount(0);
  await expect(preview.locator('.homepilot-section-tile-inactive')).toBeVisible();
  await expect(preview.getByText(/^(Button|Botón)$/i)).toBeVisible();

  await editor.getByRole('radio', { name: /^(Design|Diseño)$/i }).click();
  const sizingGrid = editor.getByRole('grid', { name: /^(Design|Diseño)$/i });
  await expect(sizingGrid.locator('[role="gridcell"][aria-selected="true"]'))
    .toHaveAttribute('aria-label', /^(Columns \(of 12\)|Columnas \(de 12\)): 3, (Rows|Filas): 2$/i);

  const previewBox = await preview.boundingBox();
  expect(previewBox?.height).toBeLessThanOrEqual(98);
  expect(await preview.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);

  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  const buttonCard = page.locator('[data-dashboard-card-id]').filter({ hasText: /^(Button|Botón)$/i }).last();
  await expect(buttonCard).toHaveClass(/sm:col-span-3/);
  await expect.poll(() => JSON.stringify(savedDashboard)).toMatch(/"kind":"light"[^}]*"span":"small"/);
});

test('Feature: Dashboard import — Scenario: Pending bindings and local backgrounds are reported without exposing source IDs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/dashboards/responsive-dashboard/tabs/import', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ...responsiveDashboard,
        tabs: [...responsiveDashboard.tabs, { ...responsiveDashboard.tabs[0], id: 'imported-tab', isDefault: false }],
        importReport: {
          unresolvedBindings: [{ tabTitle: 'Principal', widgetId: 'imported-widget', cardId: 'card-1', title: 'Luz', targetType: 'device' }],
          nonPortableBackgrounds: 1,
        },
      }),
    });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await page.locator('.homepilot-dashboard-titlebar input[type="file"]').setInputFiles({
    name: 'dashboard.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'homepilot-dashboard-tab', version: 1, tab: { id: 'portable-tab', title: 'Principal', widgets: [] } })),
  });

  await expect(page.getByText(/Pestaña importada con asignaciones pendientes|Tab imported with pending assignments/i)).toBeVisible();
  await expect(page.getByText(/Asignaciones sin resolver: 1|Unresolved assignments: 1/i)).toBeVisible();
  await page.getByText(/Ver asignaciones pendientes|Show pending assignments/i).click();
  await expect(page.getByText(/Luz · Sin asignar|Luz · Unassigned/i)).toBeVisible();
  await expect(page.locator('details').filter({ hasText: /Luz · (Sin asignar|Unassigned)/i })).toContainText('Principal');
  await expect(page.getByText('imported-widget')).toHaveCount(0);
  await expect(page.getByText('card-1')).toHaveCount(0);
});

for (const viewport of [...viewports, { name: 'portrait kiosk', ...portraitKioskViewport }]) {
  test(`Feature: Dashboard tablet UX — Scenario: Toolbar, sensor and clock fit ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');

    const titlebar = page.locator('.homepilot-dashboard-titlebar');
    const more = titlebar.getByRole('button', { name: /^(More|Más)$/i });
    await expect(titlebar.getByRole('button', { name: /new panel|nuevo panel|delete panel|eliminar panel/i })).toHaveCount(0);
    await expect(more).toBeVisible();
    await more.click();
    await expect(page.getByRole('menu', { name: /^(More|Más)$/i }).getByRole('menuitem', { name: /dashboard history|historial del tablero/i })).toBeVisible();
    await expect(page.getByRole('menu', { name: /^(More|Más)$/i }).getByRole('menuitem', { name: /export tab|exportar pestaña/i })).toBeVisible();
    await expect(page.getByRole('menu', { name: /^(More|Más)$/i }).getByRole('menuitem', { name: /import tab|importar pestaña/i })).toBeVisible();
    await expect(page.getByRole('menu', { name: /^(More|Más)$/i }).getByRole('menuitem', { name: /^(Edit|Editar)$/i })).toHaveCount(1);
    await expect(titlebar.getByRole('button', { name: /^(Edit|Editar|Rename|Renombrar)$/i })).toHaveCount(0);
    await more.click();
    await expect(page.locator('.sensor-metric-card').first()).not.toContainText('LISTO');
    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      sensors: [...document.querySelectorAll<HTMLElement>('.sensor-metric-card')].map((card) => ({
        scrollWidth: card.scrollWidth, clientWidth: card.clientWidth,
      })),
      clocks: [...document.querySelectorAll<HTMLElement>('.min-h-clock-card')].map((card) => ({
        scrollWidth: card.scrollWidth, clientWidth: card.clientWidth,
      })),
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    geometry.sensors.forEach((card) => expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth));
    geometry.clocks.forEach((card) => expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth));
    if (viewport.width < 640) {
      await enterDashboardEdit(page);
      await expect(titlebar.getByRole('textbox', { name: /^(Rename|Renombrar)$/i })).toBeVisible();
      await expect(more).toBeVisible();
      const titlebarWidth = await titlebar.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
      expect(titlebarWidth.scroll).toBeLessThanOrEqual(titlebarWidth.client);
    }
  });
}

test('Feature: Button card — Scenario: A scene briefly lights its icon without pretending to stay on', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  let savedDashboard = responsiveDashboard;
  let sceneExecutions = 0;
  let finishSceneExecution: (() => void) | undefined;
  const sceneExecutionGate = new Promise<void>((resolve) => { finishSceneExecution = resolve; });
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const changes = route.request().postDataJSON() as Partial<typeof responsiveDashboard>;
    savedDashboard = { ...savedDashboard, ...changes };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(savedDashboard) });
  });
  await page.route('**/api/v1/scenes', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'scene-dinner', name: 'Cena' }]) });
  });
  await page.route('**/api/v1/automations', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/scenes/scene-dinner/execute', async (route) => {
    sceneExecutions += 1;
    await sceneExecutionGate;
    await route.fulfill({ contentType: 'application/json', body: '{}' });
  });

  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  await expect(page.getByRole('button', { name: /^(Button|Botón)$/i })).toHaveCount(1);
  await page.getByRole('button', { name: /^(Button|Botón)$/i }).click();
  await page.getByText(/^(Light, scene, routine, or button|Luz, escena, rutina o botón)$/i).locator('..').getByRole('button').click();
  await page.getByRole('option', { name: /Cena/ }).click();
  await page.getByRole('button', { name: /^(Save|Guardar)$/i }).click();

  const sceneTile = page.locator('[class*="group/card"]').filter({ hasText: 'Cena' });
  await expect(sceneTile).toBeVisible();
  const sceneButton = sceneTile.getByRole('button', { name: /Cena/i });
  expect(await sceneButton.getAttribute('aria-pressed')).toBeNull();
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Done|Listo)$/i }).click();
  await sceneButton.click();
  await expect.poll(() => sceneExecutions).toBe(1);
  await expect(sceneButton).toHaveAttribute('data-action-state', 'pending');
  await expect(sceneTile).toHaveClass(/homepilot-section-light-tile-active/);
  await expect(sceneButton).toHaveClass(/homepilot-section-light-tile-surface/);
  await expect(sceneButton.locator('svg').first()).toHaveClass(/text-primary/);
  await expect(sceneTile.locator('svg.lucide-loader-circle')).toHaveCount(0);
  finishSceneExecution?.();
  await expect(sceneButton).toHaveAttribute('data-action-state', 'success');
  await expect(sceneTile).toHaveClass(/homepilot-section-light-tile-active/);
  await expect(sceneButton.locator('svg').first()).toHaveClass(/text-primary/);
  await expect(sceneButton.locator('svg.lucide-check')).toHaveCount(0);
  await expect(sceneButton.getByText(/^(Done|Listo)$/i)).toHaveCount(0);
  await expect(sceneButton).toHaveAttribute('data-action-state', 'idle', { timeout: 4000 });
  await expect(sceneTile).not.toHaveClass(/homepilot-section-light-tile-active/);
  await expect(sceneButton.locator('svg').first()).toHaveClass(/text-foreground\/80/);
});

test('Feature: Unified control tile — Scenario: Selecting a light still sends an on/off command', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  // A device is assignable only when its room exists in the loaded topology.
  await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
  await page.route('**/api/v1/rooms', route => route.fulfill({ json: [{ id: 'responsive-room', homeId: 'responsive-home', name: 'Sala' }] }));
  const light = { id: 'living-light', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Luz de sala', type: 'light', semanticType: 'light', status: 'ASSIGNED', lastKnownState: { state: 'off' } };
  let savedDashboard = responsiveDashboard;
  let issuedCommand = '';
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([...responsiveDevices, light]) });
  });
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const changes = route.request().postDataJSON() as Partial<typeof responsiveDashboard>;
    savedDashboard = { ...savedDashboard, ...changes };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(savedDashboard) });
  });
  await page.route('**/api/v1/scenes', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/automations', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/devices/living-light/command', async (route) => {
    issuedCommand = (route.request().postDataJSON() as { command: string }).command;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...light, lastKnownState: { state: 'on' } }) });
  });

  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  await page.getByRole('button', { name: /^(Button|Botón)$/i }).click();
  await page.getByText(/^(Light, scene, routine, or button|Luz, escena, rutina o botón)$/i).locator('..').getByRole('button').click();
  await page.getByRole('option', { name: /Luz de sala/ }).click();
  await page.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Done|Listo)$/i }).click();
  const lightTile = page.locator('[class*="group/card"]').filter({ hasText: 'Luz de sala' });
  await lightTile.click();
  await expect.poll(() => issuedCommand).toBe('turn_on');
  await expect(lightTile).toHaveClass(/homepilot-section-light-tile-active/);
});

test('Feature: Dashboard title editing — Scenario: An owner edits title content and returns to the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const changes = route.request().postDataJSON() as Partial<typeof responsiveDashboard>;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...responsiveDashboard, ...changes }) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);

  const titleWidget = page.locator('.homepilot-dashboard-widget').filter({ has: page.locator('.homepilot-dashboard-title') });
  await titleWidget.hover();
  await titleWidget.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  const editor = page.locator('#dashboard-title-markdown');
  await expect(editor).toBeVisible();
  await editor.fill('# Título renovado');
  await editor.locator('xpath=ancestor::form').getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Título renovado' })).toBeVisible();
});

test('Feature: Dashboard drag discovery — Scenario: Sections show a grip only while editing and the grip moves them', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const template = responsiveDashboard.tabs[0].widgets[1];
  const makeSection = (id: string, title: string) => ({ ...template, id, config: { ...template.config, layout: { ...template.config.layout, span: 1 }, appearance: { title, showTitle: true }, extra: { cards: [] } } });
  let saved = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [makeSection('alpha', 'Alpha'), makeSection('beta', 'Beta')], sectionLayout: { columns3: ['alpha', 'beta', null] as Array<string | null> } }] };
  await prepareAuthenticatedDashboard(page, saved);
  await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
    if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
    return route.fulfill({ json: saved });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await expect(page.locator('[data-dashboard-section-id="alpha"]')).toBeVisible();
  await expect(page.locator('[data-dashboard-section-grip]')).toHaveCount(0);
  await enterDashboardEdit(page);
  await expect(page.locator('[data-dashboard-section-grip]')).toHaveCount(2);
  const grip = await page.locator('[data-dashboard-section-id="alpha"] [data-dashboard-section-grip]').boundingBox();
  const target = await page.locator('[data-dashboard-section-id="beta"]').boundingBox();
  if (!grip || !target) throw new Error('Missing grip drag bounds');
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + 30, grip.y + 10, { steps: 4 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 16 });
  await page.mouse.up();
  await expect.poll(() => saved.tabs[0].sectionLayout?.columns3?.slice(0, 2)).toEqual(['beta', 'alpha']);
});

test('Feature: Dashboard drag discovery — Scenario: Touch screens get a one-time hint that does not return', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await prepareAuthenticatedDashboard(page);
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    await enterDashboardEdit(page, true);
    const hint = page.locator('[data-dashboard-touch-hint]');
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAttribute('role', 'status');
    await page.getByRole('button', { name: /^(Done|Listo)$/i }).tap();
    await enterDashboardEdit(page, true);
    await expect(page.locator('[data-dashboard-section-grip]').first()).toBeVisible();
    await expect(hint).toHaveCount(0);
  } finally {
    await context.close();
  }
});
