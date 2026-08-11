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

const dashboardUser = {
  id: 'responsive-admin',
  username: 'admin',
  role: 'admin',
  displayName: 'Administrador',
  avatarDataUri: null,
};

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
    await route.fulfill({ contentType: 'application/json', body: '[]' });
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
