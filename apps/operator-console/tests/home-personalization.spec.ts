import { expect, test, type Page } from '@playwright/test';

const user = { id: 'home-admin', username: 'admin', role: 'admin', displayName: 'Oscar', avatarDataUri: null };
const endpoint = '**/api/v1/settings/home-personalization';
test.use({ timezoneId: 'America/Guayaquil' });

async function prepare(page: Page, images: Array<{ slot: number; url: string }> = [], sessionUser = user) {
  await page.addInitScript((value) => {
    localStorage.setItem('hp_session_token', 'home-personalization-test');
    localStorage.setItem('hp_user_ctx', JSON.stringify(value));
  }, sessionUser);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: sessionUser }));
  await page.route('**/api/v1/system/setup-status', (route) => route.fulfill({ json: {
    isInitialized: true, requiresOnboarding: false, hasAdminUser: true, hasHAConfig: false,
    haConnectionValid: false, installationProfile: 'native_only', requiresHomeAssistant: false,
  } }));
  await page.route('**/api/v1/dashboards', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/assistant/findings', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/assistant/summary', (route) => route.fulfill({ json: { totalOpen: 0 } }));
  await page.route(endpoint, (route) => route.fulfill({ json: {
    morningPhrase: 'Frase de mañana', afternoonPhrase: 'Frase de tarde', nightPhrase: 'Frase de noche', heroImages: images,
  } }));
}

test('Home uses one period for greeting and phrase and rotates ordered images without moving content', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.clock.install();
  const images = [1, 2, 3].map((slot) => ({ slot, url: `/media/home/image_home_${slot}.png` }));
  await prepare(page, images);
  await page.goto('/');
  const hero = page.locator('.homepilot-home-hero');
  await expect(hero).toBeVisible();
  await expect(hero.getByText('Mi Hogar')).toHaveCount(0);
  const period = await page.evaluate(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'mañana' : hour < 19 ? 'tarde' : 'noche';
  });
  await expect(hero.getByText(`Frase de ${period}`)).toBeVisible();
  const before = await hero.boundingBox();
  const first = hero.locator('img[src*="image_home_1.png"]');
  const second = hero.locator('img[src*="image_home_2.png"]');
  const third = hero.locator('img[src*="image_home_3.png"]');
  await expect(first).toHaveCSS('opacity', '1');
  await page.clock.fastForward(9_999);
  await expect(first).toHaveCSS('opacity', '1');
  await page.clock.fastForward(1);
  await expect(second).toHaveCSS('opacity', '1');
  await page.clock.fastForward(10_000);
  await expect(third).toHaveCSS('opacity', '1');
  await page.clock.fastForward(10_000);
  await expect(first).toHaveCSS('opacity', '1');
  expect((await hero.boundingBox())?.height).toBe(before?.height);
  await expect(hero).toBeInViewport();
});

test('empty personalization keeps the shipped image and neutral phrase', async ({ page }) => {
  await prepare(page);
  await page.route(endpoint, (route) => route.fulfill({ json: {
    morningPhrase: '', afternoonPhrase: '', nightPhrase: '', heroImages: [],
  } }));
  await page.goto('/');
  const hero = page.locator('.homepilot-home-hero');
  await expect(hero.locator('img[src="/home-dashboard-ambient.png"]')).toBeVisible();
  await expect(hero.getByText(/Todo está bajo control|Everything is under control/i)).toBeVisible();
});

