import { expect, test } from '@playwright/test';

for (const width of [360, 768, 1440]) {
  test(`Feature: Standard option cards — Scenario: Selection and long context fit ${width}px (AC79)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    const requests: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => { requests.push(route.request().url()); return route.abort(); });
    await page.goto('/tests/ui/button-review.html?component=options');
    await expect(page.getByRole('heading', { name: 'Tarjetas de opción · HomePilot' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['oscuro', 'claro']) {
      const panel = page.getByRole('region', { name: `Tema ${theme}` });
      const group = panel.getByRole('radiogroup', { name: 'Tipo de instalación' });
      const local = group.getByRole('radio', { name: /^Instalación local/ });
      const custom = group.getByRole('radio', { name: /^Configuración personalizada/ });
      const unavailable = group.getByRole('radio', { name: /^No disponible/ });
      await expect(local).toHaveAttribute('aria-checked', 'true');
      await expect(unavailable).toBeDisabled();
      await local.focus();
      await page.keyboard.press('Tab');
      await expect(custom).toBeFocused();
      await expect(custom).not.toHaveCSS('box-shadow', 'none');
      await page.keyboard.press('Space');
      await expect(custom).toHaveAttribute('aria-checked', 'true');
      await expect(local).toHaveAttribute('aria-checked', 'false');
      await expect(group.locator('[aria-checked="true"]')).toHaveCount(1);
      await expect(custom.locator('svg')).toHaveAttribute('focusable', 'false');
      const content = custom.locator('span.flex-col');
      await expect(content.locator('span').nth(1)).toHaveCSS('font-size', '14px');
      await expect(content.locator('span').nth(1)).toHaveCSS('font-weight', '400');
      const text = (await content.boundingBox())!;
      const mark = (await custom.locator('svg').boundingBox())!;
      expect(text.x + text.width).toBeLessThanOrEqual(mark.x);
      for (const card of await group.getByRole('radio').all()) {
        await expect(card).toHaveCSS('border-radius', '28px');
        expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(48);
        expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight)).toBe(true);
      }
      await local.focus();
      await page.keyboard.press('Enter');
      await expect(local).toHaveAttribute('aria-checked', 'true');
      await expect(panel.getByRole('status')).toContainText('Instalación local');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`option-cards-${width}.png`), fullPage: true });
  });

  for (const component of ['switches', 'segments'] as const) {
    test(`Feature: Standard selection controls — Scenario: ${component} review at ${width}px (AC79)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      const apiRequests: string[] = [];
      await page.route('**/api/**', route => { apiRequests.push(route.request().url()); return route.abort(); });
      await page.goto(`/tests/ui/button-review.html?component=${component}`);
      await page.evaluate(() => document.fonts.ready);
      for (const theme of ['oscuro', 'claro']) {
        const panel = page.getByRole('region', { name: `Tema ${theme}` });
        if (component === 'switches') {
          const toggle = panel.getByRole('switch', { name: 'Preferencia local' });
          await expect(toggle).toHaveCSS('height', '44px');
          await expect(toggle).toHaveCSS('width', '56px');
          await expect(toggle.locator('.homepilot-toggle-track')).toHaveCSS('height', '32px');
          await expect(toggle).toHaveAttribute('aria-checked', 'false');
          await toggle.focus();
          await page.keyboard.press('Space');
          await expect(toggle).toBeDisabled();
          await expect(toggle).toHaveAttribute('aria-busy', 'true');
          await expect(toggle).toBeEnabled();
          await expect(toggle).toHaveAttribute('aria-checked', 'true');
          await expect(panel.getByRole('status')).toHaveText('Activado');
          await expect(panel.getByRole('switch', { name: 'No disponible' })).toBeDisabled();
        } else {
          const group = panel.getByRole('radiogroup', { name: 'Vista neutra' });
          const all = group.getByRole('radio', { name: 'Todo', exact: true });
          await all.focus();
          await page.keyboard.press('ArrowRight');
          await expect(group.getByRole('radio', { name: 'Favoritos' })).toBeChecked();
          await page.keyboard.press('ArrowRight');
          await expect(group.getByRole('radio', { name: 'Recientes' })).toBeFocused();
          await expect(group.getByRole('radio', { name: 'Recientes' })).toBeChecked();
          await page.keyboard.press('Home');
          await expect(all).toBeChecked();
          await page.keyboard.press('End');
          await expect(group.getByRole('radio', { name: 'Recientes' })).toBeChecked();
          await expect(group.getByRole('radio', { name: 'No disponible' })).toBeDisabled();
          for (const option of await panel.getByRole('radio').all()) {
            expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
            await expect(option).toHaveCSS('font-size', '14px');
            await expect(option).toHaveCSS('text-transform', 'none');
          }
          for (const name of ['Todo', 'Favoritos', 'Recientes']) {
            for (const option of await panel.getByRole('radio', { name, exact: true }).all()) {
              expect((await option.locator('span').boundingBox())!.height).toBe(20);
            }
          }
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(apiRequests).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${component}-${width}.png`), fullPage: true });
    });
  }

  for (const component of ['fields', 'textarea'] as const) {
    test(`Feature: Standard text fields — Scenario: ${component} review at ${width}px (AC79)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      const apiRequests: string[] = [];
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', route => { apiRequests.push(route.request().url()); return route.abort(); });
      await page.goto(`/tests/ui/button-review.html?component=${component}`);
      await page.evaluate(() => document.fonts.ready);
      for (const theme of ['oscuro', 'claro']) {
        const panel = page.getByRole('region', { name: `Tema ${theme}` });
        const editable = panel.getByRole('textbox', { name: 'Con contenido', exact: true });
        await editable.fill('Texto de prueba con contenido largo para comprobar el espacio disponible.');
        await expect(editable).toHaveValue('Texto de prueba con contenido largo para comprobar el espacio disponible.');
        await editable.focus();
        await expect(editable).toBeFocused();
        await expect(editable).not.toHaveCSS('box-shadow', 'none');
        await expect(editable).toHaveCSS('border-radius', '12px');
        await expect(panel.getByRole('textbox', { name: 'Deshabilitado', exact: true })).toBeDisabled();
        const readonly = panel.getByRole('textbox', { name: 'Solo lectura', exact: true });
        await expect(readonly).toHaveAttribute('readonly', '');
        await readonly.focus();
        await page.keyboard.type('no debe cambiar');
        await expect(readonly).toHaveValue('Valor conservado');
        const invalid = panel.getByRole('textbox', { name: 'Con error', exact: true });
        await expect(invalid).toHaveAttribute('aria-invalid', 'true');
        await expect(invalid).toHaveAccessibleDescription('Indica un nombre para continuar.');
        for (const field of await panel.getByRole('textbox').all()) {
          const bounds = (await field.boundingBox())!;
          const region = (await panel.boundingBox())!;
          expect(bounds.x).toBeGreaterThanOrEqual(region.x);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(region.x + region.width + 0.5);
          if (component === 'fields') await expect(field).toHaveCSS('height', '44px');
          else expect(bounds.height).toBeGreaterThanOrEqual(96);
        }
        if (component === 'fields') {
          const search = panel.getByRole('textbox', { name: 'Buscar', exact: true });
          const clear = panel.getByRole('button', { name: 'Limpiar búsqueda' });
          const searchBounds = (await search.boundingBox())!;
          const clearBounds = (await clear.boundingBox())!;
          const paddingRight = await search.evaluate(element => parseFloat(getComputedStyle(element).paddingRight));
          expect(clearBounds.width).toBe(44);
          expect(clearBounds.x).toBeGreaterThanOrEqual(searchBounds.x + searchBounds.width - paddingRight);
          expect(clearBounds.x + clearBounds.width).toBeLessThanOrEqual(searchBounds.x + searchBounds.width + 0.5);
          await clear.click();
          await expect(search).toHaveValue('');
          await expect(clear).toHaveCount(0);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(apiRequests).toEqual([]);
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${component}-${width}.png`), fullPage: true });
    });
  }

  test(`Feature: Standard icon buttons — Scenario: Isolated keyboard and visual review at ${width}px (AC79)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    const apiRequests: string[] = [];
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/api/**', route => {
      apiRequests.push(route.request().url());
      return route.abort();
    });
    await page.goto('/tests/ui/button-review.html?component=icons');
    await expect(page.getByRole('heading', { name: 'Botones de icono · HomePilot' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['oscuro', 'claro']) {
      const panel = page.getByRole('region', { name: `Tema ${theme}` });
      await expect(panel.getByRole('button')).toHaveCount(6);
      for (const button of await panel.getByRole('button').all()) {
        await expect(button).toHaveCSS('width', '44px');
        await expect(button).toHaveCSS('height', '44px');
        await expect(button).toHaveCSS('border-radius', '12px');
        const icon = button.locator('svg');
        await expect(icon).toHaveAttribute('aria-hidden', 'true');
        await expect(icon).toHaveAttribute('focusable', 'false');
        const bounds = (await button.boundingBox())!;
        const iconBounds = (await icon.boundingBox())!;
        expect(iconBounds.width).toBeCloseTo(16, 1);
        expect(iconBounds.height).toBeCloseTo(16, 1);
        expect(Math.abs(bounds.x + bounds.width / 2 - iconBounds.x - iconBounds.width / 2)).toBeLessThan(0.5);
        expect(Math.abs(bounds.y + bounds.height / 2 - iconBounds.y - iconBounds.height / 2)).toBeLessThan(0.5);
      }
      const options = panel.getByRole('button', { name: 'Opciones', exact: true });
      await options.focus();
      await page.keyboard.press('Enter');
      await expect(panel.getByRole('status')).toHaveText('Opciones: demostración local.');
      await page.keyboard.press('Tab');
      await expect(panel.getByRole('button', { name: 'Cerrar', exact: true })).toBeFocused();
      await expect(panel.getByRole('button', { name: 'Cerrar', exact: true })).not.toHaveCSS('box-shadow', 'none');
      await page.keyboard.press('Space');
      await expect(panel.getByRole('status')).toHaveText('Cerrar: demostración local.');
      const remove = panel.getByRole('button', { name: 'Eliminar', exact: true });
      await remove.focus();
      await page.keyboard.press('Tab');
      const refresh = panel.getByRole('button', { name: 'Actualizar', exact: true });
      await expect(refresh).toBeFocused();
      await expect(panel.getByRole('button', { name: 'Eliminar deshabilitado' })).toBeDisabled();
      await page.keyboard.press('Enter');
      await expect(refresh).toBeDisabled();
      await expect(refresh).toHaveAttribute('aria-busy', 'true');
      await expect(refresh.locator('svg')).toHaveCount(1);
      await expect(refresh).toHaveCSS('width', '44px');
      await expect(refresh).toHaveCSS('height', '44px');
      await expect(refresh).toBeEnabled();
      await expect(panel.getByRole('status')).toContainText('Demostración terminada');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(apiRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`icon-buttons-${width}.png`), fullPage: true });
  });

  test(`Feature: Standard buttons — Scenario: Isolated visual review at ${width}px (AC79)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    const apiRequests: string[] = [];
    await page.route('**/api/**', route => {
      apiRequests.push(route.request().url());
      return route.abort();
    });
    await page.goto('/tests/ui/button-review.html');
    await expect(page.getByRole('heading', { name: 'Botones · HomePilot' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['oscuro', 'claro']) {
      const panel = page.getByRole('region', { name: `Tema ${theme}` });
      const buttons = panel.getByRole('button');
      for (const button of await buttons.all()) {
        const bounds = await button.boundingBox();
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
        await expect(button).toHaveCSS('border-radius', '12px');
        await expect(button).toHaveCSS('font-size', '14px');
      }
      const icon = panel.getByRole('button', { name: 'Configuración' });
      await expect(icon).toHaveCSS('width', '44px');
      await expect(icon).toHaveCSS('height', '44px');
      await panel.getByRole('button', { name: 'Probar carga' }).click();
      const pending = panel.getByRole('button', { name: 'Guardando…' });
      await expect(pending).toBeDisabled();
      await expect(pending).toHaveAttribute('aria-busy', 'true');
      await expect(panel.getByRole('button', { name: 'Probar carga' })).toBeEnabled();
      await expect(panel.getByRole('status')).toContainText('Demostración terminada');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(apiRequests).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`buttons-${width}.png`), fullPage: true });
  });
}
