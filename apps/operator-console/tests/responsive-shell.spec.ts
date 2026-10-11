import { expect, test } from '@playwright/test';
import {
  enterDashboardEdit,
  viewports,
  portraitKioskViewport,
  dashboardUser,
  responsiveDevices,
  responsiveDashboard,
  prepareLoginShell,
  prepareAuthenticatedDashboard,
} from './helpers/responsiveShell';

for (const viewport of [
  ...viewports,
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'portrait kiosk', ...portraitKioskViewport },
]) {
  test(`Feature: Sensor clarity — readings and missing data fit ${viewport.name} in both themes`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const readings = [
      { id: 'clarity-temperature', title: 'Sala principal', deviceClass: 'temperature', state: '22.4', unit: '°C' },
      { id: 'clarity-pressure', title: 'Presión de agua', deviceClass: 'pressure', state: '3.2', unit: 'bar' },
      { id: 'clarity-atmosphere', title: 'Presión atmosférica', deviceClass: 'pressure', state: '1013', unit: 'hPa' },
      { id: 'clarity-humidity', title: 'Humedad ambiente', deviceClass: 'humidity', state: '58', unit: '%' },
      { id: 'clarity-battery', title: 'Batería de la tablet', deviceClass: 'battery', state: '18', unit: '%' },
      { id: 'clarity-memory', title: 'RAM del estudio', deviceClass: 'memory', state: '74.03', unit: '%' },
      { id: 'clarity-load', title: 'Procesador', deviceClass: 'cpu', state: '100', unit: '%' },
      { id: 'clarity-missing', title: 'Temperatura exterior', deviceClass: 'temperature', state: 'unavailable', unit: '°C' },
      { id: 'clarity-state', title: 'Estado de batería', deviceClass: 'battery', state: 'not charging', unit: '' },
      { id: 'clarity-numeric', title: 'Energía acumulada', deviceClass: 'energy', state: '123456.7', unit: 'kWh' },
    ];
    const baseSection = responsiveDashboard.tabs[0]!.widgets[1]!;
    const dashboard = {
      ...responsiveDashboard,
      tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [{
        ...baseSection,
        config: { ...baseSection.config, extra: { cards: readings.map(({ id, title }) => ({ id, title, kind: 'sensor', entityId: id, span: 'small', sensorDecimals: true })) } },
      }] }],
    };
    await prepareAuthenticatedDashboard(page, dashboard);
    await page.route('**/api/v1/rooms', (route) => route.fulfill({ json: [{ id: 'clarity-room', homeId: 'responsive-home', name: 'Oficina' }] }));
    await page.route('**/api/v1/devices', (route) => route.fulfill({ json: readings.map((reading) => ({
      id: reading.id, homeId: 'responsive-home', roomId: 'clarity-room', name: `Technical ${reading.id}`, type: 'sensor', status: 'ASSIGNED',
      lastKnownState: { state: reading.state, unit_of_measurement: reading.unit, device_class: reading.deviceClass },
    })) }));
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const cards = page.locator('.sensor-metric-card');
    await expect(cards).toHaveCount(readings.length);
    const geometry = () => cards.evaluateAll((elements) => elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    }));
    const darkGeometry = await geometry();
    const temperature = page.locator('[data-dashboard-card-id="clarity-temperature"] .sensor-metric-card');
    const hierarchy = await temperature.evaluate((element) => {
      const title = element.querySelector('.sensor-reading-title')!;
      const value = element.querySelector('.sensor-reading-value > span')!;
      return { title: Number.parseFloat(getComputedStyle(title).fontSize), value: Number.parseFloat(getComputedStyle(value).fontSize) };
    });
    expect(hierarchy.value).toBeGreaterThan(hierarchy.title);
    for (const theme of ['dark', 'light']) {
      await page.evaluate((isLight) => document.documentElement.classList.toggle('light', isLight), theme === 'light');
      for (const reading of readings) {
        const card = page.locator(`[data-dashboard-card-id="${reading.id}"] .sensor-metric-card`);
        await expect(card.getByText(reading.title, { exact: true })).toHaveCount(1);
        await expect(card.getByText(reading.title, { exact: true })).toBeVisible();
        const titleFits = await card.getByText(reading.title, { exact: true }).evaluate((element) => ({ width: element.clientWidth, contentWidth: element.scrollWidth, height: element.clientHeight, contentHeight: element.scrollHeight }));
        expect(titleFits.contentWidth).toBeLessThanOrEqual(titleFits.width);
        expect(titleFits.contentHeight).toBeLessThanOrEqual(titleFits.height);
        expect(await card.evaluate(element => getComputedStyle(element).borderRadius)).toBe('16px');
        const density = await card.evaluate(element => {
          const style = getComputedStyle(element);
          const value = element.querySelector('.sensor-reading-value')!.getBoundingClientRect();
          const footer = element.querySelector('.sensor-reading-footer')?.getBoundingClientRect();
          return { top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom), readingToFooter: footer ? footer.top - value.bottom : 0 };
        });
        expect(density.top).toBeLessThanOrEqual(8);
        expect(density.bottom).toBeLessThanOrEqual(8);
        expect(density.readingToFooter).toBeLessThanOrEqual(8);
        await expect(card.getByText('Oficina', { exact: true })).toHaveCount(0);
        await expect(card).not.toContainText(`Technical ${reading.id}`);
        await expect(card.getByRole('button')).toHaveCount(0);
        if (!['clarity-battery', 'clarity-memory'].includes(reading.id)) await expect(card.locator('.sensor-reading-footer')).toHaveCount(0);
        if (Number.isFinite(Number(reading.state))) {
          await expect(card.getByText(reading.state, { exact: true })).toBeVisible();
          await expect(card.getByRole('meter', { name: reading.title })).toHaveAttribute('aria-valuenow', reading.state);
          await expect(card.getByRole('meter', { name: reading.title })).toHaveAttribute('aria-valuetext', `${reading.state}${reading.unit === '%' ? '%' : ` ${reading.unit}`}`);
          const meterBounds = await card.getByRole('meter', { name: reading.title }).boundingBox();
          const readingBounds = await card.getByText(reading.state, { exact: true }).boundingBox();
          expect(readingBounds!.y).toBeGreaterThanOrEqual(meterBounds!.y);
          expect(readingBounds!.y + readingBounds!.height).toBeLessThanOrEqual(meterBounds!.y + meterBounds!.height + 1);
          const unitBounds = await card.getByText(reading.unit, { exact: true }).boundingBox();
          expect(unitBounds!.x).toBeGreaterThanOrEqual(readingBounds!.x + readingBounds!.width - 1);
          expect(unitBounds!.y).toBeGreaterThanOrEqual(readingBounds!.y);
          expect(unitBounds!.y).toBeLessThan(readingBounds!.y + readingBounds!.height);
          if (reading.state.length <= 6) {
            const valueFontSize = await card.getByText(reading.state, { exact: true })
              .evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
            const referenceFontSize = await temperature.getByText('22.4', { exact: true })
              .evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
            expect(Math.abs(valueFontSize - referenceFontSize)).toBeLessThanOrEqual(0.05);
          }
        }
      }
      const missing = page.locator('[data-dashboard-card-id="clarity-missing"] .sensor-metric-card');
      await expect(missing.getByText(/^(Sin lectura|No reading)$/i)).toBeVisible();
      await expect(missing.getByText('—', { exact: true })).toBeVisible();
      await expect(missing).not.toContainText('°C');
      await expect(missing.getByRole('meter')).toHaveCount(0);
      await expect(page.locator('[data-dashboard-card-id="clarity-memory"]').getByText(/^(Uso elevado|High usage)$/i)).toBeVisible();
      await expect(page.locator('[data-dashboard-card-id="clarity-state"]').getByText(/^(Sin cargar|Not charging)$/i)).toBeVisible();
      await expect(page.locator('[data-dashboard-card-id="clarity-state"]').getByRole('switch')).toHaveCount(0);
      await expect(page.locator('[data-dashboard-card-id="clarity-numeric"]').getByText('123456.7', { exact: true })).toBeVisible();
      const cardOverflow = await cards.evaluateAll((elements) => elements.map((element) => ({ text: element.textContent, width: element.clientWidth, contentWidth: element.scrollWidth, height: element.clientHeight, contentHeight: element.scrollHeight })));
      expect(cardOverflow.every(element => element.contentWidth <= element.width && element.contentHeight <= element.height), JSON.stringify(cardOverflow)).toBe(true);
      const valueBounds = await cards.locator('.sensor-reading-value > span').evaluateAll((elements) => elements.map(element => ({ reading: element.textContent, width: element.clientWidth, contentWidth: element.scrollWidth })));
      expect(valueBounds.every(value => value.contentWidth <= value.width), JSON.stringify(valueBounds)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(await geometry()).toEqual(darkGeometry);
      await page.screenshot({ path: testInfo.outputPath(`sensor-fiches-${theme}.png`), fullPage: true });
    }
  });
}

