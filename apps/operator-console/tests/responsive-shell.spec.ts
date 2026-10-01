import { expect, test } from '@playwright/test';
import { mdiAutoFix, mdiHome, mdiRobot, mdiWeatherWindy } from '@mdi/js';

const setupStatus = {
  isInitialized: true,
  requiresOnboarding: false,
  hasAdminUser: true,
  hasHAConfig: false,
  haConnectionValid: false,
  installationProfile: 'native_only',
  requiresHomeAssistant: false,
};

const viewports = [
  { name: 'mobile', width: 320, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const portraitKioskViewport = { width: 1080, height: 1920 };

const dashboardUser = {
  id: 'responsive-admin',
  username: 'admin',
  role: 'admin',
  displayName: 'Administrador',
  avatarDataUri: null,
};

const responsiveDevices = [
  {
    id: 'sensor-climate',
    homeId: 'responsive-home',
    roomId: 'responsive-room',
    name: 'Temperatura de sala',
    type: 'sensor',
    semanticType: 'sensor',
    status: 'ASSIGNED',
    lastKnownState: { state: 'unavailable', unit_of_measurement: '°C' },
  },
  {
    id: 'sensor-memory',
    homeId: 'responsive-home',
    roomId: 'responsive-room',
    name: 'GUS-RAM',
    type: 'sensor',
    semanticType: 'sensor',
    status: 'ASSIGNED',
    lastKnownState: { state: 'unavailable', unit_of_measurement: '%' },
  },
  {
    id: 'sensor-battery',
    homeId: 'responsive-home',
    roomId: 'responsive-room',
    name: 'iPad Guest Level',
    type: 'sensor',
    semanticType: 'sensor',
    status: 'ASSIGNED',
    lastKnownState: { state: '90', unit_of_measurement: '%', attributes: { device_class: 'battery' } },
  },
  {
    id: 'cover-living',
    homeId: 'responsive-home',
    roomId: 'responsive-room',
    name: 'Cortina de sala',
    type: 'cover',
    semanticType: 'cover',
    status: 'ASSIGNED',
    capabilities: [
      { type: 'command', name: 'open' },
      { type: 'command', name: 'close' },
      { type: 'command', name: 'set_position' },
    ],
    lastKnownState: { state: 'open', current_position: 65, attributes: { device_class: 'curtain' } },
  },
];

const responsiveDashboard = {
  id: 'responsive-dashboard',
  ownerId: dashboardUser.id,
  title: 'Hogar de prueba',
  visibility: { roles: [], users: [], homes: [] },
  tabs: [
    {
      id: 'responsive-tab',
      title: 'Principal',
      isDefault: true,
      widgets: [
        {
          id: 'responsive-title',
          type: 'dashboard_title',
          config: {
            layout: { x: 0, y: 0, w: 3, h: 1, span: 3 },
            binding: { entityId: 'responsive-dashboard', entityType: 'system', entityName: 'Hogar de prueba' },
            visibility: { rules: [], defaultState: 'show' },
            appearance: { title: 'Hogar de prueba', showTitle: true },
          },
        },
        {
          id: 'responsive-section',
          type: 'section',
          config: {
            layout: { x: 0, y: 1, w: 3, h: 4, span: 3 },
            binding: { entityId: 'responsive-section', entityType: 'system', entityName: 'Lecturas del hogar' },
            visibility: { rules: [], defaultState: 'show' },
            appearance: { title: 'Lecturas del hogar', showTitle: true },
            extra: {
              cards: [
                { id: 'responsive-sensor', kind: 'sensor', title: 'Temperatura de sala', entityId: 'sensor-climate', span: 'small', icon: 'Gauge' },
                { id: 'responsive-memory', kind: 'sensor', title: 'GUS-RAM', entityId: 'sensor-memory', span: 'small', icon: 'MemoryStick' },
                { id: 'responsive-battery', kind: 'sensor', title: 'iPad Guest Level', entityId: 'sensor-battery', span: 'small', icon: 'BatteryFull' },
                { id: 'responsive-cover', kind: 'cover', title: 'Cortina de sala', entityId: 'cover-living', span: 'medium', icon: 'Blinds' },
                { id: 'responsive-weather', kind: 'clock_minimal', title: 'Clima local', span: 'full', icon: 'Clock' },
              ],
            },
          },
        },
      ],
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function prepareLoginShell(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/system/setup-status', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(setupStatus) });
  });
}

async function prepareAuthenticatedDashboard(page: import('@playwright/test').Page, dashboard: object = responsiveDashboard, user = dashboardUser) {
  await page.addInitScript((user) => {
    localStorage.setItem('hp_session_token', 'responsive-test-token');
    localStorage.setItem('hp_user_ctx', JSON.stringify(user));
  }, user);

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(user) });
  });
  await page.route('**/api/v1/system/setup-status', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(setupStatus) });
  });
  await page.route('**/api/v1/dashboards', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([dashboard]) });
  });
  await page.route('**/api/v1/dashboards/responsive-dashboard/history', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'responsive-revision',
        dashboardId: 'responsive-dashboard',
        createdAt: '2026-01-02T12:30:00.000Z',
        snapshot: { title: 'Hogar anterior', tabs: [{ id: 'responsive-tab', title: 'Principal', widgets: [] }] },
      }]),
    });
  });
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(responsiveDevices) });
  });
  await page.route('**/api/v1/homes', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/assistant/findings', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/assistant/summary', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ totalOpen: 0 }) });
  });
}

for (const viewport of [
  ...viewports,
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'portrait kiosk', ...portraitKioskViewport },
]) {
  test(`Feature: Sensor clarity — readings and missing data fit ${viewport.name} in both themes`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const readings = [
      { id: 'clarity-temperature', title: 'Sala principal', deviceClass: 'temperature', state: '22.4', unit: '°C' },
      { id: 'clarity-battery', title: 'Batería de la tablet', deviceClass: 'battery', state: '18', unit: '%' },
      { id: 'clarity-memory', title: 'RAM del estudio', deviceClass: 'memory', state: '70', unit: '%' },
      { id: 'clarity-load', title: 'Procesador', deviceClass: 'cpu', state: '100', unit: '%' },
      { id: 'clarity-missing', title: 'Temperatura exterior', deviceClass: 'temperature', state: 'unavailable', unit: '°C' },
    ];
    const baseSection = responsiveDashboard.tabs[0]!.widgets[1]!;
    const dashboard = {
      ...responsiveDashboard,
      tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [{
        ...baseSection,
        config: { ...baseSection.config, extra: { cards: readings.map(({ id, title }) => ({ id, title, kind: 'sensor', entityId: id, span: 'small' })) } },
      }] }],
    };
    await prepareAuthenticatedDashboard(page, dashboard);
    await page.route('**/api/v1/devices', (route) => route.fulfill({ json: readings.map((reading) => ({
      id: reading.id, homeId: 'responsive-home', roomId: null, name: `Technical ${reading.id}`, type: 'sensor', status: 'ASSIGNED',
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
    expect(hierarchy.value).toBeGreaterThanOrEqual(24);
    for (const theme of ['dark', 'light']) {
      await page.evaluate((isLight) => document.documentElement.classList.toggle('light', isLight), theme === 'light');
      for (const reading of readings) {
        const card = page.locator(`[data-dashboard-card-id="${reading.id}"] .sensor-metric-card`);
        await expect(card.getByText(reading.title, { exact: true })).toHaveCount(1);
        await expect(card.getByText(reading.title, { exact: true })).toBeVisible();
        await expect(card).not.toContainText(`Technical ${reading.id}`);
        await expect(card.getByRole('button')).toHaveCount(0);
        if (reading.unit === '%') {
          await expect(card.getByText(reading.state, { exact: true })).toBeVisible();
          await expect(card.getByRole('meter', { name: reading.title })).toHaveAttribute('aria-valuenow', reading.state);
          await expect(card.getByRole('meter', { name: reading.title })).toHaveAttribute('aria-valuetext', `${reading.state}%`);
        }
      }
      const missing = page.locator('[data-dashboard-card-id="clarity-missing"] .sensor-metric-card');
      await expect(missing.getByText(/^(Sin lectura|No reading)$/i)).toBeVisible();
      await expect(missing.getByText('—', { exact: true })).toBeVisible();
      await expect(missing).not.toContainText('°C');
      await expect(missing.getByRole('meter')).toHaveCount(0);
      await expect(page.locator('[data-dashboard-card-id="clarity-memory"]').getByText(/^(Uso elevado|High usage)$/i)).toBeVisible();
      expect(await cards.evaluateAll((elements) => elements.every((element) => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight))).toBe(true);
      expect(await cards.locator('.sensor-reading-value > span').evaluateAll((elements) => elements.every((element) => element.scrollWidth <= element.clientWidth))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(await geometry()).toEqual(darkGeometry);
    }
  });
}

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
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).click();

  const section = (name: string) => page.locator('.homepilot-dashboard-widget').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const handle = (name: string) => section(name).getByRole('button', { name: /Drag to reorder|Arrastrar para reordenar/i });
  await expect(page.locator('[data-section-slot="3"]')).toBeVisible();
  await handle('B').dragTo(page.locator('[data-section-slot="4"]'), { steps: 12 });
  await expect.poll(() => dashboard.tabs[0]?.sectionLayout.columns4).toEqual(['a', null, 'c', null, 'b']);
  await handle('A').dragTo(section('C'), { steps: 12 });
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

test('Feature: Section slots — a historical wide Section edits and saves as one slot without a width picker', async ({ page }) => {
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
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  await expect(page.locator('[data-section-slot="1"] .homepilot-dashboard-widget')).toHaveCount(0);
  await page.getByRole('button', { name: /Editar sección|Edit section/i }).click();
  const editor = page.getByRole('dialog', { name: /Editar sección|Edit section/i });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('group', { name: /Ancho de la tarjeta|Card width/i })).toHaveCount(0);
  await editor.getByRole('button', { name: /^(Guardar|Save)$/i }).click();
  await expect.poll(() => dashboard.tabs[0].widgets[0].config.layout.span).toBe(1);
  expect(dashboard.tabs[0].widgets[0].config.extra.cards.map((card) => card.id)).toEqual(['legacy-card']);
  expect(dashboard.tabs[0].sectionLayout.columns4).toEqual(['legacy-wide-section', null]);
});

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

test('Feature: scene favorites — a legacy local favorite migrates once and the server remains authoritative', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('legacy-favorites-seeded')) return;
    localStorage.setItem('hp_fav_scenes', JSON.stringify(['favorite-scene']));
    sessionStorage.setItem('legacy-favorites-seeded', '1');
  });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
  await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: [{
    id: 'favorite-scene', homeId: 'responsive-home', roomId: null, name: 'Escena noche', actions: [],
  }] }));
  let initialized = false;
  let serverIds: string[] = [];
  let saves = 0;
  await page.route('**/api/v1/scenes/favorites', async (route) => {
    if (route.request().method() === 'PUT') {
      serverIds = (route.request().postDataJSON() as { sceneIds: string[] }).sceneIds;
      initialized = true;
      saves += 1;
      return route.fulfill({ json: serverIds });
    }
    return route.fulfill({ json: { sceneIds: serverIds, initialized } });
  });
  await page.goto('/');
  await expect(page.locator('.homepilot-home-routines').getByRole('button', { name: /Escena noche/ })).toBeVisible();
  expect(serverIds).toEqual(['favorite-scene']);
  expect(saves).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('hp_fav_scenes'))).toBeNull();

  await page.reload();
  await expect(page.locator('.homepilot-home-routines').getByRole('button', { name: /Escena noche/ })).toBeVisible();
  expect(saves).toBe(1);
  serverIds = [];
  await page.reload();
  await expect(page.locator('.homepilot-home-routines').getByRole('button', { name: /Escena noche/ })).toHaveCount(0);
  expect(saves).toBe(1);

  serverIds = ['favorite-scene'];
  await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: [
    { id: 'favorite-scene', homeId: 'responsive-home', roomId: null, name: 'Escena noche', actions: [] },
    { id: 'other-scene', homeId: 'responsive-home', roomId: null, name: 'Escena mañana', actions: [] },
  ] }));
  await page.evaluate(() => localStorage.setItem('hp_fav_scenes', JSON.stringify(['other-scene'])));
  await page.reload();
  await expect(page.locator('.homepilot-home-routines').getByRole('button', { name: /Escena mañana/ })).toBeVisible();
  expect(serverIds).toEqual(['favorite-scene', 'other-scene']);
  expect(saves).toBe(2);
});