test('Home dashboard control opens the own default tab only after a complete slide or keyboard activation', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await prepare(page);
  await page.route('**/api/v1/dashboards', (route) => route.fulfill({ json: [{
    id: 'home-owned-dashboard', ownerId: user.id, title: 'Mi tablero',
    visibility: { roles: [], users: [], homes: [] },
    tabs: [{ id: 'home-default-tab', title: 'Principal', isDefault: true, widgets: [] }],
  }] }));
  await page.goto('/');
  const action = page.locator('.homepilot-home-hero').getByRole('button', { name: /deslizar para abrir|slide to open/i });
  const handle = action.locator('.homepilot-slide-dashboard-handle');
  await expect(action).toBeEnabled();
  await expect(action).toHaveAccessibleDescription(/desliza el icono|slide the icon/i);

  await action.click();
  await expect(page).toHaveURL('/');

  const railBox = await action.boundingBox();
  const handleBox = await handle.boundingBox();
  expect(railBox && handleBox).toBeTruthy();
  const startX = handleBox!.x + handleBox!.width / 2;
  const centerY = handleBox!.y + handleBox!.height / 2;
  const distance = railBox!.width - handleBox!.width - 12;
  await page.mouse.move(startX, centerY);
  await page.mouse.down();
  await page.mouse.move(startX + distance * 0.4, centerY, { steps: 6 });
  const fillSurface = await action.locator('.homepilot-slide-dashboard-fill').evaluate((element) => {
    const style = getComputedStyle(element);
    return { radius: Number.parseFloat(style.borderTopRightRadius), borderWidth: Number.parseFloat(style.borderRightWidth), borderColor: style.borderRightColor };
  });
  expect(fillSurface.radius).toBeGreaterThan(0);
  expect(fillSurface.borderWidth).toBeGreaterThanOrEqual(1);
  expect(fillSurface.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  await page.mouse.up();
  await expect(page).toHaveURL('/');

  await page.reload();
  await expect(action).toBeEnabled();
  const fullRailBox = await action.boundingBox();
  const fullHandleBox = await handle.boundingBox();
  expect(fullRailBox && fullHandleBox).toBeTruthy();
  const fullStartX = fullHandleBox!.x + fullHandleBox!.width / 2;
  const fullCenterY = fullHandleBox!.y + fullHandleBox!.height / 2;
  const fullDistance = fullRailBox!.width - fullHandleBox!.width - 12;
  await page.mouse.move(fullStartX, fullCenterY);
  await page.mouse.down();
  await page.mouse.move(fullStartX + fullDistance, fullCenterY, { steps: 8 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/dashboards\/home-owned-dashboard\/home-default-tab$/);

  await page.goto('/');
  await action.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dashboards\/home-owned-dashboard\/home-default-tab$/);

  await page.goto('/');
  await action.focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/\/dashboards\/home-owned-dashboard\/home-default-tab$/);
});

test('Home dashboard slide control shows left-to-right waves at compact width and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepare(page);
  await page.route('**/api/v1/dashboards', (route) => route.fulfill({ json: [{
    id: 'home-owned-dashboard', ownerId: user.id, title: 'Mi tablero',
    visibility: { roles: [], users: [], homes: [] },
    tabs: [{ id: 'home-default-tab', title: 'Principal', isDefault: true, widgets: [] }],
  }] }));
  await page.goto('/');
  const action = page.locator('.homepilot-home-hero').getByRole('button', { name: /deslizar para abrir|slide to open/i });
  await expect(action).toBeEnabled();
  const cue = action.locator('.homepilot-slide-dashboard-cue');
  await expect.poll(() => cue.evaluate((element) => getComputedStyle(element, '::before').animationName)).toBe('homepilot-slide-cue');
  await expect(action.locator('.homepilot-slide-dashboard-chevrons')).toHaveCSS('animation-name', 'homepilot-slide-chevron');
  const bounds = await action.boundingBox();
  expect(bounds).toBeTruthy();
  expect(bounds!.width).toBeGreaterThan(200);
  expect(bounds!.width).toBeLessThan(240);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => cue.evaluate((element) => getComputedStyle(element, '::before').animationName)).toBe('none');
  await expect(action.locator('.homepilot-slide-dashboard-chevrons')).toHaveCSS('animation-name', 'none');
  await expect(action).toBeEnabled();
});

test('reduced motion removes the fade but keeps image rotation functional', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepare(page, [1, 2].map((slot) => ({ slot, url: `/media/home/image_home_${slot}.png` })));
  await page.goto('/');
  const hero = page.locator('.homepilot-home-hero');
  const first = hero.locator('img[src*="image_home_1.png"]');
  const second = hero.locator('img[src*="image_home_2.png"]');
  expect(await first.evaluate((image) => Number.parseFloat(getComputedStyle(image).transitionDuration))).toBeLessThanOrEqual(0.01);
  await page.clock.fastForward(10_000);
  await expect(second).toHaveCSS('opacity', '1');
});

test('greeting and phrase change together at the afternoon boundary', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-30T16:59:30.000Z') });
  await prepare(page);
  await page.goto('/');
  const hero = page.locator('.homepilot-home-hero');
  await expect(hero.getByRole('heading', { name: /buenos días, Oscar|good morning, Oscar/i })).toBeVisible();
  await expect(hero.getByText('Frase de mañana')).toBeVisible();
  await page.clock.fastForward(30_000);
  await expect(hero.getByRole('heading', { name: /buenas tardes, Oscar|good afternoon, Oscar/i })).toBeVisible();
  await expect(hero.getByText('Frase de tarde')).toBeVisible();
});