test('Feature: Sensor width — Scenario: A sensor stays medium without a width control or repeated room', async ({ page }) => {
  const baseSection = responsiveDashboard.tabs[0]!.widgets[1]!;
  const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [{
    ...baseSection, config: { ...baseSection.config, extra: { cards: [{ ...baseSection.config.extra.cards[0]!, span: 'full' }] } },
  }] }] };
  await prepareAuthenticatedDashboard(page, dashboard);
  let savedDashboard = dashboard;
  await page.route('**/api/v1/dashboards/responsive-dashboard', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    savedDashboard = { ...savedDashboard, ...route.request().postDataJSON() };
    await route.fulfill({ json: savedDashboard });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  const sensor = page.locator('[data-dashboard-card-id="responsive-sensor"]');
  await expect(sensor.getByRole('slider', { name: /resize (?:the )?card|redimensionar/i })).toHaveCount(0);
  await sensor.hover();
  await sensor.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  const heading = page.getByRole('heading', { name: /^(Edit|Editar)$/i });
  await expect(heading).toBeVisible();
  const editor = heading.locator('..').locator('..').locator('..');
  await expect(editor.getByText(/^(Card width|Ancho de tarjeta)$/i)).toHaveCount(0);
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect.poll(() => savedDashboard.tabs[0]!.widgets[0]!.config.extra.cards[0]!.span).toBe('medium');
});

test('disables the Home dashboard action without an owned main tab', async ({ page }) => {
  const shared = { ...responsiveDashboard, ownerId: 'another-user' };
  await prepareAuthenticatedDashboard(page, shared);
  await page.goto('/');

  const context = page.getByLabel(/contexto local del hogar|local home context/i);
  const action = context.getByRole('button', { name: /sin pestaña principal|no main tab/i });
  await expect(action).toContainText(/Ir a tablero|Go to dashboard/);
  await expect(action).toBeDisabled();
});