const favoriteAutomationRules = [
  { id: 'automation-x', homeId: 'responsive-home', name: 'Luz nocturna', enabled: true,
    trigger: { type: 'time', timeLocal: '22:00', timezone: 'America/Guayaquil' },
    action: { type: 'device_command', targetDeviceId: 'sensor-climate', command: 'turn_on' } },
  { id: 'automation-y', homeId: 'responsive-home', name: 'Luz matutina', enabled: true,
    trigger: { type: 'time', timeLocal: '07:00', timezone: 'America/Guayaquil' },
    action: { type: 'device_command', targetDeviceId: 'sensor-climate', command: 'turn_on' } },
];

test('Feature: favorite routines — compact action tiles execute momentarily without toggling automations', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
  const scenes = Array.from({ length: 5 }, (_, index) => ({
    id: `scene-${index}`, homeId: 'responsive-home', roomId: null, name: `Escena ${index + 1}`, icon: 'mdi:home', actions: [{ deviceId: 'sensor-climate', command: 'turn_on' }],
  }));
  await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: scenes }));
  await page.route('**/api/v1/scenes/favorites', (route) => route.fulfill({ json: { sceneIds: scenes.map((scene) => scene.id), initialized: true } }));
  await page.route('**/api/v1/automations', (route) => route.fulfill({ json: favoriteAutomationRules.slice(0, 1) }));
  await page.route('**/api/v1/automations/favorites', (route) => route.fulfill({ json: { automationIds: ['automation-x'], initialized: true } }));
  let releaseScene: (() => void) | undefined;
  let sceneAttempts = 0;
  let automationRuns = 0;
  let automationToggles = 0;
  await page.route('**/api/v1/scenes/scene-0/execute', async (route) => {
    sceneAttempts += 1;
    if (sceneAttempts === 1) await new Promise<void>((resolve) => { releaseScene = resolve; });
    await route.fulfill({ status: sceneAttempts === 1 ? 200 : 500, json: {} });
  });
  await page.route('**/api/v1/automations/automation-x/run', (route) => {
    automationRuns += 1;
    return route.fulfill({ json: {} });
  });
  await page.route(/\/api\/v1\/automations\/automation-x\/(enable|disable)$/, (route) => {
    automationToggles += 1;
    return route.fulfill({ json: {} });
  });
  await page.goto('/');
  const grid = page.getByTestId('favorite-routine-grid');
  const tiles = grid.locator('[data-home-routine]');
  await expect(tiles).toHaveCount(6);
  const rowPositions = await tiles.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
  expect(rowPositions.filter((position) => position === rowPositions[0]).length).toBeGreaterThanOrEqual(3);
  expect(await tiles.evaluateAll((items) => items.every((item) => item.getBoundingClientRect().width <= 144))).toBe(true);
  const scene = grid.locator('[data-home-routine="scene"]').filter({ hasText: 'Escena 1' }).getByRole('button');
  const sceneTile = grid.locator('[data-home-routine="scene"]').filter({ hasText: 'Escena 1' });
  const automation = grid.locator('[data-home-routine="automation"]').getByRole('button');
  await expect(scene).toHaveText('Escena 1');
  await expect(scene.locator('svg')).toBeVisible();
  await expect(grid.getByText(/^(Manual|Automática|Automatic|1 acción|1 action)$/i)).toHaveCount(0);
  await scene.click();
  await expect(sceneTile).toHaveCSS('background-image', /linear-gradient/);
  await expect(scene).toHaveAttribute('aria-busy', 'true');
  await expect(scene).toBeDisabled();
  await expect(scene).toHaveCSS('opacity', '1');
  await expect(automation).toBeDisabled();
  expect(sceneAttempts).toBe(1);
  releaseScene?.();
  await expect(scene.getByRole('status')).toBeVisible();
  await expect(scene).toHaveAttribute('data-action-state', 'idle', { timeout: 5_000 });
  await expect(sceneTile).toHaveCSS('background-image', 'none');
  await automation.click();
  await expect(automation.getByRole('status')).toBeVisible();
  await expect(automation).toHaveAttribute('data-action-state', 'idle', { timeout: 5_000 });
  expect(automationRuns).toBe(1);
  expect(automationToggles).toBe(0);
  await scene.click();
  await expect(scene.getByRole('alert')).toBeVisible();
  await expect(scene).toHaveAttribute('data-action-state', 'idle', { timeout: 6_000 });
  expect(sceneAttempts).toBe(2);
});