test('Admin can edit Home phrases with a 1000-character limit and responsive image slots', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await prepare(page, [{ slot: 1, url: '/media/home/image_home_1.png' }]);
  let saved: unknown = null;
  await page.route(endpoint, async (route) => {
    if (route.request().method() === 'PUT') {
      saved = route.request().postDataJSON();
      await route.fulfill({ json: { ...saved as object, heroImages: [{ slot: 1, url: '/media/home/image_home_1.png' }] } });
    } else await route.fallback();
  });
  await page.goto('/system/home-personalization');
  const morning = page.getByRole('textbox', { name: /frase de la mañana|morning phrase/i });
  await expect(morning).toBeVisible();
  const initialHeight = await morning.evaluate((element) => element.getBoundingClientRect().height);
  await morning.fill('A'.repeat(1000));
  await expect(page.getByText('1000 / 1000')).toBeVisible();
  await morning.press('End');
  await morning.press('Z');
  await expect(morning).toHaveValue('A'.repeat(1000));
  expect(await morning.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(initialHeight);
  expect(await morning.evaluate((element) => getComputedStyle(element).resize)).toBe('none');
  await page.getByRole('button', { name: /guardar frases|save phrases/i }).click();
  await expect.poll(() => saved).toMatchObject({ morningPhrase: 'A'.repeat(1000) });
  await expect(page.getByRole('status')).toContainText(/frases guardadas correctamente|phrases saved successfully/i);
  await expect(page.getByText('image_home_1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('non-Admin cannot open the personalization view through its direct URL', async ({ page }) => {
  await prepare(page, [], { ...user, role: 'resident' });
  await page.goto('/system/home-personalization');
  await expect(page.getByRole('heading', { name: /personalización de inicio|home personalization/i })).toHaveCount(0);
});

test('phrase save exposes busy, success and recoverable error states', async ({ page }) => {
  await prepare(page);
  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });
  let attempts = 0;
  await page.route(endpoint, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    attempts += 1;
    if (attempts === 1) {
      await saveGate;
      await route.fulfill({ json: { ...route.request().postDataJSON() as object, heroImages: [] } });
    } else await route.fulfill({ status: 500, json: { error: { message: 'No se pudo guardar' } } });
  });
  await page.goto('/system/home-personalization');
  await page.getByRole('button', { name: /guardar frases|save phrases/i }).click();
  const saving = page.getByRole('button', { name: /guardando|saving/i });
  await expect(saving).toBeDisabled();
  await expect(saving).toHaveAttribute('aria-busy', 'true');
  releaseSave();
  await expect(page.getByRole('status')).toContainText(/frases guardadas correctamente|phrases saved successfully/i);
  await page.getByRole('button', { name: /guardar frases|save phrases/i }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo guardar');
  await expect(page.getByRole('button', { name: /guardar frases|save phrases/i })).toBeEnabled();
  expect(attempts).toBe(2);
});

test('Admin adds and confirms removal of an image through the visible controls', async ({ page }) => {
  await prepare(page);
  let deleteRequests = 0;
  let releaseDelete!: () => void;
  const deleteGate = new Promise<void>((resolve) => { releaseDelete = resolve; });
  await page.route('**/api/v1/settings/home-personalization/images', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect((route.request().postDataJSON() as { dataUri: string }).dataUri).toMatch(/^data:image\/png;base64,/);
    await route.fulfill({ json: { heroImages: [{ slot: 1, url: '/media/home/image_home_1.png' }] } });
  });
  await page.route('**/api/v1/settings/home-personalization/images/1', async (route) => {
    deleteRequests += 1;
    expect(route.request().method()).toBe('DELETE');
    await deleteGate;
    await route.fulfill({ json: { heroImages: [] } });
  });
  await page.goto('/system/home-personalization');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /añadir imagen|add image/i }).and(page.locator('button')).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'home.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });
  await expect(page.getByText('image_home_1')).toBeVisible();
  await expect(page.getByRole('status')).toContainText(/imagen cargada correctamente|image uploaded successfully/i);
  await page.getByRole('button', { name: /eliminar imagen 1|delete image 1/i }).click();
  const confirm = page.getByRole('dialog', { name: /eliminar esta imagen|delete this image/i });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: /cancelar|cancel/i }).click();
  expect(deleteRequests).toBe(0);
  await expect(page.getByText('image_home_1')).toBeVisible();
  await page.getByRole('button', { name: /eliminar imagen 1|delete image 1/i }).click();
  await confirm.getByRole('button', { name: /^eliminar$|^delete$/i }).click();
  await expect(confirm.getByRole('button', { name: /eliminando|deleting/i })).toBeDisabled();
  await expect(page.getByText('image_home_1')).toBeVisible();
  releaseDelete();
  await expect(page.getByText('image_home_1')).toHaveCount(0);
  expect(deleteRequests).toBe(1);
  await expect(page.getByRole('status')).toContainText(/imagen eliminada correctamente|image deleted successfully/i);
});

