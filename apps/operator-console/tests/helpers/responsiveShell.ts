export async function enterDashboardEdit(page: import('@playwright/test').Page, touch = false) {
  const header = page.locator('.homepilot-dashboard-titlebar');
  const more = header.getByLabel(/^(More|Más)$/i);
  if (touch) await more.tap(); else await more.click();
  const edit = page.getByRole('menu', { name: /^(More|Más)$/i }).getByRole('menuitem', { name: /^(Edit|Editar)$/i });
  if (touch) await edit.tap(); else await edit.click();
}

export async function openSectionEditor(
  page: import('@playwright/test').Page,
  section: import('@playwright/test').Locator,
  touch = false,
) {
  const actions = section.getByRole('button', { name: /^(Section actions|Acciones de sección)$/i });
  if (touch) await actions.tap(); else await actions.click();

  const edit = page
    .getByRole('menu', { name: /^(Section actions|Acciones de sección)$/i })
    .getByRole('menuitem', { name: /^(Edit|Editar)$/i });

  if (touch) await edit.tap(); else await edit.click();
}

export const setupStatus = {
  isInitialized: true,
  requiresOnboarding: false,
  hasAdminUser: true,
  hasHAConfig: false,
  haConnectionValid: false,
  installationProfile: 'native_only',
  requiresHomeAssistant: false,
};

export const viewports = [
  { name: 'mobile', width: 320, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

export const portraitKioskViewport = { width: 1080, height: 1920 };

export const dashboardUser = {
  id: 'responsive-admin',
  username: 'admin',
  role: 'admin',
  displayName: 'Administrador',
  avatarDataUri: null,
};

export const responsiveDevices = [
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

export const responsiveDashboard = {
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

export async function prepareLoginShell(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/system/features', route => route.fulfill({ json: { homeChat: true } }));
  await page.route('**/api/v1/system/setup-status', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(setupStatus) });
  });
}

export async function waitForSettledLayout(locator: import('@playwright/test').Locator) {
  await locator.evaluate(async element => {
    await document.fonts.ready;
    // Bounding boxes include ancestor transforms, including the modal's
    // zoom-in animation. Wait for finite motion, not infinite sensor effects.
    const animations = new Set<Animation>(element.getAnimations({ subtree: true }));
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      for (const animation of parent.getAnimations()) animations.add(animation);
    }
    await Promise.all([...animations]
      .filter(animation => Number.isFinite(animation.effect?.getTiming().iterations ?? Infinity))
      .map(animation => animation.finished.catch(() => undefined)));
    // Allow preview ResizeObserver scaling to settle after the modal finishes.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

export async function prepareAuthenticatedDashboard(page: import('@playwright/test').Page, dashboard: object = responsiveDashboard, user = dashboardUser) {
  await page.addInitScript((user) => {
    localStorage.setItem('hp_session_token', 'responsive-test-token');
    localStorage.setItem('hp_user_ctx', JSON.stringify(user));
  }, user);

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(user) });
  });
  await page.route('**/api/v1/scenes/share-users', route => route.fulfill({ json: [{ id: 'share-recipient', name: 'Ana' }, { id: 'share-recipient-2', name: 'Luis' }] }));
  await page.route('**/api/v1/system/features', route => route.fulfill({ json: { homeChat: true } }));
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
  // Home waits for all of these resources before exposing its content. Keep
  // the shared fixture offline and deterministic; individual tests can
  // override any route below with their own data or loading gate.
  await page.route('**/api/v1/rooms', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/scenes', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/automations', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/scenes/favorites', route => route.fulfill({ json: { sceneIds: [], initialized: true } }));
  await page.route('**/api/v1/automations/favorites', route => route.fulfill({ json: { automationIds: [], initialized: true } }));
  await page.route('**/api/v1/settings/home-personalization', route => route.fulfill({
    json: { morningPhrase: '', afternoonPhrase: '', nightPhrase: '', heroImages: [] },
  }));
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({
    json: { current: { temperature_2m: 19, weather_code: 0, wind_speed_10m: 3, time: '2026-10-05T12:34' } },
  }));
}

export const favoriteAutomationRules = [
  { id: 'automation-x', homeId: 'responsive-home', name: 'Luz nocturna', enabled: true,
    trigger: { type: 'time', timeLocal: '22:00', timezone: 'America/Guayaquil' },
    action: { type: 'device_command', targetDeviceId: 'sensor-climate', command: 'turn_on' } },
  { id: 'automation-y', homeId: 'responsive-home', name: 'Luz matutina', enabled: true,
    trigger: { type: 'time', timeLocal: '07:00', timezone: 'America/Guayaquil' },
    action: { type: 'device_command', targetDeviceId: 'sensor-climate', command: 'turn_on' } },
];