for (const viewport of [
  { name: 'mobile portrait', width: 320, height: 720 },
  { name: 'mobile landscape', width: 844, height: 390 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'kiosk portrait', width: 1080, height: 1920 },
  { name: 'kiosk landscape', width: 1920, height: 1080 },
]) {
  test(`Feature: Compact scene cards — Scenario: Explicit execution and independent controls fit ${viewport.name} (AC47)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
    const scenes = Array.from({ length: 5 }, (_, index) => ({
      id: `compact-scene-${index}`, homeId: 'responsive-home', roomId: null,
      name: index === 0 ? 'Trabajo' : `Escena ${index}`, actions: [{ deviceId: 'cover-living', command: 'open' }],
    }));
    await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: scenes }));
    let favorites: string[] = [];
    await page.route('**/api/v1/scenes/favorites', async (route) => {
      if (route.request().method() === 'PUT') favorites = route.request().postDataJSON().sceneIds;
      await route.fulfill({ json: { sceneIds: favorites, initialized: true } });
    });
    let executions = 0;
    let finishExecution: () => void = () => {};
    const executionGate = new Promise<void>((resolve) => { finishExecution = resolve; });
    await page.route('**/api/v1/scenes/compact-scene-0/execute', async (route) => {
      executions += 1;
      await executionGate;
      await route.fulfill({ json: { success: true } });
    });
    await page.goto('/routines/scenes');
    const card = page.getByRole('article', { name: 'Trabajo', exact: true });
    await expect(card).toBeVisible();
    for (const theme of ['dark', 'light']) {
      await page.evaluate((isLight) => document.documentElement.classList.toggle('light', isLight), theme === 'light');
      await expect(page.getByRole('article')).toHaveCount(5);
      const geometry = await card.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return { height: bounds.height, width: bounds.width, overflows: element.scrollWidth > element.clientWidth };
      });
      expect(geometry.height).toBeLessThan(160);
      expect(geometry.width).toBeLessThan(400);
      expect(geometry.overflows).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      for (const control of ['Ejecutar|Run', 'Añadir a favoritas|Add to favorites', 'Editar|Edit', 'Eliminar|Delete']) {
        const button = card.getByRole('button', { name: new RegExp(`^(${control})$`, 'i') });
        await expect(button).toBeVisible();
        // The CSS layout box excludes transient transforms and subpixel rect subtraction.
        const bounds = await button.evaluate(element => ({ width: element.offsetWidth, height: element.offsetHeight }));
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
      }
      if (viewport.name === 'desktop' || viewport.name === 'mobile portrait') {
        await page.screenshot({ path: testInfo.outputPath(`scene-cards-${theme}.png`) });
      }
    }
    await card.getByRole('heading', { name: 'Trabajo' }).click();
    expect(executions).toBe(0);
    await card.getByRole('button', { name: /^(Editar|Edit)$/i }).click();
    const editor = page.getByRole('dialog', { name: /^(Editar Escena|Edit Scene)$/i });
    await expect(editor).toBeVisible();
    expect(executions).toBe(0);
    await page.keyboard.press('Escape');
    await expect(editor).not.toBeVisible();
    await card.getByRole('button', { name: /^(Eliminar|Delete)$/i }).click();
    const deletion = page.getByRole('dialog', { name: /Eliminar Escena|Delete Scene/i });
    await expect(deletion).toBeVisible();
    expect(executions).toBe(0);
    await deletion.getByRole('button', { name: /^(Cancelar|Cancel)$/i }).click();
    await expect(deletion).not.toBeVisible();
    await card.getByRole('button', { name: /^(Añadir a favoritas|Add to favorites)$/i }).click();
    await expect(card.getByRole('button', { name: /^(Quitar de favoritas|Remove from favorites)$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(executions).toBe(0);
    const execute = card.getByRole('button', { name: /^(Ejecutar|Run)$/i });
    await execute.focus();
    await page.keyboard.press('Enter');
    await expect(execute).toBeDisabled();
    await expect(execute).toHaveAttribute('aria-busy', 'true');
    await expect.poll(() => executions).toBe(1);
    await page.keyboard.press('Enter');
    expect(executions).toBe(1);
    finishExecution();
    await expect(card.getByRole('status')).toHaveText(/^(Ejecutada|Completed)$/i);
    await expect(card.getByRole('button', { name: /^(Ejecutada|Completed)$/i })).toBeEnabled();
  });
}

for (const viewport of [
  { name: 'mobile', width: 320, height: 720 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'kiosk portrait', width: 1080, height: 1920 },
]) {
  test(`Feature: Scene editor spaces — Scenario: Selected entities stay first and a large catalog saves unchanged scope on ${viewport.name} (AC48)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
    await page.route('**/api/v1/rooms', (route) => route.fulfill({ json: [
      { id: 'office', homeId: 'responsive-home', name: 'Oficina' }, { id: 'kitchen', homeId: 'responsive-home', name: 'Cocina' },
    ] }));
    const device = (id: string, name: string, roomId: string | null) => ({ id, name, roomId, homeId: 'responsive-home', type: 'light', status: 'ASSIGNED' });
    await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [
      ...Array.from({ length: 20 }, (_, i) => device(`office-${i}`, `Luz ${i}`, 'office')),
      ...Array.from({ length: 10 }, (_, i) => device(`kitchen-${i}`, `Cocina luz ${i}`, 'kitchen')),
      device('chosen', 'Zeta elegida', 'office'), device('unassigned', 'Luz sin asignar', null),
      device('orphan', 'Luz huérfana', 'deleted-room'),
    ] }));
    let scene = { id: 'organized-scene', homeId: 'responsive-home', roomId: null, name: 'Trabajo organizada', description: 'Descripción conservada', actions: [{ deviceId: 'chosen', command: 'turn_off' }] };
    await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: [scene] }));
    await page.route('**/api/v1/scenes/favorites', (route) => route.fulfill({ json: { sceneIds: [], initialized: true } }));
    let saved = false;
    await page.route('**/api/v1/scenes/organized-scene', (route) => {
      scene = { ...scene, ...route.request().postDataJSON() as typeof scene };
      saved = true;
      return route.fulfill({ json: scene });
    });
    await page.goto('/routines/scenes');
    await page.getByRole('article', { name: scene.name }).getByRole('button', { name: /^(Editar|Edit)$/i }).click();
    const editor = page.getByRole('dialog', { name: /^(Editar Escena|Edit Scene)$/i });
    const selected = editor.getByRole('region', { name: /^(Seleccionadas|Selected)$/i });
    const available = editor.getByRole('region', { name: /^(Entidades disponibles|Available entities)$/i });
    await expect(selected.getByRole('button', { name: /Zeta elegida/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(selected.getByRole('radio', { name: /^(Apagar|Turn Off)$/i })).toHaveAttribute('aria-checked', 'true');
    expect(await editor.getByRole('region').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')))).toEqual(['Selected', 'Available entities']);
    const office = available.locator('summary').filter({ hasText: 'Oficina' });
    await office.click();
    const last = available.getByRole('button', { name: /Luz 19 / });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeVisible();
    await available.getByRole('searchbox', { name: /Buscar entidad|Search entities/i }).fill('Luz 19');
    await expect(selected.getByRole('button', { name: /Zeta elegida/ })).toBeVisible();
    await last.click();
    await expect(selected.getByRole('button', { name: /Luz 19 / })).toHaveAttribute('aria-pressed', 'true');
    await expect(available.getByRole('button', { name: /Luz 19 / })).toHaveCount(0);
    await available.getByRole('searchbox', { name: /Buscar entidad|Search entities/i }).fill('');
    await available.getByRole('button', { name: /^(Todos los espacios|All spaces)$/i }).click();
    await page.getByRole('listbox').getByRole('option', { name: /^(Sin espacio|Unassigned space)$/i }).click();
    await expect(available.getByRole('button', { name: /Luz huérfana/ })).toBeVisible();
    await available.getByRole('button', { name: /Luz sin asignar/ }).click();
    await expect(selected.getByRole('button', { name: /Zeta elegida/ })).toHaveAttribute('aria-pressed', 'true');
    if (viewport.name === 'desktop' || viewport.name === 'mobile') {
      await editor.screenshot({ path: testInfo.outputPath('scene-editor.png') });
    }
    await editor.getByRole('button', { name: /^(Guardar Escena|Save Scene)$/i }).click();
    await expect.poll(() => saved).toBe(true);
    expect(scene.roomId).toBeNull();
    expect(scene.description).toBe('Descripción conservada');
    expect(scene.actions).toEqual([
      { deviceId: 'chosen', command: 'turn_off' }, { deviceId: 'office-19', command: 'turn_on' }, { deviceId: 'unassigned', command: 'turn_on' },
    ]);
    await page.getByRole('button', { name: /^(Crear Escena|Create Scene)$/i }).click();
    const create = page.getByRole('dialog', { name: /^(Crear Escena|Create Scene)$/i });
    await expect(create.getByRole('region', { name: /^(Seleccionadas|Selected)$/i }).getByRole('button')).toHaveCount(0);
    await expect(create.getByRole('region', { name: /^(Entidades disponibles|Available entities)$/i }).locator('summary').filter({ hasText: 'Oficina' })).toBeVisible();
    await expect(create.getByRole('button', { name: /^(Guardar Escena|Save Scene)$/i })).toBeDisabled();
  });
}

test('Feature: routine icons — editing scenes and automations persists one icon for lists and Home favorites', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
  let scene = {
    id: 'scene-icon', homeId: 'responsive-home', roomId: null, name: 'Escena icono',
    actions: [{ deviceId: 'cover-living', command: 'open' }], icon: undefined as string | undefined,
  };
  let automation = {
    id: 'automation-icon', homeId: 'responsive-home', name: 'Auto icono', enabled: true,
    trigger: { type: 'time', timeLocal: '22:00', timezone: 'America/Guayaquil' },
    action: { type: 'device_command', targetDeviceId: 'cover-living', command: 'open' },
    icon: undefined as string | undefined,
  };
  await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: [scene] }));
  await page.route('**/api/v1/automations', (route) => route.fulfill({ json: [automation] }));
  await page.route('**/api/v1/scenes/scene-icon', (route) => {
    scene = { ...scene, ...route.request().postDataJSON() as typeof scene };
    return route.fulfill({ json: scene });
  });
  await page.route('**/api/v1/automations/automation-icon', (route) => {
    automation = { ...automation, ...route.request().postDataJSON() as typeof automation };
    return route.fulfill({ json: automation });
  });
  await page.route('**/api/v1/scenes/favorites', (route) => route.fulfill({ json: { sceneIds: ['scene-icon'], initialized: true } }));
  await page.route('**/api/v1/automations/favorites', (route) => route.fulfill({ json: { automationIds: ['automation-icon'], initialized: true } }));

  await page.goto('/');
  const legacyFavorites = page.getByTestId('favorite-routine-grid');
  await expect(legacyFavorites.locator('[data-home-routine="scene"] svg path')).toHaveAttribute('d', mdiAutoFix);
  await expect(legacyFavorites.locator('[data-home-routine="automation"] svg path')).toHaveAttribute('d', mdiRobot);

  await page.goto('/routines/scenes');
  await expect(page.getByRole('heading', { name: 'Escena icono' }).locator('../..').locator('svg').first()).toBeVisible();
  await page.getByRole('button', { name: /^(Editar|Edit)$/i }).click();
  const sceneEditor = page.getByRole('dialog', { name: /^(Editar Escena|Edit Scene)$/i });
  await sceneEditor.getByRole('button', { name: /^(Icono|Icon)$/i }).click();
  const picker = page.getByRole('dialog', { name: /^(Icono|Icon)$/i });
  await picker.getByRole('searchbox').fill('home');
  await picker.getByRole('listbox').getByRole('option', { name: 'home', exact: true }).click();
  await sceneEditor.getByRole('button', { name: /^(Guardar Escena|Save Scene)$/i }).click();
  expect(scene.icon).toBe('mdi:home');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Escena icono' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Escena icono' }).locator('../..').locator('svg path').first()).toHaveAttribute('d', mdiHome);

  await page.goto('/routines/automations');
  await page.getByRole('button', { name: /^(Editar|Edit)$/i }).click();
  const automationEditor = page.getByRole('dialog', { name: /^(Refinar Automatización|Refine Automation)$/i });
  await automationEditor.getByRole('button', { name: /^(Icono|Icon)$/i }).click();
  await picker.getByRole('searchbox').fill('weather windy');
  await picker.getByRole('listbox').getByRole('option', { name: 'weather-windy', exact: true }).click();
  await automationEditor.getByRole('button', { name: /^(Confirmar Automatización|Confirm Automation)$/i }).click();
  expect(automation.icon).toBe('mdi:weather-windy');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Auto icono' })).toBeVisible();

  await page.goto('/');
  const favorites = page.getByTestId('favorite-routine-grid');
  await expect(favorites.locator('[data-home-routine="scene"] svg path')).toHaveAttribute('d', mdiHome);
  await expect(favorites.locator('[data-home-routine="automation"] svg path')).toHaveAttribute('d', mdiWeatherWindy);

  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  const boundDashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [
    responsiveDashboard.tabs[0]!.widgets[0]!, {
      ...section, config: { ...section.config, extra: { cards: [
        { id: 'scene-binding', kind: 'action', title: scene.name, entityId: scene.id, span: 'small', icon: 'mdi:cursor-default-click' },
        { id: 'automation-binding', kind: 'action', title: automation.name, entityId: `automation:${automation.id}`, span: 'small', icon: 'mdi:cursor-default-click' },
      ] } },
    },
  ] }] };
  await page.route('**/api/v1/dashboards', (route) => route.fulfill({ json: [boundDashboard] }));
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await expect(page.locator('[data-dashboard-card-id="scene-binding"] svg path')).toHaveAttribute('d', mdiHome);
  await expect(page.locator('[data-dashboard-card-id="automation-binding"] svg path')).toHaveAttribute('d', mdiWeatherWindy);
});

test('Feature: routine icons — new scenes and automations save a selected icon and reload it', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [{
    id: 'scene-light', homeId: 'responsive-home', roomId: null, name: 'Scene light', type: 'light', semanticType: 'light', status: 'ASSIGNED', lastKnownState: null,
  }] }));
  let createdScene: { id: string; homeId: string; roomId: string | null; name: string; icon?: string; actions: object[] } | null = null;
  let createdAutomation: { id: string; homeId: string; name: string; icon?: string; enabled: boolean; trigger: object; action: object } | null = null;
  await page.route('**/api/v1/scenes', (route) => {
    if (route.request().method() === 'POST') {
      createdScene = { ...route.request().postDataJSON() as NonNullable<typeof createdScene>, id: 'new-scene' };
      return route.fulfill({ status: 201, json: createdScene });
    }
    return route.fulfill({ json: createdScene ? [createdScene] : [] });
  });
  await page.route('**/api/v1/automations', (route) => {
    if (route.request().method() === 'POST') {
      createdAutomation = { ...route.request().postDataJSON() as NonNullable<typeof createdAutomation>, id: 'new-automation', homeId: 'responsive-home', enabled: true };
      return route.fulfill({ status: 201, json: createdAutomation });
    }
    return route.fulfill({ json: createdAutomation ? [createdAutomation] : [] });
  });

  await page.goto('/routines/scenes');
  await page.getByRole('button', { name: /^(Crear Escena|Create Scene)$/i }).first().click();
  const sceneEditor = page.getByRole('dialog', { name: /^(Crear Escena|Create Scene)$/i });
  await sceneEditor.getByRole('textbox', { name: /Cena con invitados|Dinner Party/i }).fill('Escena nueva');
  await sceneEditor.getByRole('button', { name: /^(Icono|Icon)$/i }).click();
  const picker = page.getByRole('dialog', { name: /^(Icono|Icon)$/i });
  await picker.getByRole('searchbox').fill('home');
  await picker.getByRole('listbox').getByRole('option', { name: 'home', exact: true }).click();
  await sceneEditor.getByText('Scene light', { exact: true }).click();
  await sceneEditor.getByRole('button', { name: /^(Guardar Escena|Save Scene)$/i }).click();
  expect(createdScene).toMatchObject({ name: 'Escena nueva', icon: 'mdi:home' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Escena nueva' })).toBeVisible();

  await page.goto('/routines/automations');
  await page.getByRole('button', { name: /^(Crear Regla|Create Rule)$/i }).first().click();
  const automationEditor = page.getByRole('dialog', { name: /^(Nueva Automatización|New Automation)$/i });
  await automationEditor.getByRole('textbox', { name: /Asignar nombre|Naming this Automation/i }).fill('Auto nueva');
  await automationEditor.getByRole('button', { name: /^(Icono|Icon)$/i }).click();
  await picker.getByRole('searchbox').fill('weather windy');
  await picker.getByRole('listbox').getByRole('option', { name: 'weather-windy', exact: true }).click();
  await automationEditor.getByRole('radiogroup', { name: /Disparador de Inteligencia|Intelligence Trigger/i }).getByRole('radio', { name: /^(Hora|Time)$/i }).click();
  await automationEditor.getByRole('radiogroup', { name: /Consecuencia Definida|Defined Consequence/i }).getByRole('radio', { name: /^(Escenas|Scenes)$/i }).click();
  await automationEditor.getByRole('button', { name: /Seleccionar Escena|Select Scene/i }).click();
  await page.getByRole('listbox', { name: /Seleccionar Escena|Select Scene/i }).getByRole('option', { name: 'Escena nueva' }).click();
  await automationEditor.getByRole('button', { name: /^(Confirmar Automatización|Confirm Automation)$/i }).click();
  expect(createdAutomation).toMatchObject({ name: 'Auto nueva', icon: 'mdi:weather-windy' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Auto nueva' })).toBeVisible();
});

test('Feature: Routine device identities — Scenes and automations list non-camera devices without offering sensors an invalid scene command', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [
    { id: 'identity-light', homeId: 'responsive-home', roomId: null, name: 'Luz de sala', type: 'light', status: 'ASSIGNED' },
    { id: 'identity-switch', homeId: 'responsive-home', roomId: null, name: 'Interruptor de sala', type: 'switch', status: 'ASSIGNED' },
    { id: 'identity-sensor', homeId: 'responsive-home', roomId: null, name: 'Sensor de sala', type: 'sensor', status: 'ASSIGNED', capabilities: [{ type: 'sensor', name: 'Sensor' }] },
    { id: 'identity-cover', homeId: 'responsive-home', roomId: null, name: 'Cortina de sala', type: 'cover', status: 'ASSIGNED' },
    { id: 'identity-camera', homeId: 'responsive-home', roomId: null, name: 'Cámara de sala', type: 'camera', status: 'ASSIGNED' },
  ] }));
  await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/automations', (route) => route.fulfill({ json: [] }));

  await page.goto('/routines/scenes');
  await page.getByRole('button', { name: /^(Crear Escena|Create Scene)$/i }).first().click();
  const sceneEditor = page.getByRole('dialog', { name: /^(Crear Escena|Create Scene)$/i });
  for (const name of ['Luz de sala', 'Interruptor de sala', 'Sensor de sala', 'Cortina de sala']) {
    await expect(sceneEditor.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(sceneEditor.getByText('Cámara de sala', { exact: true })).toHaveCount(0);
  await expect(sceneEditor.getByRole('button', { name: /Sensor de sala/i })).toHaveAttribute('aria-disabled', 'true');

  await page.goto('/routines/automations');
  await page.getByRole('button', { name: /^(Crear Regla|Create Rule)$/i }).first().click();
  const automationEditor = page.getByRole('dialog', { name: /^(Nueva Automatización|New Automation)$/i });
  await automationEditor.getByText(/^(Dispositivo de Origen|Source Device)$/i).locator('..').getByRole('button').click();
  const options = page.getByRole('listbox');
  for (const name of ['Luz de sala', 'Interruptor de sala', 'Sensor de sala', 'Cortina de sala']) {
    await expect(options.getByRole('option', { name })).toBeVisible();
  }
  await expect(options.getByRole('option', { name: 'Cámara de sala' })).toHaveCount(0);
});