test('opens the owned main tab even when a shared dashboard is also accessible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);
  const shared = { ...responsiveDashboard, id: 'shared-dashboard', ownerId: 'another-user', title: 'Hogar compartido', tabs: [
    { ...responsiveDashboard.tabs[0], id: 'shared-tab', title: 'Compartida' },
  ] };
  await page.route('**/api/v1/dashboards', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([shared, responsiveDashboard]) });
  });
  await page.goto('/');

  const dashboardGroup = page.getByRole('button', { name: /dashboards|tableros/i }).first();
  await dashboardGroup.click();
  await expect(page.getByRole('button', { name: 'Hogar de prueba' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hogar compartido' })).toBeVisible();
  const context = page.getByLabel(/contexto local del hogar|local home context/i);
  await context.getByRole('button', { name: /abrir la pestaña Principal de mi tablero|open Principal in my dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboards\/responsive-dashboard\/responsive-tab$/);
});

for (const input of ['mouse', 'touch'] as const) {
  test(`Feature: Section masonry drag — ${input} moves a section under the shorter third column`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: input === 'touch' });
    const page = await context.newPage();
    try {
      const template = responsiveDashboard.tabs[0].widgets[1];
      const makeSection = (id: string, tall: boolean) => ({ ...template, id, config: { ...template.config,
        appearance: { title: id.toUpperCase(), showTitle: true }, extra: { cards: tall ? Array.from({ length: 4 }, (_, index) => ({ id: `${id}-${index}`, kind: 'sensor', title: `Lectura ${index}`, entityId: 'sensor-memory', span: 'medium' })) : [] } } });
      let saved = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [makeSection('a', true), makeSection('b', true), makeSection('c', false), makeSection('d', false)], sectionLayout: { columns3: ['a', 'b', 'c', 'd'] as Array<string | null> } }] };
      await prepareAuthenticatedDashboard(page, saved);
      await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
      await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
        if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
        return route.fulfill({ json: saved });
      });
      await page.goto('/dashboards/responsive-dashboard/responsive-tab');
      await enterDashboardEdit(page, input === 'touch');
      const source = page.getByRole('button', { name: /^(Drag to reorder|Arrastrar para reordenar): D$/ });
      const destination = page.locator('[data-section-slot="5"]');
      await source.scrollIntoViewIfNeeded();
      const sourceBounds = await source.boundingBox();
      const targetBounds = await destination.boundingBox();
      if (!sourceBounds || !targetBounds) throw new Error('Missing masonry drag bounds');
      expect(targetBounds.y).toBeLessThan(sourceBounds.y);
      await expect(source.getByRole('button', { name: /Drag to reorder|Arrastrar para reordenar/ })).toHaveCount(0);
      const start = { x: sourceBounds.x + sourceBounds.width * 0.02, y: sourceBounds.y + sourceBounds.height / 2 };
      const end = { x: targetBounds.x + targetBounds.width / 2, y: targetBounds.y + targetBounds.height / 2 };
      if (input === 'touch') {
        await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
        await page.clock.pauseAt(new Date('2026-10-02T12:00:01Z'));
        const session = await context.newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
        await page.clock.runFor(450);
        await expect(source).not.toHaveAttribute('aria-pressed', 'true');
        await page.clock.runFor(100);
        await expect(source).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('[data-dashboard-drag-preview]')).toContainText('D');
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
        await expect(destination.locator('[data-dashboard-section-id="d"]')).toBeVisible();
        expect(saved.tabs[0].sectionLayout.columns3).toEqual(['a', 'b', 'c', 'd']);
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 12 });
        const preview = page.locator('[data-dashboard-drag-preview]');
        await expect(preview).toContainText('D');
        await expect(destination.locator('[data-dashboard-section-id="d"]')).toBeVisible();
        expect(saved.tabs[0].sectionLayout.columns3).toEqual(['a', 'b', 'c', 'd']);
        await page.screenshot({ path: testInfo.outputPath('section-elevated.png') });
        await page.mouse.up();
      }
      await expect.poll(() => saved.tabs[0].sectionLayout.columns3).toEqual(['a', 'b', 'c', null, null, 'd']);
      if (input === 'touch') await page.clock.resume();
      await page.reload();
      const c = await page.getByRole('region', { name: 'C', exact: true }).boundingBox();
      const d = await page.getByRole('region', { name: 'D', exact: true }).boundingBox();
      const a = await page.getByRole('region', { name: 'A', exact: true }).boundingBox();
      expect(d!.x).toBeCloseTo(c!.x, 0);
      expect(d!.y).toBeGreaterThanOrEqual(c!.y + c!.height);
      expect(d!.y).toBeLessThan(a!.y + a!.height);
    } finally { await context.close(); }
  });
}

