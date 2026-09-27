import { expect, test, type Page } from '@playwright/test';

const id = '11111111-1111-4111-8111-111111111111';
const user = { id: 'admin-1', username: 'admin', role: 'admin', displayName: 'Admin', avatarDataUri: null };
const metadata = { adbSerial: null, androidId: 'physical-1', manufacturer: 'Droidlogic', model: 'Board',
  androidVersion: '11', resolution: '3840x2160', densityDpi: 480, screenState: 'awake' };
const source = { deviceId: id, homeId: 'home-1', adbHost: '192.168.1.37', adbPort: 5555,
  connectionState: 'online', lastSeenAt: '2026-09-26T10:00:00.000Z', metadata };
const device = { id, homeId: 'home-1', roomId: null, name: 'Pizarra sala', type: 'smart_display',
  semanticType: 'smart_display', integrationSource: 'android-display', status: 'PENDING', lastKnownState: {} };

async function shell(page: Page, listed = true) {
  await page.addInitScript(value => {
    localStorage.setItem('hp_session_token', 'display-ui-test');
    localStorage.setItem('hp_user_ctx', JSON.stringify(value));
    localStorage.setItem('i18nextLng', 'es');
  }, user);
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: user }));
  await page.route('**/api/v1/system/setup-status', route => route.fulfill({ json: {
    isInitialized: true, requiresOnboarding: false, hasAdminUser: true, hasHAConfig: false,
    haConnectionValid: false, installationProfile: 'native_only', requiresHomeAssistant: false,
  } }));
  await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'home-1', name: 'Casa' }] }));
  await page.route('**/api/v1/rooms', route => route.fulfill({ json: [{ id: 'room-1', name: 'Sala', homeId: 'home-1' }] }));
  await page.route('**/api/v1/devices', route => route.fulfill({ json: listed ? [device] : [] }));
  await page.route('**/api/v1/android-displays?homeId=*', route => route.fulfill({ json: { displays: listed ? [source] : [] } }));
  await page.route(`**/api/v1/android-displays/${id}`, route => route.fulfill({ json: { display: source } }));
  await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/assistant/findings', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/assistant/summary', route => route.fulfill({ json: { totalOpen: 0 } }));
}

test('empty, adoption test, ADB authorization and duplicate endpoint are clear', async ({ page }) => {
  await shell(page, false);
  await page.route('**/api/v1/android-displays/test', route => route.fulfill({ json: { connectionState: 'needs_authorization', metadata } }));
  await page.goto('/system/displays');
  await expect(page.getByText('Aún no hay pantallas Android')).toBeVisible();
  await page.getByRole('button', { name: 'Agregar pantalla' }).click();
  await page.getByLabel('Nombre').fill('Pizarra sala');
  await page.getByLabel('IP fija').fill('192.168.1.37');
  await page.getByRole('button', { name: 'Probar conexión' }).click();
  await expect(page.getByText(/Acepta físicamente la autorización ADB/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adoptar pantalla' })).toBeDisabled();
  await page.route('**/api/v1/android-displays/test', route => route.fulfill({ json: { connectionState: 'online', metadata } }));
  await page.getByRole('button', { name: 'Probar conexión' }).click();
  await expect(page.getByText('Droidlogic · Board')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adoptar pantalla' })).toBeEnabled();
  await page.route('**/api/v1/android-displays', route => route.fulfill({ status: 201, json: { display: source } }));
  await page.getByRole('button', { name: 'Adoptar pantalla' }).click();
  await expect(page.getByText('Pantalla adoptada.', { exact: false })).toBeVisible();
});

test('adopted display has only safe actions, refresh and committed volume', async ({ page }) => {
  await shell(page);
  let volumeCalls = 0;
  const commands: string[] = [];
  await page.route(`**/api/v1/android-displays/${id}/refresh`, route => route.fulfill({ json: { display: source } }));
  await page.route(`**/api/v1/devices/${id}/command`, async route => {
    const payload = route.request().postDataJSON() as { command: string | { name: string } };
    const name = typeof payload.command === 'string' ? payload.command : payload.command.name;
    commands.push(name);
    if (name === 'volume_set') volumeCalls++;
    await route.fulfill({ json: device });
  });
  await page.goto('/system/displays');
  await page.getByRole('button', { name: /Pizarra sala/ }).click();
  await expect(page.getByText('192.168.1.37:5555')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Inicio' }).click();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await page.getByRole('button', { name: 'Actualizar estado' }).click();
  const slider = page.getByRole('slider', { name: /Volumen a establecer/ });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => volumeCalls).toBe(1);
  expect(commands).toEqual(['navigate_home', 'navigate_back', 'volume_set']);
  await expect(page.getByRole('main').getByRole('button', { name: /sleep|reboot|wake|lock/i })).toHaveCount(0);
});

test('offline, duplicate endpoint and duplicate Android ID block adoption', async ({ page }) => {
  await shell(page);
  await page.route('**/api/v1/android-displays/test', route => route.fulfill({ json: { connectionState: 'offline', metadata } }));
  await page.goto('/system/displays');
  await page.getByRole('button', { name: 'Agregar pantalla' }).click();
  await page.getByLabel('Nombre').fill('Otra pizarra');
  await page.getByLabel('IP fija').fill('192.168.1.38');
  await page.getByRole('button', { name: 'Probar conexión' }).click();
  await expect(page.getByText(/La pantalla no responde/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adoptar pantalla' })).toBeDisabled();

  await page.route('**/api/v1/android-displays/test', route => route.fulfill({ json: { connectionState: 'online', metadata } }));
  await page.getByRole('button', { name: 'Probar conexión' }).click();
  await expect(page.getByText(/pantalla física ya está registrada/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adoptar pantalla' })).toBeDisabled();

  await page.getByLabel('IP fija').fill('192.168.1.37');
  await page.getByRole('button', { name: 'Probar conexión' }).click();
  await expect(page.getByText(/pantalla registrada en esta IP/)).toBeVisible();
});

test('identity mismatch blocks controls and bridge failures stay sanitized', async ({ page }) => {
  await shell(page);
  await page.route(`**/api/v1/android-displays/${id}/refresh`, route => route.fulfill({ json: {
    display: { ...source, connectionState: 'identity_mismatch' },
  } }));
  await page.goto('/system/displays');
  await page.getByRole('button', { name: /Pizarra sala/ }).click();
  await page.getByRole('button', { name: 'Actualizar estado' }).click();
  await expect(page.getByText(/La identidad de la pantalla cambió/)).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: 'Inicio' })).toBeDisabled();
  await page.route(`**/api/v1/android-displays/${id}/refresh`, route => route.fulfill({ status: 503,
    json: { error: { code: 'BRIDGE_UNAVAILABLE', message: 'private stack trace' } },
  }));
  await page.getByRole('button', { name: 'Actualizar estado' }).click();
  await expect(page.getByText(/servicio local de pantallas no respondió/)).toBeVisible();
  await expect(page.getByText('private stack trace')).toHaveCount(0);
});

for (const viewport of [{ width: 320, height: 720 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`display management fits ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await shell(page);
    await page.goto('/system/displays');
    await expect(page.getByRole('heading', { name: 'Pantallas Android', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Pizarra sala/ }).click();
    await expect(page.getByRole('main').getByRole('button', { name: 'Inicio' })).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(viewport.width + 1);
  });
}