test('Feature: momentary routine targets — a light-labeled HA action saves press for scenes and automations', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [
    { id: 'tv-action', homeId: 'responsive-home', roomId: null, name: 'On/Off tv', type: 'button', semanticType: 'light', status: 'ASSIGNED', capabilities: [{ type: 'button', name: 'Button', commands: [{ name: 'press' }] }] },
    { id: 'read-only', homeId: 'responsive-home', roomId: null, name: 'Read only', type: 'sensor', semanticType: 'light', status: 'ASSIGNED', capabilities: [{ type: 'sensor', name: 'Sensor' }] },
  ] }));
  let sceneCommand: string | undefined;
  let automationCommand: string | undefined;
  await page.route('**/api/v1/scenes', (route) => {
    if (route.request().method() === 'POST') {
      sceneCommand = (route.request().postDataJSON() as { actions: { command: string }[] }).actions[0]?.command;
      return route.fulfill({ status: 201, json: { id: 'tv-scene' } });
    }
    return route.fulfill({ json: [] });
  });
  await page.route('**/api/v1/automations', (route) => {
    if (route.request().method() === 'POST') {
      automationCommand = (route.request().postDataJSON() as { action: { command: string } }).action.command;
      return route.fulfill({ status: 201, json: { id: 'tv-automation' } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/routines/scenes');
  await page.getByRole('button', { name: /^(Crear Escena|Create Scene)$/i }).first().click();
  const sceneEditor = page.getByRole('dialog', { name: /^(Crear Escena|Create Scene)$/i });
  await sceneEditor.getByRole('textbox', { name: /Cena con invitados|Dinner Party/i }).fill('Escena TV');
  await expect(sceneEditor.getByRole('button', { name: /Read only/i })).toHaveAttribute('aria-disabled', 'true');
  await sceneEditor.getByRole('button', { name: /On\/off tv/i }).click();
  await expect(sceneEditor.getByText(/Acción momentánea|Momentary action/)).toBeVisible();
  await sceneEditor.getByRole('button', { name: /^(Guardar Escena|Save Scene)$/i }).click();
  await expect.poll(() => sceneCommand).toBe('press');

  await page.goto('/routines/automations');
  await page.getByRole('button', { name: /^(Crear Regla|Create Rule)$/i }).first().click();
  const automationEditor = page.getByRole('dialog', { name: /^(Nueva Automatización|New Automation)$/i });
  await automationEditor.getByRole('textbox', { name: /Asignar nombre|Naming this Automation/i }).fill('Auto TV');
  await automationEditor.getByRole('radiogroup', { name: /Disparador de Inteligencia|Intelligence Trigger/i }).getByRole('radio', { name: /^(Hora|Time)$/i }).click();
  await automationEditor.getByText(/^(Dispositivo Objetivo|Target Device)$/i).locator('..').getByRole('button').click();
  const targetOptions = page.getByRole('listbox');
  await expect(targetOptions.getByRole('option', { name: /Read only/i })).toHaveCount(0);
  await targetOptions.getByRole('option', { name: /On\/off tv/i }).click();
  await expect(automationEditor.getByRole('button', { name: /Pulsar una vez|Press once/i })).toBeVisible();
  await automationEditor.getByRole('button', { name: /^(Confirmar Automatización|Confirm Automation)$/i }).click();
  await expect.poll(() => automationCommand).toBe('press');
});

test('Feature: automation favorites — valid legacy IDs migrate once, merge with server data and never overwrite it with an empty local list', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('legacy-automation-favorites-seeded')) return;
    localStorage.setItem('hp_fav_automations', JSON.stringify(['automation-x', 'deleted-automation']));
    sessionStorage.setItem('legacy-automation-favorites-seeded', '1');
  });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
  await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/automations', (route) => route.fulfill({ json: favoriteAutomationRules }));
  let serverIds: string[] = [];
  let saves = 0;
  await page.route('**/api/v1/automations/favorites', async (route) => {
    if (route.request().method() === 'PUT') {
      serverIds = (route.request().postDataJSON() as { automationIds: string[] }).automationIds;
      saves += 1;
      return route.fulfill({ json: serverIds });
    }
    return route.fulfill({ json: { automationIds: serverIds, initialized: saves > 0 } });
  });

  await page.goto('/');
  await expect(page.locator('.homepilot-home-routines').getByRole('button', { name: /Luz nocturna/ })).toBeVisible();
  expect(serverIds).toEqual(['automation-x']);
  expect(await page.evaluate(() => localStorage.getItem('hp_fav_automations'))).toBeNull();
  await page.reload();
  expect(saves).toBe(1);

  await page.evaluate(() => localStorage.setItem('hp_fav_automations', JSON.stringify(['automation-y'])));
  await page.reload();
  await expect(page.locator('.homepilot-home-routines').getByRole('button', { name: /Luz matutina/ })).toBeVisible();
  expect(serverIds).toEqual(['automation-x', 'automation-y']);

  await page.evaluate(() => localStorage.setItem('hp_fav_automations', '[]'));
  await page.reload();
  expect(serverIds).toEqual(['automation-x', 'automation-y']);
  expect(saves).toBe(2);
  serverIds = [];
  await page.reload();
  await expect(page.locator('.homepilot-home-routines').getByRole('button', { name: /Luz nocturna|Luz matutina/ })).toHaveCount(0);
  expect(saves).toBe(2);
});

test('Feature: automation favorites — tablet and PC synchronize one user without leaking to another', async ({ browser }) => {
  const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const pcContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const gustavoContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const server = new Map<string, string[]>();
  const prepare = async (page: import('@playwright/test').Page, user: typeof dashboardUser) => {
    await prepareAuthenticatedDashboard(page, responsiveDashboard, user);
    await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: user.id, name: 'Casa' }] }));
    await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/automations', (route) => route.fulfill({ json: favoriteAutomationRules.slice(0, 1) }));
    await page.route('**/api/v1/automations/favorites', (route) => {
      if (route.request().method() === 'PUT') {
        const ids = (route.request().postDataJSON() as { automationIds: string[] }).automationIds;
        server.set(user.id, ids);
        return route.fulfill({ json: ids });
      }
      return route.fulfill({ json: { automationIds: server.get(user.id) ?? [], initialized: server.has(user.id) } });
    });
  };

  try {
    const tablet = await tabletContext.newPage();
    const pc = await pcContext.newPage();
    const gustavo = await gustavoContext.newPage();
    await prepare(tablet, dashboardUser);
    await prepare(pc, dashboardUser);
    await prepare(gustavo, { ...dashboardUser, id: 'gustavo', username: 'gustavo', displayName: 'Gustavo' });

    await tablet.goto('/routines/automations');
    await tablet.getByRole('button', { name: /Añadir a favoritas|Add to favorites/i }).click();
    await expect.poll(() => server.get(dashboardUser.id)).toEqual(['automation-x']);

    await pc.goto('/');
    await expect(pc.locator('.homepilot-home-routines').getByRole('button', { name: /Luz nocturna/ })).toBeVisible();
    await gustavo.goto('/');
    await expect(gustavo.locator('.homepilot-home-routines').getByRole('button', { name: /Luz nocturna/ })).toHaveCount(0);

    await pc.goto('/routines/automations');
    await pc.getByRole('button', { name: /Quitar de favoritas|Remove from favorites/i }).click();
    await expect.poll(() => server.get(dashboardUser.id)).toEqual([]);
    await tablet.reload();
    await expect(tablet.getByRole('button', { name: /Añadir a favoritas|Add to favorites/i })).toHaveCount(1);
  } finally {
    await tabletContext.close();
    await pcContext.close();
    await gustavoContext.close();
  }
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
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).click();
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

  test(`dashboard initial skeleton preserves card, section and canvas geometry on ${viewport.name}`, async ({ page }) => {
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

test('Feature: Device inspector — Scenario: Operator switches between device information, activity and state', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  const cover = { ...responsiveDevices.find((device) => device.id === 'cover-living'), externalId: 'ha:cover.living' };
  await page.route('**/api/v1/rooms', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'responsive-room', homeId: 'responsive-home', name: 'Sala' }]) });
  });
  await page.route('**/api/v1/devices/cover-living', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(cover) });
  });
  await page.route('**/api/v1/devices/cover-living/activity-logs', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{
      timestamp: '2026-01-01T12:00:00.000Z', deviceId: 'cover-living', type: 'state',
      description: 'Cortina actualizada', data: {},
    }]) });
  });

  await page.goto('/system/devices');
  await page.getByRole('article').filter({ hasText: 'Cortina de sala' }).getByRole('button', { name: /gestionar dispositivo|manage device/i }).click();
  const inspector = page.getByRole('dialog', { name: /inspector técnico|technical inspector/i });
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('ha:cover.living');
  await inspector.getByRole('radio', { name: /registros|logs/i }).click();
  await expect(inspector).toContainText('Cortina actualizada');
  await inspector.getByRole('radio', { name: /estado|state/i }).click();
  await expect(inspector.locator('pre')).toContainText('current_position');
});