test('Feature: Sidebar navigation — a main view resets shell scroll but an internal tab does not', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  const dashboard = {
    ...responsiveDashboard,
    tabs: [responsiveDashboard.tabs[0]!, { ...responsiveDashboard.tabs[0]!, id: 'secondary-tab', title: 'Sala', isDefault: false }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  const scrollArea = page.locator('main > section');
  await scrollArea.evaluate((element) => {
    const spacer = document.createElement('div');
    spacer.style.height = '2000px';
    spacer.setAttribute('aria-hidden', 'true');
    element.appendChild(spacer);
    element.scrollTop = 400;
  });
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.locator('.homepilot-dashboard-tabs').getByRole('button', { name: 'Sala', exact: true }).click();
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.locator('aside nav').getByRole('button', { name: /^(Home|Inicio)$/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBe(0);

  await page.goto('/system/home-personalization');
  await scrollArea.evaluate((element) => {
    const spacer = document.createElement('div');
    spacer.style.height = '2000px';
    spacer.setAttribute('aria-hidden', 'true');
    element.appendChild(spacer);
    element.scrollTop = 400;
  });
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const systemMenu = page.locator('aside nav').getByRole('button', { name: /^(System|Sistema)$/i });
  if (await systemMenu.getAttribute('aria-expanded') === 'false') await systemMenu.click();
  await page.locator('aside nav').getByRole('button', { name: /^(Cámaras IP|IP Cameras)$/i }).click();
  await expect(page).toHaveURL(/\/system\/cameras$/);
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBe(0);
});

test('allows clearing the current open-on-load tab before enabling another', async ({ page }) => {
  let dashboard = { ...responsiveDashboard, tabs: [
    responsiveDashboard.tabs[0],
    { ...responsiveDashboard.tabs[0], id: 'second-tab', title: 'Sala', isDefault: false, widgets: [] },
  ] };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/dashboards', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([dashboard]) });
  });
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const payload = route.request().postDataJSON() as { tabs: typeof dashboard.tabs };
    dashboard = { ...dashboard, tabs: payload.tabs };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(dashboard) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  const tabs = page.locator('.homepilot-dashboard-tabs');
  await tabs.getByRole('button', { name: /configurar vista: Sala|configure view: Sala/i }).click();
  let dialog = page.getByRole('dialog', { name: /configuración de la vista Sala|view configuration for Sala/i });
  const otherSwitch = dialog.getByRole('switch', { name: /abrir al cargar|open on load/i });
  await expect(otherSwitch).toBeDisabled();
  await expect(dialog.getByText(/Principal.*ya está configurada|Principal.*already set/i)).toBeVisible();
  await dialog.getByRole('button', { name: /^(Cerrar|Close)$/i }).click();

  await tabs.getByRole('button', { name: /configurar vista: Principal|configure view: Principal/i }).click();
  dialog = page.getByRole('dialog', { name: /configuración de la vista Principal|view configuration for Principal/i });
  const ownSwitch = dialog.getByRole('switch', { name: /abrir al cargar|open on load/i });
  await expect(ownSwitch).toBeEnabled();
  await expect(ownSwitch).toBeChecked();
  await ownSwitch.click();
  await dialog.getByRole('button', { name: /^(Guardar|Save)$/i }).click();
  await expect.poll(() => dashboard.tabs[0].isDefault).toBe(false);

  await tabs.getByRole('button', { name: /configurar vista: Sala|configure view: Sala/i }).click();
  dialog = page.getByRole('dialog', { name: /configuración de la vista Sala|view configuration for Sala/i });
  await expect(dialog.getByRole('switch', { name: /abrir al cargar|open on load/i })).toBeEnabled();
});

for (const viewport of [...viewports, { name: 'tablet landscape', width: 1024, height: 768 }, { name: 'portrait kiosk', ...portraitKioskViewport }]) {
  test(`Feature: Unified palette — Dashboard, Home and portal editor share theme colors on ${viewport.name} (AC76)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
    await page.route('**/api/v1/scenes', route => route.fulfill({ json: [{ id: 'palette-scene', userId: dashboardUser.id, homeId: 'responsive-home', roomId: null, name: 'Paleta compartida', actions: [{ deviceId: 'cover-living', command: 'open' }] }] }));
    await page.route('**/api/v1/scenes/favorites', route => route.fulfill({ json: { sceneIds: [], initialized: true } }));
    await page.route('**/api/v1/automations', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/automations/favorites', route => route.fulfill({ json: { automationIds: [], initialized: true } }));
    await page.route('**/api/v1/settings/home-personalization', route => route.fulfill({
      json: {
        morningPhrase: '',
        afternoonPhrase: '',
        nightPhrase: '',
        heroImages: [],
      },
    }));
    await page.route('https://api.open-meteo.com/**', route => route.fulfill({
      json: {
        current: {
          temperature_2m: 19,
          weather_code: 0,
          wind_speed_10m: 3,
          time: '2026-10-05T12:34',
        },
      },
    }));
    const tokens = ['--primary', '--primary-foreground', '--card', '--popover', '--foreground', '--muted-foreground', '--border', '--ring', '--success', '--warning', '--danger'];
    for (const theme of ['dark', 'light']) {
      await page.goto('/dashboards/responsive-dashboard/responsive-tab');
      await page.evaluate(isLight => document.documentElement.classList.toggle('light', isLight), theme === 'light');
      const dashboard = page.locator('.homepilot-dashboard-screen');
      await expect(page.locator('.homepilot-dashboard-section')).toBeVisible();
      const global = await page.locator('html').evaluate((element, names) => names.map(name => getComputedStyle(element).getPropertyValue(name).trim()), tokens);
      const inherited = await dashboard.evaluateAll((elements, names) => elements.map(element => names.map(name => getComputedStyle(element).getPropertyValue(name).trim())), tokens);
      expect(inherited.length).toBeGreaterThan(0);
      for (const palette of inherited) expect(palette).toEqual(global);
      if (viewport.name === 'mobile' || viewport.name === 'desktop') await page.screenshot({ path: testInfo.outputPath(`dashboard-${theme}.png`), animations: 'disabled' });
      await page.goto('/');
      await expect(page.getByRole('main').getByRole('status', { name: /Loading|Cargando/i })).not.toBeVisible();
      await page.evaluate(isLight => document.documentElement.classList.toggle('light', isLight), theme === 'light');
      expect(await page.locator('body').evaluate((element, names) => names.map(name => getComputedStyle(element).getPropertyValue(name).trim()), tokens)).toEqual(global);
      const homeAction = page.getByRole('button', { name: /Open Principal in my dashboard|Abrir.*Principal.*mi tablero/i });
      await expect(homeAction).toBeVisible();
      // The shared Button primitive transitions its color when the theme
      // changes. Assert the final palette, not an intermediate RGB frame.
      await expect.poll(() => homeAction.evaluate(element =>
        getComputedStyle(element).color === getComputedStyle(document.body).color,
      )).toBe(true);
      if (viewport.name === 'mobile' || viewport.name === 'desktop') await page.screenshot({ path: testInfo.outputPath(`home-${theme}.png`), animations: 'disabled' });
      await page.goto('/routines/scenes');
      await page.evaluate(isLight => document.documentElement.classList.toggle('light', isLight), theme === 'light');
      await page.getByRole('button', { name: /^(Editar|Edit)$/i }).click();
      const editor = page.getByRole('dialog');
      await expect(editor).toBeVisible();
      expect(await editor.evaluate((element, names) => names.map(name => getComputedStyle(element).getPropertyValue(name).trim()), tokens)).toEqual(global);
      const save = editor.getByRole('button', { name: /^(Guardar escena|Save Scene)$/i });
      await expect(save).toBeEnabled();
      const contrast = await save.evaluate(element => {
        const style = getComputedStyle(element);
        const luminance = (color: string) => {
          const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(value => Number(value) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
          return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
        };
        const text = luminance(style.color), background = luminance(style.backgroundColor);
        return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
      });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      const bounds = await editor.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      if (viewport.name === 'mobile' || viewport.name === 'desktop') await page.screenshot({ path: testInfo.outputPath(`editor-${theme}.png`), animations: 'disabled' });
    }
  });
}

for (const viewport of [...viewports, { name: 'portrait kiosk', ...portraitKioskViewport }]) {
  test(`premium dashboard surfaces preserve section bounds and avoid overflow on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
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
              ...section.config.extra.cards,
              { id: 'premium-action', kind: 'action', title: 'Indirecta espalda muy larga', span: 'small' },
            ] },
          },
        }],
      }],
    };
    await prepareAuthenticatedDashboard(page, dashboard);
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');

    const sectionSurface = page.locator('.homepilot-dashboard-section');
    const tile = page.locator('[data-dashboard-card-id="premium-action"]');
    await expect(sectionSurface).toBeVisible();
    await expect(tile).toBeVisible();
    await expect(page.locator('[data-homepilot-clock]')).toBeVisible();
    const sectionBefore = await sectionSurface.boundingBox();
    const dark = await sectionSurface.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      backdrop: getComputedStyle(element).backdropFilter,
    }));
    expect(dark.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(dark.backdrop).not.toBe('none');
    const tileGeometry = await tile.evaluate((element) => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      label: element.querySelector('button span')?.textContent,
    }));
    expect(tileGeometry.scrollWidth).toBeLessThanOrEqual(tileGeometry.width);
    expect(tileGeometry.label).toContain('Indirecta espalda');
    await page.evaluate(() => document.documentElement.classList.add('light'));
    const sectionAfter = await sectionSurface.boundingBox();
    expect(sectionAfter?.width).toBe(sectionBefore?.width);
    expect(sectionAfter?.height).toBe(sectionBefore?.height);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`dashboard initial skeleton preserves card, section and canvas geometry on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareAuthenticatedDashboard(page);
    let releaseDevices: (() => void) | undefined;
    const blockedDevices = new Promise<void>((resolve) => { releaseDevices = resolve; });
    await page.route('**/api/v1/devices', async (route) => {
      await blockedDevices;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(responsiveDevices) });
    });

    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const card = page.locator('[data-dashboard-card-id="responsive-sensor"]');
    await expect(card.locator('[data-dashboard-skeleton="sensor"]')).toBeVisible();
    const geometry = async () => page.evaluate(() => {
      const cardElement = document.querySelector('[data-dashboard-card-id="responsive-sensor"]');
      const sectionElement = cardElement?.closest('.homepilot-dashboard-widget');
      const canvasElement = document.querySelector('.homepilot-dashboard-content');
      const rect = (element: Element | null | undefined) => {
        const bounds = element?.getBoundingClientRect();
        return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, bottom: bounds.bottom } : null;
      };
      const items = Array.from(cardElement?.parentElement?.children ?? []).map((element, index) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          index,
          id: element.getAttribute('data-dashboard-card-id') ?? element.getAttribute('data-testid') ?? element.tagName.toLowerCase(),
          x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, bottom: bounds.bottom,
          gridRowStart: style.gridRowStart,
          gridRowEnd: style.gridRowEnd,
          position: style.position,
          display: style.display,
          visibility: style.visibility,
        };
      });
      return {
        card: rect(cardElement), section: rect(sectionElement), canvas: rect(canvasElement),
        items, childCount: items.length,
        sectionBottom: sectionElement?.getBoundingClientRect().bottom ?? null,
        maxChildBottom: items.length ? Math.max(...items.map((item) => item.bottom ?? -Infinity)) : null,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    const before = await geometry();
    expect(before.card).not.toBeNull();
    expect(before.section).not.toBeNull();
    expect(before.canvas).not.toBeNull();
    expect(before.overflow).toBe(false);
    await card.screenshot({ path: testInfo.outputPath('sensor-skeleton.png') });

    releaseDevices?.();
    await expect(card.locator('.sensor-metric-card')).toBeVisible();
    await expect(card.locator('[data-dashboard-skeleton]')).toHaveCount(0);
    const after = await geometry();
    const weatherBefore = before.items.find((item) => item.id === 'responsive-weather');
    const weatherAfter = after.items.find((item) => item.id === 'responsive-weather');
    expect(weatherBefore).toBeDefined();
    expect(weatherAfter?.height).toBe(weatherBefore?.height);
    expect(weatherAfter?.gridRowStart).toBe(weatherBefore?.gridRowStart);
    expect(weatherAfter?.gridRowEnd).toBe(weatherBefore?.gridRowEnd);
    const geometryChanges = (['card', 'section', 'canvas'] as const).flatMap((key) =>
      (['x', 'y', 'width', 'height'] as const).map((axis) => {
        const initial = before[key]![axis];
        const final = after[key]![axis];
        return { key, axis, initial, final, delta: Math.abs(final - initial) };
      }),
    );
    const geometryReport = geometryChanges
      .map(({ key, axis, initial, final, delta }) => `${key}.${axis}: before=${initial} after=${final} delta=${delta}`)
      .join('\n');
    const describeItem = (item: (typeof before.items)[number] | undefined) => item
      ? `${item.id} x=${item.x} y=${item.y} width=${item.width} height=${item.height} bottom=${item.bottom} row=${item.gridRowStart}/${item.gridRowEnd} position=${item.position} display=${item.display} visibility=${item.visibility}`
      : 'missing';
    const itemReport = Array.from({ length: Math.max(before.childCount, after.childCount) }, (_, index) =>
      `item[${index}] before: ${describeItem(before.items[index])}\n` +
      `item[${index}] after:  ${describeItem(after.items[index])}`,
    ).join('\n');
    const sectionReport = `childCount before=${before.childCount} after=${after.childCount}; ` +
      `sectionBottom before=${before.sectionBottom} after=${after.sectionBottom}; ` +
      `maxChildBottom before=${before.maxChildBottom} after=${after.maxChildBottom}`;
    expect(geometryChanges.filter(({ delta }) => delta > 2), `${viewport.name} geometry:\n${geometryReport}\n${sectionReport}\n${itemReport}`).toEqual([]);
    expect(after.overflow).toBe(false);
    await card.screenshot({ path: testInfo.outputPath('sensor-loaded.png') });
  });
}

test('a fast initial snapshot never flashes a Dashboard skeleton', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await expect(page.locator('[data-dashboard-card-id="responsive-sensor"] .sensor-metric-card')).toBeVisible();
  await expect(page.locator('[data-dashboard-skeleton]')).toHaveCount(0);
});

test('a failed first device snapshot leaves loading and offers recovery', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await expect(page.getByText(/No se pudo cargar el estado de los dispositivos|Device status could not be loaded/)).toBeVisible();
  await expect(page.locator('[data-dashboard-skeleton]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Reintentar|Retry/i })).toBeVisible();
});

test('Dashboard skeleton motion is disabled when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepareAuthenticatedDashboard(page);
  let releaseDevices: (() => void) | undefined;
  const blockedDevices = new Promise<void>((resolve) => { releaseDevices = resolve; });
  await page.route('**/api/v1/devices', async (route) => {
    await blockedDevices;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(responsiveDevices) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  const skeleton = page.locator('[data-dashboard-skeleton="sensor"]').first();
  await expect(skeleton).toBeVisible();
  expect(await skeleton.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  releaseDevices?.();
});

for (const viewport of [viewports[1], viewports[2]]) {
  test(`dashboard backgrounds keep viewport and canvas geometry during navigation on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    const first = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], background: '/media/dashboards/test-backdrop-a.svg' }] };
    const second = { ...responsiveDashboard, id: 'second-dashboard', title: 'Segundo tablero', tabs: [{ ...responsiveDashboard.tabs[0], id: 'second-tab', background: '/media/dashboards/test-backdrop-b.svg' }] };
    const plain = { ...responsiveDashboard, id: 'plain-dashboard', title: 'Sin fondo', tabs: [{ ...responsiveDashboard.tabs[0], id: 'plain-tab', background: undefined }] };
    await page.route('**/api/v1/dashboards', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([first, second, plain]) });
    });
    let releaseSecondImage: () => void = () => undefined;
    const secondImageGate = new Promise<void>((resolve) => { releaseSecondImage = resolve; });
    await page.route('**/media/dashboards/test-backdrop-*.svg', async (route) => {
      if (route.request().url().endsWith('test-backdrop-b.svg')) await secondImageGate;
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#483b32"/></svg>' });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const backdrop = page.locator('.homepilot-dashboard-backdrop');
    const backdropImage = backdrop.locator(':scope > div');
    const canvas = page.locator('.homepilot-dashboard-content');
    await expect(backdropImage).toHaveCSS('background-image', /test-backdrop-a/);
    const geometry = async () => ({
      backdrop: await backdrop.boundingBox(), canvas: await canvas.boundingBox(),
      viewport: await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
    });
    const before = await geometry();
    const navigate = async (dashboardId: string, tabId: string) => {
      await page.evaluate(({ dashboardId, tabId }) => {
        window.history.pushState({}, '', `/dashboards/${dashboardId}/${tabId}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, { dashboardId, tabId });
    };

    await navigate('second-dashboard', 'second-tab');
    await expect(page).toHaveURL(/second-dashboard\/second-tab/);
    await expect(backdropImage).toHaveCSS('background-image', /test-backdrop-a/);
    const whileLoading = await geometry();
    expect(whileLoading.backdrop).toEqual(before.backdrop);
    expect(whileLoading.viewport).toEqual(before.viewport);
    expect(Math.abs((whileLoading.canvas?.y ?? 0) - (before.canvas?.y ?? 0))).toBeLessThanOrEqual(2);

    releaseSecondImage();
    await expect(backdropImage).toHaveCSS('background-image', /test-backdrop-b/);
    await expect(page).toHaveURL(/second-dashboard\/second-tab/);
    const after = await geometry();
    expect(after.backdrop).toEqual(before.backdrop);
    expect(after.viewport).toEqual(before.viewport);
    expect(Math.abs((after.canvas?.y ?? 0) - (before.canvas?.y ?? 0))).toBeLessThanOrEqual(2);

    await navigate('plain-dashboard', 'plain-tab');
    await expect(backdropImage).toHaveCSS('background-image', 'none');
    expect((await geometry()).backdrop).toEqual(before.backdrop);
    await navigate('second-dashboard', 'second-tab');
    await expect(backdropImage).toHaveCSS('background-image', /test-backdrop-b/);
    expect((await geometry()).backdrop).toEqual(before.backdrop);
  });
}

test('normal Operator Console startup consumes no Directory handoff without a 404 or duplicate request', async ({ page }) => {
  await prepareLoginShell(page);
  const statuses: number[] = [];
  await page.route('**/api/v1/auth/sso/directory/consume-browser', async (route) => {
    statuses.push(204);
    await route.fulfill({ status: 204 });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /iniciar sesión|log in/i })).toBeVisible();
  expect(statuses).toEqual([204]);
  await expect(page.getByText(/No se pudo completar el acceso|Directory sign-in could not/i)).toHaveCount(0);
});

test('an invalid Directory handoff remains visible while local login stays available', async ({ page }) => {
  await prepareLoginShell(page);
  await page.route('**/api/v1/auth/sso/directory/consume-browser', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"code":"SSO_HANDOFF_INVALID"}}' });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(/No se pudo completar el acceso|Directory sign-in could not/i);
  await expect(page.getByRole('button', { name: /iniciar sesión|log in/i })).toBeVisible();
});

test('opening Assistant reads findings without an automatic scan; manual scan still works', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  let scans = 0;
  await page.route('**/api/v1/assistant/scan', async (route) => {
    scans += 1;
    await route.fulfill({ contentType: 'application/json', body: '{"success":true}' });
  });

  await page.goto('/assistant');
  const scanButton = page.getByRole('button', { name: /Escanear Sistema|Scan System/i });
  await expect(scanButton).toBeVisible();
  expect(scans).toBe(0);

  await scanButton.click();
  await expect.poll(() => scans).toBe(1);
});

test('keeps dashboard controls readable on a high-resolution portrait kiosk', async ({ page }) => {
  await page.setViewportSize(portraitKioskViewport);
  await prepareAuthenticatedDashboard(page);

  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  const canvas = page.locator('.homepilot-portrait-kiosk-canvas');
  await expect(canvas).toBeVisible();

  const columnCount = await canvas.evaluate((element) => (
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
  ));
  expect(columnCount).toBe(2);

  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  await expect(page.getByText('Temperatura de sala').first()).toBeVisible();
  await expect(page.getByText('Cortina de sala').first()).toBeVisible();

  const menuToggle = page.locator('.homepilot-dashboard-tabs').getByRole('button', { name: /show or hide menu|mostrar u ocultar menú/i });
  await expect(menuToggle).toBeVisible();
  await menuToggle.click();
  await expect(page.getByTestId('mobile-sidebar-backdrop')).toBeVisible();
  await page.getByTestId('mobile-sidebar-backdrop').click({ position: { x: portraitKioskViewport.width - 20, y: 96 } });
  await expect(menuToggle).toBeVisible();

});

for (const viewport of viewports) {
  test(`keeps the login shell responsive on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareLoginShell(page);

    await page.goto('/');
    await expect(page.locator('input')).toHaveCount(2);

    const layout = await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('400 16px Inter'),
        document.fonts.load('400 16px "Disket Mono"'),
      ]);

      const technicalSample = document.createElement('span');
      technicalSample.className = 'font-mono';
      technicalSample.textContent = 'HP-01';
      document.body.append(technicalSample);
      const result = {
        bodyFont: getComputedStyle(document.body).fontFamily,
        monoFont: getComputedStyle(technicalSample).fontFamily,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
      technicalSample.remove();
      return result;
    });

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    expect(layout.bodyFont).toContain('Inter');
    expect(layout.monoFont).toContain('Disket Mono');
  });

  test(`keeps login keyboard flow and error feedback accessible on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareLoginShell(page);
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'AUTH_FAILED' } }),
      });
    });

    await page.goto('/');

    const username = page.locator('input[type="text"]');
    const password = page.locator('input[type="password"]');
    const submit = page.locator('button[type="submit"]');

    for (const theme of ['dark', 'light']) {
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      for (const field of [username, password]) {
        await expect(field).toHaveCSS('height', '44px');
        await expect(field).toHaveCSS('border-radius', '12px');
        await expect(field).toHaveCSS('font-size', '15px');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    await username.focus();
    await page.keyboard.press('Tab');
    await expect(password).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(submit).toBeFocused();

    const submitBox = await submit.boundingBox();
    expect(submitBox?.height).toBeGreaterThanOrEqual(40);

    await username.fill('admin');
    await password.fill('invalid-password');
    await password.press('Enter');

    const loginAlert = page.getByRole('alert').filter({
      hasText: /Invalid credentials|Credenciales inválidas/i,
    });
    await expect(loginAlert).toBeVisible();
    await expect(loginAlert).toContainText(/Invalid credentials|Credenciales inválidas/i);
  });

  test(`keeps the authenticated dashboard responsive on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);

    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    await expect(page.locator('.homepilot-dashboard-titlebar')).toBeVisible();
    await expect(page.locator('.homepilot-dashboard-chrome')).toBeVisible();
    await expect(page.locator('.homepilot-dashboard-content')).toBeVisible();

    const dashboardChromeBorder = await page.locator('.homepilot-dashboard-chrome').evaluate((element) => (
      getComputedStyle(element).borderBottomWidth
    ));
    expect(dashboardChromeBorder).toBe('1px');

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    await expect(page.getByText('Temperatura de sala').first()).toBeVisible();
    await expect(page.getByText('GUS-RAM').first()).toBeVisible();
    await expect(page.getByText('iPad Guest Level').first()).toBeVisible();
    await expect(page.getByText(/sin lectura|no reading/i).first()).toBeVisible();

    const sensorCardWidths = await page.locator('.sensor-metric-card').evaluateAll((cards) => cards.map((card) => ({
      clientWidth: card.clientWidth,
      scrollWidth: card.scrollWidth,
    })));
    expect(sensorCardWidths).toHaveLength(3);
    sensorCardWidths.forEach(({ clientWidth, scrollWidth }) => {
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    for (const title of ['Temperatura de sala', 'GUS-RAM', 'iPad Guest Level']) {
      await expect(page.locator('.sensor-metric-card').getByText(title, { exact: true })).toHaveCount(1);
    }
    const sensorSurface = page.locator('[data-dashboard-card-id="responsive-battery"] .sensor-metric-card');
    const sensorGeometry = () => sensorSurface.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        width: rect.width,
        height: rect.height,
        padding: style.padding,
        borderRadius: style.borderRadius,
        borderWidth: style.borderWidth,
        backgroundColor: style.backgroundColor,
      };
    });
    const darkSensor = await sensorGeometry();
    await expect(page.getByText('Cortina de sala').first()).toBeVisible();
    await expect(page.locator('[data-dashboard-card-id="responsive-weather"] [data-homepilot-clock]')).toBeVisible();

    await page.evaluate(() => document.documentElement.classList.add('light'));
    const lightSensor = await sensorGeometry();
    expect({ ...lightSensor, backgroundColor: darkSensor.backgroundColor }).toEqual(darkSensor);
    expect(lightSensor.backgroundColor).not.toBe(darkSensor.backgroundColor);
    const lightTokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        canvas: getComputedStyle(document.body).backgroundColor,
        success: style.getPropertyValue('--success').trim(),
        warning: style.getPropertyValue('--warning').trim(),
        danger: style.getPropertyValue('--danger').trim(),
      };
    });
    expect(lightTokens.canvas).not.toBe('rgb(255, 255, 255)');
    expect(lightTokens.success).toBe('123 18% 41%');
    expect(lightTokens.warning).toBe('35 58% 44%');
    expect(lightTokens.danger).toBe('8 45% 48%');
    const lightBackdrop = page.locator('.homepilot-dashboard-backdrop');
    await expect(lightBackdrop).toBeVisible();
    const lightBackdropOverlay = await lightBackdrop.evaluate((element) => (
      getComputedStyle(element, '::after').backgroundImage
    ));
    expect(lightBackdropOverlay).toBe('none');
    const lightCardSurface = page.locator('.homepilot-dashboard-screen .sensor-metric-card').first();
    await expect(lightCardSurface).toBeVisible();
    const lightSurfaceStyle = await lightCardSurface.evaluate((element) => {
      const style = getComputedStyle(element);
      return { backgroundColor: style.backgroundColor };
    });
    expect(lightSurfaceStyle.backgroundColor).not.toBe('rgb(255, 255, 255)');
    await page.evaluate(() => document.documentElement.classList.remove('light'));
  });

  test(`keeps the home flip clock and context chips responsive on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);

    await page.route('**/api/v1/rooms', (route) =>
      route.fulfill({ json: [] })
    );

    await page.route('**/api/v1/scenes', (route) =>
      route.fulfill({ json: [] })
    );

    await page.route('**/api/v1/automations', (route) =>
      route.fulfill({ json: [] })
    );

    await page.route('**/api/v1/scenes/favorites', (route) =>
      route.fulfill({
        json: {
          sceneIds: [],
          initialized: true,
        },
      })
    );

    await page.route('**/api/v1/automations/favorites', (route) =>
      route.fulfill({
        json: {
          automationIds: [],
          initialized: true,
        },
      })
    );

    await page.route('**/api/v1/settings/home-personalization', (route) =>
      route.fulfill({
        json: {
          morningPhrase: '',
          afternoonPhrase: '',
          nightPhrase: '',
          heroImages: [],
        },
      })
    );

    await page.route('https://api.open-meteo.com/**', (route) =>
      route.fulfill({
        json: {
          current: {
            temperature_2m: 19,
            weather_code: 0,
            wind_speed_10m: 3,
            time: '2026-10-06T12:34',
          },
        },
      })
    );

    await page.goto('/');
    const climateSummary = page.getByLabel(/contexto local del hogar|local home context/i);
    await expect(climateSummary).toBeVisible();
    await expect(climateSummary.getByText('Cuenca')).toHaveCount(1);
    await expect(climateSummary.locator('time')).toBeVisible();
    await expect(climateSummary.getByText(/°C|clima no disponible|weather unavailable|cargando clima|loading weather/i)).toBeVisible();
    await expect(climateSummary.locator('.homepilot-home-chip')).toHaveCount(3);
    await expect(climateSummary.getByText(/^(Ubicación|Location)$/)).toHaveCount(0);
    await expect(climateSummary.getByRole('button')).toHaveCount(1);
    const ownDashboard = climateSummary.getByRole('button', { name: /abrir la pestaña Principal de mi tablero|open.*Principal.*dashboard/i });
    await expect(ownDashboard).toBeVisible();
    const ambientImage = page.locator('img[src="/home-dashboard-ambient.png"]');
    await expect(ambientImage).toBeVisible();
    await expect(ambientImage).toHaveAttribute('alt', '');

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    await ownDashboard.click();
    await expect(page).toHaveURL(/\/dashboards\/responsive-dashboard\/responsive-tab$/);
  });

  test(`keeps dashboard history accessible on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);

    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const titlebar = page.locator('.homepilot-dashboard-titlebar');
    await titlebar.getByLabel(/^(More|Más)$/i).click();
    await page.getByRole('menu', { name: /^(More|Más)$/i }).getByRole('menuitem', { name: /dashboard history|historial del tablero/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Hogar anterior/);

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  });
}