test('failed upload reports the error, reenables actions and preserves existing images', async ({ page }) => {
  await prepare(page, [{ slot: 1, url: '/media/home/image_home_1.png' }]);
  let releaseUpload!: () => void;
  const uploadGate = new Promise<void>((resolve) => { releaseUpload = resolve; });
  await page.route('**/api/v1/settings/home-personalization/images', async (route) => {
    await uploadGate;
    await route.fulfill({ status: 500, json: { error: { message: 'No se pudo subir' } } });
  });
  await page.goto('/system/home-personalization');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /añadir imagen|add image/i }).and(page.locator('button')).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'home.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });
  await expect(page.getByRole('button', { name: /subiendo|uploading/i })).toBeDisabled();
  releaseUpload();
  await expect(page.getByRole('alert')).toContainText('No se pudo subir');
  await expect(page.getByText('image_home_1')).toBeVisible();
  await expect(page.getByRole('button', { name: /añadir imagen|add image/i }).and(page.locator('button'))).toBeEnabled();
});

for (const viewport of [
  { name: 'mobile', width: 320, height: 720 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'portrait kiosk', width: 1080, height: 1920 },
]) {
  test(`personalization feedback and delete confirmation fit ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepare(page, [{ slot: 1, url: '/media/home/image_home_1.png' }]);
    await page.goto('/system/home-personalization');
    await page.getByRole('button', { name: /guardar frases|save phrases/i }).click();
    await expect(page.getByRole('status')).toContainText(/frases guardadas correctamente|phrases saved successfully/i);
    await page.getByRole('button', { name: /eliminar imagen 1|delete image 1/i }).click();
    await expect(page.getByRole('dialog', { name: /eliminar esta imagen|delete this image/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test('inactivity returns from another view to Home without a full reload', async ({ page }) => {
  await page.clock.install();
  await prepare(page);
  await page.goto('/system/home-personalization');
  await expect(page.getByRole('heading', { name: /personalización de inicio|home personalization/i })).toBeVisible();
  await page.clock.fastForward(119_000);
  await expect(page).toHaveURL(/\/system\/home-personalization$/);
  await page.clock.fastForward(1_000);
  await expect(page).toHaveURL(/\/$/);
});

test('one configured image stays static and replaces the default asset', async ({ page }) => {
  await page.clock.install();
  await prepare(page, [{ slot: 1, url: '/media/home/image_home_1.png' }]);
  await page.goto('/');
  const hero = page.locator('.homepilot-home-hero');
  await expect(hero.locator('img[src*="image_home_1.png"]')).toHaveCount(1);
  await expect(hero.locator('img[src="/home-dashboard-ambient.png"]')).toHaveCount(0);
  await page.clock.fastForward(10_000);
  await expect(hero.locator('img')).toHaveCount(1);
});

test('pointer activity resets the two-minute return period', async ({ page }) => {
  await page.clock.install();
  await prepare(page);
  await page.goto('/system/home-personalization');
  await expect(page.getByRole('heading', { name: /personalización de inicio|home personalization/i })).toBeVisible();
  await page.clock.fastForward(90_000);
  await page.mouse.move(20, 20);
  await page.clock.fastForward(119_000);
  await expect(page).toHaveURL(/\/system\/home-personalization$/);
  await page.clock.fastForward(1_000);
  await expect(page).toHaveURL(/\/$/);
});

for (const activity of ['keyboard', 'scroll'] as const) {
  test(`${activity} activity resets the two-minute return period`, async ({ page }) => {
    await page.clock.install();
    await prepare(page);
    await page.goto('/system/home-personalization');
    await expect(page.getByRole('heading', { name: /personalización de inicio|home personalization/i })).toBeVisible();
    if (activity === 'scroll') await page.mouse.move(150, 300);
    await page.clock.fastForward(90_000);
    await expect(page).toHaveURL(/\/system\/home-personalization$/);
    if (activity === 'keyboard') await page.keyboard.press('Tab');
    else {
      const wheelObserved = page.evaluate(() => new Promise<void>((resolve) => window.addEventListener('wheel', () => resolve(), { once: true })));
      await page.mouse.wheel(0, 200);
      await wheelObserved;
    }
    await page.clock.fastForward(119_000);
    await expect(page).toHaveURL(/\/system\/home-personalization$/);
    await page.clock.fastForward(1_000);
    await expect(page).toHaveURL(/\/$/);
  });
}

test.describe('touch activity', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('resets the idle return period', async ({ page }) => {
    await page.clock.install();
    await prepare(page);
    await page.goto('/system/home-personalization');
    await expect(page.getByRole('heading', { name: /personalización de inicio|home personalization/i })).toBeVisible();
    await page.clock.fastForward(90_000);
    await page.touchscreen.tap(160, 300);
    await page.clock.fastForward(119_000);
    await expect(page).toHaveURL(/\/system\/home-personalization$/);
    await page.clock.fastForward(1_000);
    await expect(page).toHaveURL(/\/$/);
  });
});

test('an open modal pauses the idle return without closing the session', async ({ page }) => {
  await page.clock.install();
  await prepare(page);
  await page.goto('/system/home-personalization');
  await page.getByRole('button', { name: /Oscar.*Admin/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.fastForward(120_000);
  await expect(page).toHaveURL(/\/system\/home-personalization$/);
  await expect(page.getByRole('dialog')).toBeVisible();
});

for (const viewport of [
  { name: 'mobile', width: 320, height: 720 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'portrait kiosk', width: 1080, height: 1920 },
  { name: 'short landscape', width: 1280, height: 600 },
]) {
  test(`Home greeting stays above its phrase and near the hero top on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    await page.goto('/');
    const hero = page.locator('.homepilot-home-hero');
    const heading = hero.getByRole('heading', { level: 1 });
    const greetingLine = heading.locator('span').nth(0);
    const nameLine = heading.locator('span').nth(1);
    const phrase = hero.getByText(/Frase de (mañana|tarde|noche)/);
    await expect(phrase).toBeVisible();
    const heroBox = await hero.boundingBox();
    const headingBox = await heading.boundingBox();
    const greetingBox = await greetingLine.boundingBox();
    const nameBox = await nameLine.boundingBox();
    const phraseBox = await phrase.boundingBox();
    expect(heroBox && headingBox && greetingBox && nameBox && phraseBox).toBeTruthy();
    expect(headingBox!.y - heroBox!.y).toBeLessThan(80);
    expect(nameBox!.y).toBeGreaterThan(greetingBox!.y);
    expect(Math.abs(nameBox!.x - greetingBox!.x)).toBeLessThan(1);
    expect(phraseBox!.y).toBeGreaterThan(headingBox!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test(`Home keeps a 1000-character phrase above the flip clock without overflow on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    const phrase = ('Control sereno y claro para cada espacio. ').repeat(25).slice(0, 1000);
    await page.route(endpoint, (route) => route.fulfill({ json: {
      morningPhrase: phrase, afternoonPhrase: phrase, nightPhrase: phrase, heroImages: [],
    } }));
    await page.goto('/');
    const hero = page.locator('.homepilot-home-hero');
    const paragraph = hero.locator('p').filter({ hasText: phrase });
    const clock = hero.locator('[data-home-flip-clock]');
    await expect(paragraph).toBeVisible();
    await expect(clock).toBeVisible();
    const phraseBounds = await paragraph.boundingBox();
    const moduleBounds = await clock.boundingBox();
    const heroBounds = await hero.boundingBox();
    expect(phraseBounds && moduleBounds && heroBounds).toBeTruthy();
    expect(moduleBounds!.y).toBeGreaterThan(phraseBounds!.y + phraseBounds!.height);
    expect(moduleBounds!.y + moduleBounds!.height).toBeLessThanOrEqual(heroBounds!.y + heroBounds!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

for (const viewport of [
  { name: 'mobile', width: 320, height: 720 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`Home hero composition keeps the flip clock, three context chips and a separate dashboard action on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    await page.goto('/');
    const hero = page.locator('.homepilot-home-hero');
    const clock = hero.locator('[data-home-flip-clock]');
    const digits = clock.locator('.homepilot-flip-digit');
    const chips = hero.locator('.homepilot-home-context .homepilot-home-chip');
    const phrase = hero.getByText(/Frase de (mañana|tarde|noche)/);
    const location = chips.nth(0).getByText('Cuenca');
    const action = hero.getByRole('button', { name: /sin pestaña principal|no main tab/i });
    await expect(clock).toBeVisible();
    await expect(digits).toHaveCount(4);
    await expect(chips).toHaveCount(3);
    await expect(chips.nth(1)).toContainText(/de |, /);
    await expect(chips.nth(2)).toContainText(/°C|—/);
    expect(await chips.nth(1).evaluate((chip) => [...chip.querySelectorAll('span')].every((part) => part.scrollWidth <= part.clientWidth + 1))).toBe(true);
    await expect(location).toBeVisible();
    await expect(hero.getByText(/^(Ubicación|Location)$/)).toHaveCount(0);
    await expect(hero.getByRole('button', { name: /Ubicación|Location/i })).toHaveCount(0);
    await expect(hero.getByLabel('HomePilot by NEZU')).toBeVisible();
    const brandBox = await hero.getByLabel('HomePilot by NEZU').boundingBox();
    const locationBox = await location.boundingBox();
    expect(brandBox && locationBox).toBeTruthy();
    expect(brandBox!.y - locationBox!.y - locationBox!.height).toBeGreaterThan(20);
    await expect(page.getByText('Powered by NEZU')).toBeVisible();
    await expect(action).toContainText(/Ir a tablero|Go to dashboard/);
    const heroBox = await hero.boundingBox();
    const phraseBox = await phrase.boundingBox();
    const firstBox = await clock.boundingBox();
    const secondBox = await chips.nth(0).boundingBox();
    const actionBox = await action.boundingBox();
    expect(heroBox && phraseBox && firstBox && secondBox && actionBox).toBeTruthy();
    expect(Math.abs(brandBox!.x - firstBox!.x)).toBeLessThan(1);
    expect(firstBox!.width).toBeGreaterThan(firstBox!.height);
    expect(secondBox!.y).toBeGreaterThanOrEqual(firstBox!.y + firstBox!.height);
    expect(firstBox!.y).toBeGreaterThan(phraseBox!.y + phraseBox!.height);
    if (viewport.width >= 1024) {
      expect(phraseBox!.width).toBeLessThanOrEqual(heroBox!.width * 0.55);
      expect(actionBox!.x).toBeGreaterThan(firstBox!.x + firstBox!.width);
    } else {
      expect(actionBox!.y).toBeGreaterThan(firstBox!.y);
    }
    const rightPadding = await hero.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingRight));
    expect(Math.abs(actionBox!.x + actionBox!.width - (heroBox!.x + heroBox!.width - rightPadding))).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test('Home flip clock advances by the minute and keeps a blinking visual separator', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-30T16:59:40.000Z') });
  await prepare(page);
  await page.goto('/');
  const clock = page.locator('.homepilot-home-hero [data-home-flip-clock]');
  await expect(clock).toHaveAttribute('datetime', '11:59');
  await expect(clock.locator('.homepilot-flip-digit')).toHaveCount(4);
  await expect(clock.locator('.homepilot-flip-colon')).toHaveCSS('animation-name', 'homepilot-colon-blink');
  await page.clock.fastForward(20_000);
  await expect(clock).toHaveAttribute('datetime', '12:00');
  await expect(clock.locator('.homepilot-flip-fold-out')).toHaveCount(3);
});

test('Home flip clock shows updated time without flap motion when reduced motion is requested', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-30T16:59:40.000Z') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepare(page);
  await page.goto('/');
  const clock = page.locator('.homepilot-home-hero [data-home-flip-clock]');
  await page.clock.fastForward(20_000);
  await expect(clock).toHaveAttribute('datetime', '12:00');
  await expect(clock.locator('.homepilot-flip-fold-out')).toHaveCount(0);
  await expect(clock.locator('.homepilot-flip-colon')).toHaveCSS('animation-name', 'none');
});

for (const viewport of [
  { name: 'mobile', width: 320, height: 720 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`Home dashboard action stays opaque over the hero in light mode on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    await page.goto('/');
    await page.evaluate(() => document.documentElement.classList.add('light'));
    const action = page.locator('.homepilot-home-hero').getByRole('button', { name: /sin pestaña principal|no main tab/i });
    await expect(action).toBeDisabled();
    await expect(action).toHaveCSS('opacity', '1');
    const surface = await action.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, foreground: style.color, zIndex: style.zIndex };
    });
    expect(surface.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(surface.foreground).not.toBe(surface.background);
    expect(Number(surface.zIndex)).toBeGreaterThan(1);
  });
}