test('Feature: Modular selectors — Scenario: The tablet device-function list stays searchable and scrollable above the keyboard', async ({ page }) => {
  await page.setViewportSize(viewports[1]);
  await page.addInitScript(() => {
    const visualViewport = new EventTarget() as VisualViewport;
    Object.defineProperties(visualViewport, {
      height: { configurable: true, value: 1024 },
      width: { configurable: true, value: 768 },
      offsetTop: { configurable: true, value: 0 },
      offsetLeft: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
  });
  await prepareAuthenticatedDashboard(page);
  const cover = { ...responsiveDevices.find((device) => device.id === 'cover-living'), externalId: 'ha:cover.living' };
  await page.route('**/api/v1/rooms', (route) => route.fulfill({ json: [{ id: 'responsive-room', homeId: 'responsive-home', name: 'Sala' }] }));
  await page.route('**/api/v1/devices/cover-living', (route) => route.fulfill({ json: cover }));
  await page.route('**/api/v1/devices/cover-living/activity-logs', (route) => route.fulfill({ json: [] }));

  await page.goto('/system/devices');
  await page.getByRole('article').filter({ hasText: 'Cortina de sala' }).getByRole('button', { name: /gestionar dispositivo|manage device/i }).click();
  const inspector = page.getByRole('dialog', { name: /inspector técnico|technical inspector/i });
  await inspector.getByRole('button', { name: /^(cortina|cover\/blind)$/i }).click();
  const popup = page.getByRole('dialog', { name: /seleccionar opción|select option/i });
  await expect(popup).toBeVisible();
  const search = popup.getByRole('searchbox');
  await search.focus();
  await expect(search).toBeFocused();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 420 });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });

  await expect.poll(() => popup.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(420);
  await expect.poll(() => inspector.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(420);
  const list = popup.getByRole('listbox');
  const lastOption = list.getByRole('option', { name: /desconocido|unknown/i });
  await lastOption.scrollIntoViewIfNeeded();
  const geometry = await popup.evaluate((element) => {
    const listbox = element.querySelector('[role="listbox"]');
    const last = listbox?.lastElementChild;
    return {
      scrollTop: listbox?.scrollTop ?? 0,
      lastBottom: last?.getBoundingClientRect().bottom ?? Infinity,
      listBottom: listbox?.getBoundingClientRect().bottom ?? 0,
    };
  });
  expect(geometry.scrollTop).toBeGreaterThan(0);
  expect(geometry.lastBottom).toBeLessThanOrEqual(geometry.listBottom + 1);
});

test('Feature: Modal visual viewport — Scenario: The tablet scene editor remains usable above the touch keyboard', async ({ page }) => {
  await page.setViewportSize(viewports[1]);
  await page.addInitScript(() => {
    const visualViewport = new EventTarget() as VisualViewport;
    Object.defineProperties(visualViewport, {
      height: { configurable: true, value: 1024 },
      width: { configurable: true, value: 768 },
      offsetTop: { configurable: true, value: 0 },
      offsetLeft: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
  });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
  await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [
    ...responsiveDevices,
    { id: 'modal-light', homeId: 'responsive-home', roomId: null, name: 'Luz de prueba', type: 'light', status: 'ASSIGNED' },
  ] }));

  await page.goto('/routines/scenes');
  await page.getByRole('button', { name: /^(Crear Escena|Create Scene)$/i }).first().click();
  const modal = page.getByRole('dialog', { name: /^(Crear Escena|Create Scene)$/i });
  const name = modal.getByRole('textbox', { name: /Cena con invitados|Dinner Party/i });
  const save = modal.getByRole('button', { name: /^(Guardar Escena|Save Scene)$/i });
  await expect(modal).toBeVisible();
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1024);

  await name.focus();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 420 });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });
  await expect.poll(() => modal.evaluate((element) => element.parentElement?.getBoundingClientRect().bottom ?? Infinity)).toBeLessThanOrEqual(420);
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(420);
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await expect(modal).toBeVisible();
  await name.fill('Escena de prueba');
  await expect.poll(() => modal.evaluate((element) => Array.from(element.querySelectorAll<HTMLElement>('*')).some((child) => (
    getComputedStyle(child).overflowY === 'auto' && child.scrollHeight > child.clientHeight + 1
  )))).toBe(true);

  const lastDevice = modal.getByRole('button', { name: /Luz de prueba/i });
  await lastDevice.scrollIntoViewIfNeeded();
  await expect.poll(() => lastDevice.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(420);
  await expect(lastDevice).toBeEnabled();
  await lastDevice.click();
  await expect(save).toBeEnabled();
  await expect.poll(() => save.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(420);

  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 1024 });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });
  await expect.poll(() => modal.evaluate((element) => element.parentElement?.getBoundingClientRect().bottom ?? Infinity)).toBe(1024);
  await expect(modal).toBeVisible();
  await expect(save).toBeEnabled();

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'width', { configurable: true, value: 1180 });
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 820 });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(820);
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 400 });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });
  await expect.poll(() => modal.evaluate((element) => element.parentElement?.getBoundingClientRect().bottom ?? Infinity)).toBeLessThanOrEqual(400);
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(400);
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await expect.poll(() => save.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(400);
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
        // No title widget: the edit-only add-title and add-section controls
        // must not create extra auto-fit tracks or squeeze these sections.
        // Fill the desktop profile's four slots so auto-fit view mode and
        // explicit-slot edit mode share the same section track width.
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

    const titlebar = page.locator('.homepilot-dashboard-titlebar');
    if (viewport.width < 640) {
      await titlebar.getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();
    } else {
      await titlebar.getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();
    }
    await expect(section('Tech').getByRole('button', { name: /Drag to reorder|Arrastrar para reordenar/i })).toBeVisible();
    await settleLayout();
    const edit = await Promise.all(['Tech', 'Patio'].map(geometry));

    await expect(page.getByRole('button', { name: /^(Add title|Añadir título)$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Add section|Añadir sección)$/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /^(Add title|Añadir título|Add section|Añadir sección)$/i })).toHaveCount(0);

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
      // The edit-only placeholder follows the real card grid, so the section
      // may grow, but existing cards retain their view-mode geometry.
      expect(after.sectionHeight).toBeGreaterThan(before.sectionHeight);
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
      if (after.addCardLeft === null || after.addCardRight === null || after.addCardTop === null || after.toolbarLeft === null) {
        throw new Error(`${viewport.name}: edit controls are missing`);
      }
      expect(after.addCardLeft).toBeGreaterThanOrEqual(after.sectionLeft);
      expect(after.addCardRight).toBeLessThanOrEqual(after.sectionRight);
      expect(after.addCardTop).toBeGreaterThanOrEqual(after.gridBottom);
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

  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();
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

  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();
  await sectionWithoutIcon.getByRole('button', { name: /^(Edit section|Editar sección)$/i }).click();
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

  await sectionWithoutIcon.getByRole('button', { name: /^(Edit section|Editar sección)$/i }).click();
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
      await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().tap();
      const section = page.locator('.homepilot-dashboard-widget').filter({ has: page.getByRole('heading', { name: 'Lecturas del hogar', exact: true }) });
      await section.getByRole('button', { name: /^(Edit section|Editar sección)$/i }).tap();
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
      const optionBounds = await option.boundingBox();
      expect(optionBounds).toBeTruthy();
      expect(optionBounds!.y + optionBounds!.height).toBeLessThanOrEqual(viewport.keyboardHeight);
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

test('Feature: Clock editing — Scenario: A fixed section clock can be moved, removed and added without an editor', async ({ page }) => {
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
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();

  const clock = page.locator('[data-dashboard-card-id="responsive-weather"]');
  const sensor = page.locator('[data-dashboard-card-id="responsive-sensor"]');
  const cardActions = /^(Card actions|Acciones de tarjeta)$/i;
  const edit = /^(Edit|Editar)$/i;
  await expect(clock.getByRole('button', { name: edit })).toHaveCount(0);
  await clock.hover();
  const clockActionsButton = clock.getByRole('button', { name: cardActions });
  await clockActionsButton.click();
  const clockMenu = page.getByRole('menu', { name: cardActions });
  await expect(clockMenu.getByRole('menuitem', { name: edit })).toHaveCount(0);
  await expect(clockMenu.getByRole('menuitem', { name: /^(Delete|Eliminar)$/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(clockMenu).not.toBeVisible();
  await expect(clockActionsButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('heading', { name: edit })).toHaveCount(0);

  await expect(sensor.getByRole('button', { name: edit })).toHaveCount(1);
  await sensor.hover();
  await sensor.getByRole('button', { name: cardActions }).click();
  await page.getByRole('menu', { name: cardActions }).getByRole('menuitem', { name: edit }).click();
  await expect(page.getByRole('heading', { name: edit })).toBeVisible();
  await page.getByRole('button', { name: /^(Close|Cerrar)$/i }).click();

  await clock.dragTo(sensor, { steps: 10 });
  await expect.poll(() => {
    const savedSection = savedDashboard.tabs[0]?.widgets.find((widget) => widget.id === 'responsive-section');
    if (!savedSection || !('extra' in savedSection.config)) return [];
    return savedSection.config.extra.cards.map((card) => card.id);
  }).toEqual(['responsive-sensor', 'responsive-weather']);

  await clock.hover();
  await clock.getByRole('button', { name: cardActions }).click();
  await page.getByRole('menu', { name: cardActions }).getByRole('menuitem', { name: /^(Delete|Eliminar)$/i }).click();
  await expect(clock).toHaveCount(0);

  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  const cardCatalog = page.locator('.max-h-section-modal').filter({
    has: page.getByRole('heading', { name: /^(Add card to section|Añadir tarjeta a la sección)$/i }),
  });
  await cardCatalog.getByRole('button', { name: /^(Clock|Reloj)$/i })
    .and(cardCatalog.locator('.max-h-section-editor > div > div > button[type="button"]'))
    .click();
  await expect(page.getByRole('heading', { name: /^(Add card to section|Añadir tarjeta a la sección)$/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: edit })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /^(Name|Nombre)$/i })).toHaveCount(0);
  await expect(page.locator('[data-homepilot-clock]')).toHaveCount(1);
});

test('Feature: Clock editing — Scenario: A standalone clock has no Configure action but retains layout controls', async ({ page }) => {
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
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();

  const clock = page.locator('.homepilot-dashboard-widget').filter({ has: page.locator('[data-homepilot-clock]') });
  await expect(clock).toHaveCount(1);
  await expect(clock.getByRole('button', { name: /^(Configure|Configurar)$/i })).toHaveCount(0);
  await expect(clock.getByRole('button', { name: /^(Drag to reorder|Arrastrar para reordenar)$/i })).toBeVisible();
  await expect(clock.getByRole('button', { name: /^(Delete|Eliminar)$/i })).toBeVisible();
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
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();
  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  await page.getByRole('button', { name: /^(Reproductor|Media player)$/i }).click();

  const editorHeading = page.getByRole('heading', { name: /^(Edit|Editar)$/i });
  await expect(editorHeading).toBeVisible();
  const editor = editorHeading.locator('..').locator('..').locator('..');
  const editorPreview = editor.locator('.custom-scrollbar > .grid');
  await expect(editor.getByRole('button', { name: /^(Premium)$/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(editorPreview.locator('[data-media-player="homepilot-premium"]')).toBeVisible();
  await expect(editor.getByText(/^(Card width|Ancho de tarjeta)$/i)).toHaveCount(0);
  await page.getByRole('button', { name: /^(Save|Guardar)$/i }).click();

  const mediaCard = page.locator('[class*="group/card"]').filter({ hasText: /Reproductor|Media player/i });
  await expect(mediaCard.locator('[data-media-player="homepilot-premium"]')).toBeVisible();
  await expect(mediaCard).toHaveClass(/col-span-full/);
  await expect(mediaCard.getByRole('slider', { name: /resize card|redimensionar tarjeta/i })).toHaveCount(0);
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

  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();
  await card.hover();
  const cardActions = /^(Card actions|Acciones de tarjeta)$/i;
  await card.getByRole('button', { name: cardActions }).click();
  await page.getByRole('menu', { name: cardActions }).getByRole('menuitem', { name: /^(Edit|Editar)$/i }).click();
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

test('Feature: Media player idle — Scenario: A player reports no playback without stale metadata or changing its controls', async ({ page }) => {
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
          extra: { cards: [{ id: 'media-idle', kind: 'media', title: 'Sala', entityId: 'player-1', span: 'full' }] },
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
        : { state: 'playing', attributes: { media_title: 'Canción actual', media_artist: 'Artista actual', volume_level: 0.4 } },
    }]) });
  });

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
  const idleHeight = await card.evaluate((element) => element.getBoundingClientRect().height);
  const idleControls = await card.locator('button').count();

  mediaState = 'playing';
  await page.reload();
  await expect(card.getByText('Canción actual')).toBeVisible();
  await expect(card.getByText('Artista actual')).toBeVisible();
  await expect(card.getByText(/^(Sin reproducción|Nothing playing)$/)).toHaveCount(0);
  expect(await card.locator('button').count()).toBe(idleControls);
  expect(Math.abs((await card.evaluate((element) => element.getBoundingClientRect().height)) - idleHeight)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1441);

  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();
  await expect(card.locator('[data-media-player] > div').first().locator('p').first().locator('..').locator('svg')).toHaveCount(0);
  await card.hover();
  const cardActions = card.getByRole('button', { name: /^(Card actions|Acciones de tarjeta)$/i });
  await cardActions.click();
  await expect(page.getByRole('menu', { name: /^(Card actions|Acciones de tarjeta)$/i })).toBeVisible();
});

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
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();
  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  const catalogButton = page.getByRole('button', { name: /^(Button|Botón)$/i });
  const catalogCard = catalogButton.locator('..');
  const catalogSpacing = await catalogCard.evaluate((element) => {
    const lastLabel = element.querySelector(':scope > div:nth-child(2) > span:last-child');
    return lastLabel ? element.getBoundingClientRect().bottom - lastLabel.getBoundingClientRect().bottom : Number.POSITIVE_INFINITY;
  });
  expect(catalogSpacing).toBeLessThanOrEqual(24);
  await catalogButton.click();

  const editor = page.locator('[class*="max-w-xl"]').filter({ has: page.getByRole('heading', { name: /^(Edit|Editar)$/i }) });
  const preview = editor.locator('[class*="h-device-card-compact"]').first();
  await expect(preview).toBeVisible();
  await expect(preview).not.toHaveClass(/homepilot-section-light-tile-active/);
  await expect(preview.getByText(/^(Button|Botón)$/i)).toBeVisible();
  await expect(editor.getByText(/^(Small · 4 per row|Pequeña · 4 por fila)$/i)).toBeVisible();
  const previewBox = await preview.boundingBox();
  expect(previewBox?.height).toBeLessThanOrEqual(98);
  expect(await preview.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);

  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  const buttonCard = page.locator('[data-card-id]').filter({ hasText: /^(Button|Botón)$/i }).last();
  await expect(buttonCard).toHaveClass(/col-span-1/);
  await expect.poll(() => JSON.stringify(savedDashboard)).toMatch(/"kind":"light"[^}]*"span":"small"/);
});