test('Feature: User dashboard navigation — Scenario: Given an authenticated user When the dashboard group is toggled and a child is selected Then it expands independently and navigates to that dashboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);

  await page.goto('/');
  const dashboardGroup = page.getByRole('button', { name: /dashboards|tableros/i }).first();
  await expect(dashboardGroup).toHaveAttribute('aria-expanded', 'false');

  await dashboardGroup.click();
  await expect(dashboardGroup).toHaveAttribute('aria-expanded', 'true');
  const dashboardChild = page.getByRole('button', { name: 'Hogar de prueba' });
  await expect(dashboardChild).toBeVisible();

  await dashboardChild.click();
  await expect(page).toHaveURL(/\/dashboards\/responsive-dashboard/);
  await page.locator('.homepilot-dashboard-titlebar').getByLabel(/^(More|Más)$/i).click();
  await expect(page.getByRole('menuitem', { name: /dashboard history|historial del tablero/i })).toBeVisible();

  await dashboardGroup.click();
  await expect(dashboardGroup).toHaveAttribute('aria-expanded', 'false');
  await expect(dashboardChild).toBeHidden();
});

test('Feature: Collapsed sidebar navigation — Scenario: Given an authenticated desktop user When each icon-only item is selected Then its exact route and active state are applied', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);

  await page.goto('/');
  const sidebar = page.locator('aside').first();
  await page.getByRole('button', { name: /show or hide menu|mostrar u ocultar menú/i }).click();
  await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(100);

  const conversation = page.getByTitle(/talk to.*home|conversar con mi casa/i);
  await expect(conversation).toBeVisible();
  await conversation.click();
  await expect(page).toHaveURL(/\/home-conversation$/);
  await expect(conversation).toHaveAttribute('aria-current', 'page');

