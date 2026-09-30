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
  const first = hero.locator('img[src$="image_home_1.png"]');
  const second = hero.locator('img[src$="image_home_2.png"]');
  const third = hero.locator('img[src$="image_home_3.png"]');
  await expect(first).toHaveCSS('opacity', '1');
  await page.clock.fastForward(5000);
  await expect(second).toHaveCSS('opacity', '1');
  await page.clock.fastForward(5000);
  await expect(third).toHaveCSS('opacity', '1');
  await page.clock.fastForward(5000);
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

test('reduced motion removes the fade but keeps image rotation functional', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepare(page, [1, 2].map((slot) => ({ slot, url: `/media/home/image_home_${slot}.png` })));
  await page.goto('/');
  const hero = page.locator('.homepilot-home-hero');
  const first = hero.locator('img[src$="image_home_1.png"]');
  const second = hero.locator('img[src$="image_home_2.png"]');
  expect(await first.evaluate((image) => Number.parseFloat(getComputedStyle(image).transitionDuration))).toBeLessThanOrEqual(0.01);
  await page.clock.fastForward(5000);
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

test('Admin can edit Home phrases with a 100-character limit and responsive image slots', async ({ page }) => {
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
  await morning.fill('A'.repeat(100));
  await expect(page.getByText('100 / 100')).toBeVisible();
  expect(await morning.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(initialHeight);
  expect(await morning.evaluate((element) => getComputedStyle(element).resize)).toBe('none');
  await page.getByRole('button', { name: /guardar frases|save phrases/i }).click();
  await expect.poll(() => saved).toMatchObject({ morningPhrase: 'A'.repeat(100) });
  await expect(page.getByText('image_home_1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('non-Admin cannot open the personalization view through its direct URL', async ({ page }) => {
  await prepare(page, [], { ...user, role: 'resident' });
  await page.goto('/system/home-personalization');
  await expect(page.getByRole('heading', { name: /personalización de inicio|home personalization/i })).toHaveCount(0);
});

test('Admin adds and removes an image through the visible controls', async ({ page }) => {
  await prepare(page);
  await page.route('**/api/v1/settings/home-personalization/images', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect((route.request().postDataJSON() as { dataUri: string }).dataUri).toMatch(/^data:image\/png;base64,/);
    await route.fulfill({ json: { heroImages: [{ slot: 1, url: '/media/home/image_home_1.png' }] } });
  });
  await page.route('**/api/v1/settings/home-personalization/images/1', async (route) => {
    expect(route.request().method()).toBe('DELETE');
    await route.fulfill({ json: { heroImages: [] } });
  });
  await page.goto('/system/home-personalization');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /añadir imagen|add image/i }).and(page.locator('button')).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'home.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });
  await expect(page.getByText('image_home_1')).toBeVisible();
  await page.getByRole('button', { name: /eliminar imagen 1|delete image 1/i }).click();
  await expect(page.getByText('image_home_1')).toHaveCount(0);
});

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
  await expect(hero.locator('img[src$="image_home_1.png"]')).toHaveCount(1);
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
    const phrase = hero.getByText(/Frase de (mañana|tarde|noche)/);
    await expect(phrase).toBeVisible();
    const heroBox = await hero.boundingBox();
    const headingBox = await heading.boundingBox();
    const phraseBox = await phrase.boundingBox();
    expect(heroBox && headingBox && phraseBox).toBeTruthy();
    expect(headingBox!.y - heroBox!.y).toBeLessThan(80);
    expect(phraseBox!.y).toBeGreaterThan(headingBox!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}