test('Feature: Dashboard import — Scenario: Pending bindings and local backgrounds are reported without exposing source IDs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/dashboards/import', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ...responsiveDashboard,
        id: 'imported-dashboard',
        title: 'Importado',
        tabs: [{ ...responsiveDashboard.tabs[0], id: 'imported-tab' }],
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
    buffer: Buffer.from(JSON.stringify({ format: 'homepilot-dashboard', version: 1, dashboard: { title: 'Importado', tabs: [] } })),
  });

  await expect(page.getByText(/Tablero importado con asignaciones pendientes|Dashboard imported with pending assignments/i)).toBeVisible();
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
    const more = titlebar.locator('details > summary');
    await expect(titlebar.getByRole('button', { name: /new panel|nuevo panel|delete panel|eliminar panel/i })).toHaveCount(0);
    if (viewport.width >= 1280) {
      await expect(more).toBeHidden();
      await expect(titlebar.getByRole('button', { name: /dashboard history|historial del tablero/i })).toBeVisible();
      await expect(titlebar.getByRole('button', { name: /export dashboard|exportar tablero/i })).toBeVisible();
      await expect(titlebar.getByRole('button', { name: /import dashboard|importar tablero/i })).toBeVisible();
    } else {
      await expect(more).toBeVisible();
      await more.click();
      await expect(titlebar.getByRole('menuitem', { name: /dashboard history|historial del tablero/i })).toBeVisible();
      await expect(titlebar.getByRole('menuitem', { name: /export dashboard|exportar tablero/i })).toBeVisible();
      await expect(titlebar.getByRole('menuitem', { name: /import dashboard|importar tablero/i })).toBeVisible();
      await expect(titlebar.getByRole('button', { name: /dashboard history|historial del tablero/i })).toHaveCount(0);
      await expect(titlebar.getByRole('menuitem', { name: /^(Edit|Editar)$/i })).toHaveCount(0);
      await expect(titlebar.getByRole('menuitem', { name: /new panel|nuevo panel/i })).toHaveCount(0);
      await expect(titlebar.getByRole('button', { name: /new panel|nuevo panel/i })).toHaveCount(0);
    }

    await expect(titlebar.getByRole('button', { name: /^(Edit|Editar)$/i }).last()).toBeVisible();
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
      await titlebar.getByRole('button', { name: /^(Rename|Renombrar)$/i }).click();
      await expect(titlebar.getByRole('textbox', { name: /^(Rename|Renombrar)$/i })).toBeVisible();
      await expect(more).toHaveCount(0);
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
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();
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
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();
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
  await page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i }).last().click();

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

test('Feature: Native camera setup — Scenario: An owner opens discovery and manual configuration', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'test-home', name: 'Test home' }]) });
  });
  await page.route('**/api/v1/native-cameras?*', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ cameras: [] }) });
  });
  await page.route('**/api/v1/native-cameras/discover', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ devices: [] }) });
  });
  await page.goto('/system/cameras');
  await page.getByRole('button', { name: /Add camera|Añadir cámara/i }).first().click();
  await expect(page.getByText(/Configure ONVIF device manually|Configurar dispositivo ONVIF manualmente/i)).toBeVisible();
  await page.getByRole('button', { name: /^(Continue|Continuar)$/i }).click();
  await expect(page.getByText(/Add IP Camera|Añadir cámara IP/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Camera name|Nombre de la cámara/i })).toBeVisible();
});

test('Las cámaras cargan el primer fotograma y conservan la tarjeta de imagen del Dashboard', async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await prepareAuthenticatedDashboard(page);
  const camera = {
    id: 'camera-patio', homeId: 'responsive-home', roomId: 'responsive-room',
    name: 'Cámara patio', type: 'camera', semanticType: 'camera',
    integrationSource: 'native-camera', status: 'ASSIGNED', lastKnownState: null,
  };
  const dashboard = {
    id: 'responsive-dashboard', ownerId: dashboardUser.id, title: 'Hogar de prueba',
    visibility: { roles: [], users: [], homes: [] },
    tabs: [{
      id: 'responsive-tab', title: 'Principal', isDefault: true,
      widgets: [
        {
          id: 'camera-section', type: 'section',
          config: {
            layout: { x: 0, y: 0, w: 3, h: 4, span: 3 },
            binding: { entityId: 'camera-section', entityType: 'system', entityName: 'Cámaras' },
            visibility: { rules: [], defaultState: 'show' },
            appearance: { title: 'Cámaras', showTitle: true },
            extra: { cards: [{ id: 'camera-card', kind: 'camera', title: 'Cámara patio', entityId: camera.id, span: 'full', icon: 'Camera' }] },
          },
        },
        {
          id: 'camera-widget', type: 'device_control',
          config: {
            layout: { x: 0, y: 4, w: 3, h: 4, span: 3 },
            binding: { entityId: camera.id, entityType: 'device', entityName: camera.name },
            visibility: { rules: [], defaultState: 'show' },
            appearance: { title: camera.name },
          },
        },
      ],
    }],
  };
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([camera]) });
  });
  await page.route('**/api/v1/rooms', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'responsive-room', homeId: camera.homeId, name: 'Patio' }]) });
  });
  await page.route('**/api/v1/dashboards', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([dashboard]) });
  });
  await page.route('**/api/v1/devices/camera-patio/camera/session*', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ snapshotPath: '/camera-preview.png', streamPath: '/camera-stream' }) });
  });
  await page.route('**/camera-preview.png*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64') });
  });

  await page.goto('/system/devices');
  const managedCamera = page.getByRole('article').filter({ hasText: camera.name });
  await expect(managedCamera.getByRole('status')).toBeVisible();
  await expect(managedCamera.getByRole('status')).toHaveCount(0);
  await expect(managedCamera.getByRole('button', { name: /pantalla completa|full screen/i })).toBeVisible();
  await expect(managedCamera).not.toContainText(/Imagen actualizada|Image updated/i);
  const imageBox = await managedCamera.locator('img').first().boundingBox();
  const cardBox = await managedCamera.getByRole('button', { name: /pantalla completa|full screen/i }).boundingBox();
  const titleBox = await managedCamera.getByText(camera.name).first().boundingBox();
  expect(imageBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(cardBox!.height).toBeGreaterThanOrEqual(imageBox!.height - 1);
  expect(titleBox!.y).toBeGreaterThan(imageBox!.y);
  expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(imageBox!.y + imageBox!.height + 1);
  await managedCamera.getByRole('button', { name: /pantalla completa|full screen/i }).click();
  const desktopViewer = page.getByRole('dialog');
  await expect(desktopViewer.getByText(/En vivo|Live/i)).toBeVisible();
  const desktopViewerBox = await desktopViewer.boundingBox();
  const desktopFeedBox = await desktopViewer.locator('img[alt*="Cámara patio"]').first().boundingBox();
  expect(desktopViewerBox).not.toBeNull();
  expect(desktopFeedBox).not.toBeNull();
  expect(desktopFeedBox!.width).toBeGreaterThanOrEqual(desktopViewerBox!.width - 2);
  expect(desktopFeedBox!.height).toBeGreaterThanOrEqual(desktopViewerBox!.height - 2);
  expect(desktopViewerBox!.width / desktopViewerBox!.height).toBeCloseTo(1, 1);
  expect(await desktopViewer.locator('img[alt*="Cámara patio"]').first().evaluate((image) => getComputedStyle(image).objectFit)).toBe('contain');
  await page.keyboard.press('Escape');
  await expect(desktopViewer).toHaveCount(0);

  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await expect(page.getByRole('button', { name: /pantalla completa|full screen/i })).toHaveCount(2);
  await expect(page.getByText(/Imagen actualizada|Image updated/i)).toHaveCount(0);
  const dashboardFrames = page.locator('img[alt*="Cámara patio"]');
  await expect(dashboardFrames).toHaveCount(2);
  for (const frame of await dashboardFrames.all()) {
    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(353);
    const parentCard = frame.locator('xpath=ancestor::*[@role="button"][1]');
    await expect(parentCard.getByText(camera.name)).toBeVisible();
  }
  await page.setViewportSize(viewports[0]);
  await page.reload();
  await expect(page.getByRole('button', { name: /pantalla completa|full screen/i })).toHaveCount(2);
  await page.getByRole('button', { name: /pantalla completa|full screen/i }).first().click();
  const mobileViewer = page.getByRole('dialog');
  await expect(mobileViewer.getByText(/En vivo|Live/i)).toBeVisible();
  const mobileViewerBox = await mobileViewer.boundingBox();
  const mobileFeedBox = await mobileViewer.locator('img[alt*="Cámara patio"]').first().boundingBox();
  expect(mobileViewerBox).not.toBeNull();
  expect(mobileFeedBox).not.toBeNull();
  expect(mobileFeedBox!.width).toBeGreaterThanOrEqual(mobileViewerBox!.width - 2);
  expect(mobileFeedBox!.height).toBeGreaterThanOrEqual(mobileViewerBox!.height - 2);
  expect(mobileViewerBox!.width / mobileViewerBox!.height).toBeCloseTo(1, 1);
  await mobileViewer.getByRole('button', { name: /cerrar|close/i }).click();
  await expect(mobileViewer).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewports[0].width + 1);
});