const systemGroup = page.getByRole('button', { name: /^system$/i });
  const discovery = page.getByRole('button', { name: /system inbox|discovery|descubrimiento/i });
  await systemGroup.click();
  await expect(discovery).toBeHidden();
  await systemGroup.click();
  await expect(discovery).toBeVisible();
  await expect(discovery).toBeVisible();
  await discovery.click();
  await expect(page).toHaveURL(/\/system\/inbox$/);
  await expect(discovery).toHaveAttribute('aria-current', 'page');
  await expect(conversation).not.toHaveAttribute('aria-current', 'page');
  await systemGroup.click();
  await expect(discovery).toBeHidden();
});

for (const viewport of viewports.filter((viewport) => viewport.name !== 'desktop')) {
  test(`Feature: Responsive sidebar dismissal — Scenario: Given an open ${viewport.name} sidebar When the operator taps outside or swipes left Then the drawer closes without affecting vertical scrolling`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.goto('/');

    const menuToggle = page.locator('main').getByRole('button', { name: /show or hide menu|mostrar u ocultar menú/i });
    const sidebar = page.locator('aside').first();
    const backdrop = page.getByTestId('mobile-sidebar-backdrop');

    await menuToggle.click();
    await expect(backdrop).toBeVisible();
    await backdrop.click({ position: { x: viewport.width - 16, y: 96 } });
    await expect(backdrop).toBeHidden();

    await menuToggle.click();
    await expect(backdrop).toBeVisible();
    await sidebar.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 240, clientY: 240 });
    await sidebar.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 144, clientY: 244 });
    await expect(backdrop).toBeHidden();

    await menuToggle.click();
    await sidebar.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 176, clientY: 220 });
    await sidebar.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 178, clientY: 116 });
    await expect(backdrop).toBeVisible();
  });
}
