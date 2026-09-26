import { expect, test } from '@playwright/test';

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

async function prepareAuthenticatedDashboard(page: import('@playwright/test').Page) {
  await page.addInitScript((user) => {
    localStorage.setItem('hp_session_token', 'responsive-test-token');
    localStorage.setItem('hp_user_ctx', JSON.stringify(user));
  }, dashboardUser);

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(dashboardUser) });
  });
  await page.route('**/api/v1/system/setup-status', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(setupStatus) });
  });
  await page.route('**/api/v1/dashboards', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([responsiveDashboard]) });
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

  await expect(page.getByRole('heading', { name: /^(Edit|Editar)$/i })).toBeVisible();
  await expect(page.getByText(/^(Card width|Ancho de tarjeta)$/i)).toHaveCount(0);
  await page.getByRole('button', { name: /^(Save|Guardar)$/i }).click();

  const mediaCard = page.locator('[class*="group/card"]').filter({ hasText: /Reproductor|Media player/i });
  await expect(mediaCard).toHaveClass(/col-span-full/);
  await expect(mediaCard.getByRole('slider', { name: /resize card|redimensionar tarjeta/i })).toHaveCount(0);
});

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
  await expect(sceneButton.locator('svg').first()).toHaveClass(/text-light-active/);
  await expect(sceneTile.locator('svg.lucide-loader-circle')).toHaveCount(0);
  finishSceneExecution?.();
  await expect(sceneButton).toHaveAttribute('data-action-state', 'success');
  await expect(sceneTile).toHaveClass(/homepilot-section-light-tile-active/);
  await expect(sceneButton.locator('svg').first()).toHaveClass(/text-light-active/);
  await expect(sceneButton.locator('svg.lucide-check')).toHaveCount(0);
  await expect(sceneButton.getByText(/^(Done|Listo)$/i)).toHaveCount(0);
  await expect(sceneButton).toHaveAttribute('data-action-state', 'idle', { timeout: 4000 });
  await expect(sceneTile).not.toHaveClass(/homepilot-section-light-tile-active/);
  await expect(sceneButton.locator('svg').first()).toHaveClass(/text-muted-foreground/);
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
    await expect(page.getByRole('button', { name: /dashboard history|historial del tablero/i })).toBeVisible();
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

    const compactBadgeVisibility = await page.locator('.sensor-metric-card').evaluateAll((cards) => cards.map((card) => {
      const badge = card.querySelector('.sensor-category-badge');
      return {
        clientWidth: card.clientWidth,
        display: badge ? getComputedStyle(badge).display : null,
      };
    }));
    compactBadgeVisibility
      .filter(({ clientWidth }) => clientWidth <= 192)
      .forEach(({ display }) => expect(display).toBe('none'));
    await expect(page.getByText('Cortina de sala').first()).toBeVisible();
    await expect(page.locator('.min-h-clock-card').first()).toBeVisible();

    await page.evaluate(() => document.documentElement.classList.add('light'));
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

  test(`keeps the home climate summary responsive on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);

    await page.goto('/');
    const climateSummary = page.getByLabel(/contexto local del hogar|local home context/i);
    await expect(climateSummary).toBeVisible();
    const ambientImage = page.locator('img[src="/home-dashboard-ambient.png"]');
    await expect(ambientImage).toBeVisible();
    await expect(ambientImage).toHaveAttribute('alt', '');

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  });

  test(`keeps dashboard history accessible on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);

    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const historyButton = page.getByRole('button', { name: /dashboard history|historial del tablero/i });
    await expect(historyButton).toBeVisible();
    await historyButton.click();

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
      body: JSON.stringify([{ id: 'light-1', name: 'Living Room Light' }]),
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

  const deviceSelector = dialog.locator('button[aria-haspopup="listbox"]').nth(2);
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