for (const viewport of viewports) {
  test(`keeps the login shell responsive on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareLoginShell(page);

    await page.goto('/');
    await expect(page.locator('input')).toHaveCount(2);

    const layout = await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('400 16px Rubik'),
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
    expect(layout.bodyFont).toContain('Rubik');
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

    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page.locator('[role="alert"]')).toContainText(/./);
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
    await expect(page.locator('.min-h-clock-card').first()).toBeVisible();

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
    expect(lightBackdropOverlay).not.toBe('none');
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
    if (viewport.width < 1280) {
      await titlebar.locator('details > summary').click();
      await titlebar.getByRole('menuitem', { name: /dashboard history|historial del tablero/i }).click();
    } else {
      await titlebar.getByRole('button', { name: /dashboard history|historial del tablero/i }).click();
    }

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

test('Feature: Automation lifecycle — Scenario: Given a new time automation When the default schedule is submitted Then it sends the complete local schedule', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);

  let submittedPayload: unknown;
  await page.route('**/api/v1/automations', async (route) => {
    if (route.request().method() === 'POST') {
      submittedPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'time-rule', ...(submittedPayload as object) }),
      });
      return;
    }

    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'light-1', name: 'Living Room Light', type: 'light', status: 'ASSIGNED' }]),
    });
  });
  await page.route('**/api/v1/scenes', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });

  await page.goto('/routines/automations');
  const createRule = page.getByRole('button', { name: /create rule|crear regla/i });
  await createRule.first().click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/naming this automation|nombrar esta automatizaci[oó]n/i).fill('Daily light');
  await dialog.getByRole('radio', { name: /time|hora/i }).click();

  const deviceSelector = dialog.getByRole('button', { name: /select device|seleccionar dispositivo/i });
  await deviceSelector.click();
  await page.getByRole('option', { name: 'Living Room Light' }).click();
  await dialog.getByRole('button', { name: /confirm automation|confirmar automatizaci[oó]n/i }).click();

  await expect.poll(() => submittedPayload).toBeDefined();
  expect(submittedPayload).toMatchObject({
    name: 'Daily light',
    trigger: {
      type: 'time',
      timeLocal: '12:00',
      days: [0, 1, 2, 3, 4, 5, 6],
    },
    action: { type: 'device_command', targetDeviceId: 'light-1', command: 'turn_on' },
  });
  expect((submittedPayload as { trigger: { timezone: string } }).trigger.timezone).toMatch(/.+/);
});

test('Feature: Home Assistant discovery — Scenario: Given more than one discovery batch When the inbox opens discovery Then it requests a summary and progressively renders candidates', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  const candidates = Array.from({ length: 49 }, (_, index) => ({
    entityId: `light.discovery_${index + 1}`,
    friendlyName: `Discovery light ${index + 1}`,
    domain: 'light',
    profile: { displayName: 'Light', category: 'lighting', supportedCommandCount: 2 },
  }));
  let discoveryRequestUrl = '';

  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/v1/homes', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/v1/rooms', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/v1/ha/entities?mode=all&view=summary', async (route) => {
    discoveryRequestUrl = route.request().url();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(candidates) });
  });

  await page.goto('/system/inbox');
  await page.getByRole('button', { name: /discover entities|descubrir entidades/i }).click();

  const discovery = page.locator('section[aria-labelledby="ha-discovery-title"]');
  await expect(discovery.locator('article')).toHaveCount(48);
  expect(discoveryRequestUrl).toContain('mode=all');
  expect(discoveryRequestUrl).toContain('view=summary');
  await expect(discovery).not.toContainText('attributes');

  await discovery.getByRole('button', { name: /show 1 more|mostrar 1 más/i }).click();
  await expect(discovery.locator('article')).toHaveCount(49);
});
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
  await expect(page.getByRole('button', { name: /dashboard history|historial del tablero/i })).toBeVisible();

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
test('Feature: Home conversation entry — Scenario: Given an empty conversation When an operator chooses a suggested request Then the same conversation flow sends it and replaces the welcome state', async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await prepareAuthenticatedDashboard(page);

  let conversationCalls = 0;
  let speechCalls = 0;
  await page.route('**/api/v1/assistant/tts', async (route) => {
    speechCalls += 1;
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/v1/assistant/converse', async (route) => {
    conversationCalls += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'answer', message: 'No hay luces encendidas en este momento.' }),
    });
  });

  await page.goto('/home-conversation');

  const emptyState = page.locator('.home-conversation-empty-state');
  const suggestions = page.locator('.home-conversation-suggestion');
  await expect(emptyState).toBeVisible();
  await expect(page.getByRole('heading', { name: /qué quieres hacer en casa|what would you like to do at home/i })).toBeVisible();
  await expect(suggestions).toHaveCount(3);

  const speechToggle = page.getByRole('button', { name: /lectura de respuestas activada|response reading enabled/i });
  await expect(speechToggle).toBeVisible();

  await suggestions.first().click();

  await expect.poll(() => conversationCalls).toBe(1);
  await expect.poll(() => speechCalls).toBe(1);
  await expect(page.getByText(/no hay luces encendidas/i)).toBeVisible();

  await speechToggle.click();
  await expect(page.getByRole('button', { name: /activar lectura de respuestas|enable response reading/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /activar lectura de respuestas|enable response reading/i })).toBeVisible();
  await expect(emptyState).toBeHidden();
  await expect(page.getByTestId('home-conversation-composer')).toBeVisible();
});

test('Feature: Conversation restoration — Scenario: Given a long saved conversation When the operator returns to the chat Then the newest turn and new-conversation control are immediately reachable', async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  const messages = Array.from({ length: 28 }, (_, index) => ({
    id: `saved-message-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `Mensaje guardado ${index + 1}: estado operativo de la casa.`,
    timestamp: `2026-08-21T12:${String(index).padStart(2, '0')}:00.000Z`,
  }));
  await page.addInitScript((savedMessages) => {
    sessionStorage.setItem('hp_home_conversation_v1:responsive-admin', JSON.stringify(savedMessages));
  }, messages);
  await prepareAuthenticatedDashboard(page);

  await page.goto('/home-conversation');

  const feed = page.locator('.home-conversation-feed');
  await expect(page.locator('.home-conversation-message')).toHaveCount(messages.length);
  await expect(page.getByRole('button', { name: /nueva conversación|new conversation/i })).toBeVisible();
  const scrollPosition = await feed.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop);
  expect(scrollPosition).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: /nueva conversación|new conversation/i }).click();
  await expect(page.locator('.home-conversation-empty-state')).toBeVisible();
});
test('Feature: Conversational confirmation — Scenario: Given a protected action When confirmation is required Then the resident can answer naturally without accept or reject buttons', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('hp_home_conversation_v1:responsive-admin', JSON.stringify([{
      id: 'confirmation-message',
      role: 'assistant',
      content: 'Encontré 2 luces encendidas. ¿Confirmas que quieres apagarlas?',
      timestamp: '2026-08-21T12:00:00.000Z',
      responseType: 'clarification',
      options: [
        { id: 'confirm', label: 'Sí, adelante' },
        { id: 'cancel', label: 'No, cancelar' },
      ],
    }]));
  });
  await prepareAuthenticatedDashboard(page);

  await page.goto('/home-conversation');

  await expect(page.getByText(/responde sí para continuar o no para cancelar|reply yes to continue or no to cancel/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sí, adelante' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'No, cancelar' })).toHaveCount(0);
});
for (const viewport of [viewports[0], viewports[2]]) {
  test(`Feature: Home conversation entry — Scenario: Given the ${viewport.name} layout When the welcome suggestions render Then they fit the viewport without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.goto('/home-conversation');

    const suggestionsContainer = page.locator('.home-conversation-suggestions');
    const suggestions = page.locator('.home-conversation-suggestion');
    await expect(suggestionsContainer).toBeVisible();
    await expect(suggestions).toHaveCount(3);

    const layout = await page.evaluate(() => ({
      direction: getComputedStyle(document.querySelector('.home-conversation-suggestions')!).flexDirection,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(layout.direction).toBe(viewport.name === 'mobile' ? 'column' : 'row');
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  });
}
for (const viewport of viewports) {
  test(`Feature: Home conversation composer — Scenario: Given the ${viewport.name} shell When an operator focuses and writes a command Then the composer remains visible, reachable, and free of horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);

    await page.goto('/home-conversation');

    const composer = page.getByTestId('home-conversation-composer');
    const input = page.getByRole('textbox', { name: /dime algo|tell me something/i });
    const send = page.getByRole('button', { name: /enviar|send/i });

    await expect(composer).toBeVisible();
    await expect(input).toBeVisible();
    await input.focus();
    await expect(input).toBeFocused();
    await input.fill('Enciende la luz de la sala');
    await expect(send).toBeEnabled();

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);

    const composerBox = await composer.boundingBox();
    expect(composerBox).not.toBeNull();
    expect((composerBox?.y ?? 0) + (composerBox?.height ?? 0)).toBeLessThanOrEqual(viewport.height + 1);
  });
}
test('Feature: Home conversation composer — Scenario: Given a mobile virtual keyboard When the visual viewport shrinks Then the composer remains available above the keyboard', async ({ page }) => {
  await page.setViewportSize(viewports[0]);
  await page.addInitScript(() => {
    const visualViewport = new EventTarget() as VisualViewport;
    Object.defineProperties(visualViewport, {
      height: { configurable: true, value: 410 },
      offsetTop: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
  });
  await prepareAuthenticatedDashboard(page);

  await page.goto('/home-conversation');

  await page.evaluate(() => window.visualViewport?.dispatchEvent(new Event('resize')));

  const composer = page.getByTestId('home-conversation-composer');
  const conversation = page.locator('section.flex.h-full.w-full');
  const input = page.getByRole('textbox', { name: /dime algo|tell me something/i });

  await expect(composer).toBeVisible();
  await expect(conversation).toHaveAttribute('style', /height: calc\(100% - 310px\)/);
  await input.focus();
  await expect(input).toBeFocused();

  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
});
test('Feature: Manual voice capture — Scenario: Given an accepted recording When it is stopped Then HomePilot transcribes and submits it exactly once', async ({ page }) => {
  await page.addInitScript(() => {
    const track = {
      stop: () => undefined,
      addEventListener: () => undefined,
    };
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
        enumerateDevices: async () => [{ deviceId: 'microphone-1', kind: 'audioinput', label: 'Test microphone' }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: () => new Promise<void>(() => undefined),
      },
    });

    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(...args: unknown[]) { void args; }

      start() {
        this.state = 'recording';
      }

      stop() {
        if (this.state !== 'recording') return;
        this.state = 'inactive';
        window.setTimeout(() => {
          this.ondataavailable?.({ data: new Blob(['accepted voice capture'], { type: this.mimeType }) });
          this.onstop?.();
        }, 0);
      }
    }

    class FakeAudioContext {
      createAnalyser() {
        return {
          fftSize: 0,
          getByteTimeDomainData: (samples: Uint8Array) => samples.fill(140),
        };
      }

      createMediaStreamSource() {
        return { connect: () => undefined };
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder });
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
  });
  await prepareAuthenticatedDashboard(page);

  let transcriptionCalls = 0;
  let conversationCalls = 0;
  await page.route('**/api/v1/assistant/stt', async (route) => {
    transcriptionCalls += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'whisper-local', transcript: 'apaga la luz de la sala' }),
    });
  });
  await page.route('**/api/v1/assistant/converse', async (route) => {
    conversationCalls += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'answer', message: 'Apagué la luz de la sala.' }),
    });
  });
  await page.route('**/api/v1/assistant/tts', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/home-conversation');
  const microphone = page.getByRole('button', { name: /talk to nezu|hablar con nezu/i });
  await expect(microphone).toBeVisible();
  await microphone.click();
  const stopRecording = page.getByRole('button', { name: /recording|grabando/i });
  await expect(stopRecording).toBeVisible();
  await stopRecording.click();

  await expect.poll(() => transcriptionCalls).toBe(1);
  await expect.poll(() => conversationCalls).toBe(1);
  await expect(page.getByText('Apagué la luz de la sala.')).toBeVisible();
  expect(transcriptionCalls).toBe(1);
  expect(conversationCalls).toBe(1);
});

