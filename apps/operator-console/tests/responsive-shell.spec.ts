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

for (const viewport of viewports) {
  test(`keeps the login shell responsive on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/v1/system/setup-status', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(setupStatus) });
    });

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
}