test('Feature: Global wake activation — Scenario: Given one accepted Ok Nezu capture When it contains a command Then HomePilot transcribes, acknowledges, and submits it exactly once', async ({ page }) => {
  await page.addInitScript(() => {
    const track = {
      stop: () => undefined,
      addEventListener: () => undefined,
    };
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    };
    let recorderStarts = 0;
    let analyserFrames = 0;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
        enumerateDevices: async () => [{ deviceId: 'microphone-1', kind: 'audioinput', label: 'Test microphone' }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });

    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(...args: unknown[]) { void args; }

      start() {
        this.state = 'recording';
        recorderStarts += 1;
        if (recorderStarts === 1) {
          window.setTimeout(() => this.stop(), 1000);
        }
      }

      stop() {
        if (this.state !== 'recording') return;
        this.state = 'inactive';
        window.setTimeout(() => {
          this.ondataavailable?.({ data: new Blob(['accepted wake capture'], { type: this.mimeType }) });
          this.onstop?.();
        }, 0);
      }
    }

    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};

      createAnalyser() {
        return {
          fftSize: 0,
          getByteTimeDomainData: (samples: Uint8Array) => {
            samples.fill(analyserFrames++ < 20 ? 128 : 160);
          },
        };
      }

      createMediaStreamSource() {
        return { connect: () => undefined };
      }

      createGain() {
        const root = document.documentElement;
        root.dataset.wakeAcknowledgements = String(Number(root.dataset.wakeAcknowledgements || '0') + 1);
        return {
          gain: {
            setValueAtTime: () => undefined,
            exponentialRampToValueAtTime: () => undefined,
          },
          connect: () => undefined,
        };
      }

      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime: () => undefined },
          connect: () => undefined,
          start: () => undefined,
          stop: () => undefined,
        };
      }

      resume() {
        return Promise.resolve();
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder });
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
  });
  await prepareAuthenticatedDashboard(page);

  let transcriptionCalls = 0;
  let conversationCalls = 0;
  await page.route('**/api/v1/assistant/stt', async (route) => {
    transcriptionCalls += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'whisper-local', transcript: 'Ok Nezu apaga la luz de la sala' }),
    });
  });
  await page.route('**/api/v1/assistant/converse', async (route) => {
    conversationCalls += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'answer', message: 'Apagué la luz de la sala.' }),
    });
  });
  await page.route('**/api/v1/assistant/tts', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');
  await expect.poll(() => transcriptionCalls).toBe(1);
  await expect.poll(() => conversationCalls).toBe(1);
  await expect.poll(() => page.locator('html').getAttribute('data-wake-acknowledgements')).toBe('1');
  expect(transcriptionCalls).toBe(1);
  expect(conversationCalls).toBe(1);
});
test('Feature: Voice confirmation follow-up — Scenario: Given a pending confirmation When the spoken prompt ends Then HomePilot captures one direct yes or no without a wake phrase', async ({ page }) => {
  await page.addInitScript(() => {
    const track = { stop: () => undefined, addEventListener: () => undefined };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    let recorderStarts = 0;
    let confirmationReplyCaptureRequested = false;
    window.addEventListener('homepilot:confirmation-listen', () => { confirmationReplyCaptureRequested = true; });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
        enumerateDevices: async () => [{ deviceId: 'microphone-1', kind: 'audioinput', label: 'Test microphone' }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });

    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(...args: unknown[]) { void args; }

      start() {
        this.state = 'recording';
        recorderStarts += 1;
        document.documentElement.dataset.confirmationRecorderStarts = String(recorderStarts);
        if (confirmationReplyCaptureRequested) window.setTimeout(() => this.stop(), 1000);
      }

      stop() {
        if (this.state !== 'recording') return;
        this.state = 'inactive';
        window.setTimeout(() => {
          this.ondataavailable?.({ data: new Blob(['direct confirmation reply'], { type: this.mimeType }) });
          this.onstop?.();
        }, 0);
      }
    }

    class FakeAudioContext {
      createAnalyser() {
        return { fftSize: 0, getByteTimeDomainData: (samples: Uint8Array) => samples.fill(160) };
      }
      createMediaStreamSource() { return { connect: () => undefined }; }
      close() { return Promise.resolve(); }
    }

    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder });
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
  });
  await prepareAuthenticatedDashboard(page);

  let transcriptionCalls = 0;
  let confirmationCalls = 0;
  await page.route('**/api/v1/assistant/stt', async (route) => {
    transcriptionCalls += 1;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ provider: 'whisper-local', transcript: 'sí' }) });
  });
  await page.route('**/api/v1/assistant/converse', async (route) => {
    confirmationCalls += 1;
    const body = route.request().postDataJSON() as { prompt?: string; interactionMode?: string };
    expect(body).toEqual(expect.objectContaining({ prompt: 'sí', interactionMode: 'voice' }));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'execution', message: 'Acción completada.' }) });
  });

  await page.goto('/home-conversation');
  await expect.poll(async () => Number(await page.locator('html').getAttribute('data-confirmation-recorder-starts')) >= 1).toBeTruthy();
  await page.evaluate(() => window.dispatchEvent(new Event('homepilot:confirmation-listen')));

  await expect.poll(() => transcriptionCalls).toBe(1);
  await expect.poll(() => confirmationCalls).toBe(1);
  await expect(page.getByText('Acción completada.')).toBeVisible();
  expect(transcriptionCalls).toBe(1);
  expect(confirmationCalls).toBe(1);
});
test('Feature: Home conversation trust — Scenario: Given an empty session When the welcome state appears Then the operator sees concise contextual suggestions and a protected action cue', async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await prepareAuthenticatedDashboard(page);
  await page.goto('/home-conversation');

  await expect(page.getByRole('heading', { name: /qué quieres hacer en casa|what would you like to do at home/i })).toBeVisible();
  await expect(page.locator('.home-conversation-suggestion')).toHaveCount(3);
  await expect(page.locator('.home-conversation-suggestion--protected')).toHaveCount(1);
  await expect(page.getByText(/acciones protegidas|protected actions/i)).toHaveCount(0);
});

test('Feature: Home conversation continuity — Scenario: Given a local transcript When the page reloads Then the resident sees context and can deliberately start over', async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await prepareAuthenticatedDashboard(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('hp_home_conversation_v1:responsive-admin', JSON.stringify([
      {
        id: 'persisted-user-message',
        role: 'user',
        content: '¿Qué luces están encendidas?',
        timestamp: '2026-08-21T12:00:00.000Z'
      },
      {
        id: 'persisted-assistant-message',
        role: 'assistant',
        content: 'No hay luces encendidas.',
        responseType: 'answer',
        timestamp: '2026-08-21T12:00:01.000Z'
      }
    ]));
  });
  await page.goto('/home-conversation');

  await expect(page.getByText(/conversación activa|conversation active/i)).toBeVisible();
  await expect(page.getByText(/no hay luces encendidas/i)).toBeVisible();
  await page.getByRole('button', { name: /nueva conversación|new conversation/i }).click();
  await expect(page.locator('.home-conversation-empty-state')).toBeVisible();
});

test('Espacios y Rutinas comparten la topología sin repetir sus lecturas al navegar', async ({ page }) => {
  await page.setViewportSize(viewports[2]);
  await prepareAuthenticatedDashboard(page);
  const counts = { homes: 0, rooms: 0, devices: 0, homeRooms: 0 };
  const home = { id: 'responsive-home', name: 'Casa de prueba', ownerId: dashboardUser.id };
  const room = { id: 'responsive-room', homeId: home.id, name: 'Sala de prueba' };
  await page.route('**/api/v1/homes', async route => {
    counts.homes += 1;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([home]) });
  });
  await page.route('**/api/v1/rooms', async route => {
    counts.rooms += 1;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([room]) });
  });
  await page.route('**/api/v1/devices', async route => {
    counts.devices += 1;
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/homes/responsive-home/rooms', async route => {
    counts.homeRooms += 1;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([room]) });
  });
  await page.route('**/api/v1/scenes', async route => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/v1/automations', async route => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });

  await page.goto('/spaces');
  await expect(page.getByRole('button', { name: /Sala de prueba/ })).toBeVisible();
  await page.getByRole('button', { name: /Rutinas|Routines/i }).click();
  await expect(page).toHaveURL(/\/routines/);
  await expect(page.getByText(/No hay escenas|No scenes/i).first()).toBeVisible();
  await page.getByRole('radio', { name: /Automatizaciones|Automations/i }).click();
  await expect(page).toHaveURL(/\/routines\/automations/);
  await expect(page.getByRole('button', { name: /Crear Regla|Create Rule/i }).first()).toBeVisible();
  expect(counts).toEqual({ homes: 1, rooms: 1, devices: 1, homeRooms: 0 });
});

test('Feature: Room details — Scenario: A home owner selects a room, controls a light, renames the room and closes its details', async ({ page }) => {
  await page.setViewportSize(viewports[1]);
  await prepareAuthenticatedDashboard(page);

  const room = { id: 'responsive-room', homeId: 'responsive-home', name: 'Sala de prueba' };
  const light = {
    id: 'responsive-light', name: 'Lámpara central', type: 'light', semanticType: 'light',
    status: 'ASSIGNED', roomId: room.id, lastKnownState: { on: false },
  };
  let commandCount = 0;
  await page.route('**/api/v1/homes', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([
      { id: 'responsive-home', name: 'Casa de prueba', ownerId: dashboardUser.id },
    ]) });
  });
  await page.route('**/api/v1/homes/responsive-home/rooms', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([room]) });
  });
  await page.route('**/api/v1/rooms', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([room]) });
  });
  await page.route('**/api/v1/devices', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([light]) });
  });
  await page.route('**/api/v1/devices/responsive-light/command', async route => {
    commandCount += 1;
    expect(route.request().postDataJSON()).toEqual({ command: 'turn_on' });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      ...light, lastKnownState: { on: true },
    }) });
  });
  await page.route('**/api/v1/rooms/responsive-room', async route => {
    expect(route.request().method()).toBe('PATCH');
    expect(route.request().postDataJSON()).toEqual({ name: 'Sala principal' });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      ...room, name: 'Sala principal',
    }) });
  });

  await page.goto('/spaces');
  await page.getByRole('button', { name: /Sala de prueba/ }).click();
  const detail = page.locator('aside.self-start');
  await expect(detail).toContainText('Lámpara central');
  await expect(detail).toContainText(/Encendidas|On/i);

  await detail.getByRole('button', { name: /Encender dispositivo|Turn on device/i }).click();
  await expect(detail.getByRole('button', { name: /Apagar dispositivo|Turn off device/i })).toBeVisible();
  expect(commandCount).toBe(1);

  await detail.getByRole('button', { name: /Renombrar estancia|Rename room/i }).click();
  await detail.getByRole('textbox', { name: /Editar nombre|Edit name/i }).fill('Sala principal');
  await detail.getByRole('button', { name: /Guardar nombre|Save name/i }).click();
  await expect(detail).toContainText('Sala principal');

  await detail.getByRole('button', { name: /Cerrar detalle de estancia|Close room details/i }).click();
  await expect(detail).toHaveCount(0);
});
