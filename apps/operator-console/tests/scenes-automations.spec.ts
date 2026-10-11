import { expect, test } from '@playwright/test';
import { mdiAutoFix, mdiHome, mdiRobot, mdiWeatherWindy } from '@mdi/js';
import {
  dashboardUser,
  responsiveDevices,
  responsiveDashboard,
  prepareAuthenticatedDashboard,
  favoriteAutomationRules,
} from './helpers/responsiveShell';

for (const width of [360, 768, 1440]) {
  test(`Feature: Modular routines selector — Scenario: Shared geometry and navigation at ${width}px (AC79)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/scenes', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/automations', route => route.fulfill({ json: [] }));
    await page.goto('/routines/scenes');
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['dark', 'light']) {
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      const group = page.getByRole('main').getByRole('radiogroup', { name: /^(Rutinas|Routines)$/i });
      await expect(group.getByRole('radio')).toHaveCount(2);
      for (const option of await group.getByRole('radio').all()) {
        await expect(option).toHaveCSS('min-height', '44px');
        await expect(option).toHaveCSS('font-size', '14px');
        await expect(option).toHaveCSS('border-radius', '12px');
        await expect(option.locator('span')).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const scenes = group.getByRole('radio', { name: /^(Escenas|Scenes)$/i });
      await scenes.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page).toHaveURL(/\/routines\/automations$/);
      await expect(group.getByRole('radio', { name: /^(Automatizaciones|Automations)$/i })).toHaveAttribute('aria-checked', 'true');
      await page.screenshot({ path: testInfo.outputPath(`routines-selector-${theme}-${width}.png`), fullPage: true });
      await page.goto('/routines/scenes');
    }
  });
}

test('Feature: Routine sharing — Scenario: A recipient can execute and favorite but never manage shared routines', async ({ page }) => {
  await prepareAuthenticatedDashboard(page, responsiveDashboard, { ...dashboardUser, id: 'recipient' });
  await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'home', ownerId: 'owner', name: 'Casa compartida' }] }));
  await page.route('**/api/v1/rooms', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/homes/home/rooms', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/scenes', route => route.fulfill({ json: [{ id: 'shared-scene', userId: 'owner', sharedUserIds: ['recipient'], homeId: 'home', roomId: null, name: 'Escena compartida', actions: [] }] }));
  await page.route('**/api/v1/automations', route => route.fulfill({ json: [{ id: 'shared-rule', userId: 'owner', sharedUserIds: ['recipient'], homeId: 'home', name: 'Rutina compartida', enabled: true, trigger: { type: 'time', timeLocal: '19:00' }, action: { type: 'execute_scene', sceneId: 'shared-scene' } }] }));
  for (const routine of [{ collection: 'scenes', id: 'shared-scene', name: 'Escena compartida', endpoint: 'execute', key: 'sceneIds' }, { collection: 'automations', id: 'shared-rule', name: 'Rutina compartida', endpoint: 'run', key: 'automationIds' }]) {
    let favorites: string[] = [];
    let runs = 0;
    await page.route(`**/api/v1/${routine.collection}/favorites`, route => {
      if (route.request().method() === 'PUT') favorites = route.request().postDataJSON()[routine.key];
      return route.fulfill({ json: { [routine.key]: favorites, initialized: true } });
    });
    await page.route(`**/api/v1/${routine.collection}/${routine.id}/${routine.endpoint}`, route => { runs += 1; return route.fulfill({ json: { success: true, status: 'success' } }); });
    await page.goto(`/routines/${routine.collection}`);
    const card = page.getByRole('article', { name: routine.name, exact: true });
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: /^(Edit|Editar|Delete|Eliminar)$/i })).toHaveCount(0);
    if (routine.collection === 'automations') await expect(card.getByRole('button', { name: /Enable or pause|Activar o pausar/i })).toBeDisabled();
    await card.getByRole('button', { name: /^(Run|Execute|Ejecutar|Run now|Ejecutar ahora)$/i }).click();
    await expect.poll(() => runs).toBe(1);
    await card.getByRole('button', { name: /^(Add to favorites|Añadir a favoritas)$/i }).click();
    await expect.poll(() => favorites).toEqual([routine.id]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('Feature: Unified scene favorites — Scenario: Delayed favorites show a skeleton and toggling never moves cards (AC51 AC52)', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'responsive-home', name: 'Casa', ownerId: dashboardUser.id }] }));
  const scenes = ['Trabajo', 'Descanso', 'Noche'].map((name, index) => ({ id: `single-${index}`, homeId: 'responsive-home', roomId: null, name, actions: [] }));
  await page.route('**/api/v1/scenes', route => route.fulfill({ json: scenes }));
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let favorites = ['single-1'];
  await page.route('**/api/v1/scenes/favorites', async route => {
    await gate;
    if (route.request().method() === 'PUT') favorites = route.request().postDataJSON().sceneIds;
    await route.fulfill({ json: { sceneIds: favorites, initialized: true } });
  });
  await page.goto('/routines/scenes');
  await expect(page.locator('[role="status"][aria-busy="true"]')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  release();
  await expect(page.getByRole('article')).toHaveCount(3);
  const titles = () => page.getByRole('article').getByRole('heading').allTextContents();
  expect(await titles()).toEqual(['Trabajo', 'Descanso', 'Noche']);
  await page.getByRole('article', { name: 'Trabajo', exact: true }).getByRole('button', { name: /Add to favorites|Añadir a favoritas/i }).click();
  await expect.poll(() => favorites).toEqual(['single-1', 'single-0']);
  expect(await titles()).toEqual(['Trabajo', 'Descanso', 'Noche']);
});

for (const viewport of [{ name: 'mobile', width: 320, height: 720 }, { name: 'tablet portrait', width: 768, height: 1024 }, { name: 'tablet landscape', width: 1024, height: 768 }]) {
  test(`Feature: Automation device groups — Scenario: A hundred identities stay searchable and keyboard reachable on ${viewport.name} (AC53)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    const rooms = [{ id: 'oficina', homeId: 'responsive-home', name: 'Oficina' }, { id: 'cocina', homeId: 'responsive-home', name: 'Cocina' }];
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: rooms }));
    const devices = Array.from({ length: 100 }, (_, index) => ({ ...responsiveDevices[0], id: `group-device-${index}`, name: `Dispositivo ${String(index).padStart(2, '0')}`, roomId: index < 40 ? 'oficina' : index < 99 ? 'cocina' : null, semanticType: 'light', capabilities: [{ type: 'light', name: 'Light', commands: [{ name: 'turn_on' }, { name: 'turn_off' }] }] }));
    await page.route('**/api/v1/devices', route => route.fulfill({ json: [...devices].reverse() }));
    const rule = { id: 'group-rule', userId: dashboardUser.id, name: 'Trabajo', enabled: true, trigger: { type: 'device_state_changed', deviceId: devices[0].id, stateKey: 'state', expectedValue: 'on' }, action: { type: 'device_command', targetDeviceId: devices[0].id, command: 'turn_on' } };
    await page.route('**/api/v1/automations', route => route.fulfill({ json: [rule] }));
    await page.route('**/api/v1/scenes', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/automations/favorites', route => route.fulfill({ json: { automationIds: [], initialized: true } }));
    await page.goto('/routines/automations');
    await page.getByRole('button', { name: /^(Editar|Edit)$/i }).click();
    const editor = page.getByRole('dialog', { name: /Refinar Automatización|Refine Automation/i });
    await page.evaluate(() => document.fonts.ready);
    const nameField = editor.getByLabel(/naming this automation|nombrar esta automatizaci[oó]n/i);
    const expectedField = editor.getByLabel(/^(Expected Value|Valor Esperado)$/i);
    for (const theme of ['dark', 'light']) {
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      for (const field of [nameField, expectedField]) {
        await expect(field).toHaveCSS('height', '44px');
        await expect(field).toHaveCSS('border-radius', '12px');
        await expect(field).toHaveCSS('font-size', '15px');
      }
      expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`automation-fields-${theme}-${viewport.name.replaceAll(' ', '-')}.png`) });
    }
    await expectedField.fill('off');
    await expect(expectedField).toHaveValue('off');
    await editor.getByRole('button', { name: /Source Device|Dispositivo origen/i }).click();
    const picker = page.getByRole('dialog', { name: /Source Device|Dispositivo origen/i });
    const list = picker.getByRole('listbox');
    expect(await list.getByRole('group').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')))).toEqual(['Cocina', 'Oficina']);
    await expect(list.getByRole('option')).toHaveCount(99);
    await expect(list.getByRole('option', { name: /Dispositivo 99/ })).toHaveCount(0);
    await picker.getByRole('searchbox').fill('Oficina');
    await expect(list.getByRole('option')).toHaveCount(40);
    await picker.getByRole('searchbox').fill('light');
    await expect(list.getByRole('option')).toHaveCount(99);
    await picker.getByRole('searchbox').fill('');
    await picker.getByRole('searchbox').press('ArrowDown');
    await page.keyboard.press('End');
    const last = list.getByRole('option', { name: /Dispositivo 39/ });
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(picker).not.toBeVisible();
    await expect(editor.getByRole('button', { name: /Source Device|Dispositivo origen/i })).toContainText('Dispositivo 39');
    await editor.getByRole('button', { name: /Target Device|Dispositivo destino/i }).click();
    const actionPicker = page.getByRole('dialog', { name: /Target Device|Dispositivo destino/i });
    await actionPicker.getByRole('searchbox').fill('Oficina');
    await expect(actionPicker.getByRole('option')).toHaveCount(40);
    await expect(actionPicker.getByRole('option', { name: /Dispositivo 00/ })).toContainText('light');
    await page.screenshot({ path: testInfo.outputPath(`automation-grouped-${viewport.name.replaceAll(' ', '-')}.png`) });
  });
}

for (const viewport of [
  { name: 'mobile portrait', width: 320, height: 720 },
  { name: 'mobile landscape', width: 844, height: 390 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'kiosk portrait', width: 1080, height: 1920 },
  { name: 'kiosk landscape', width: 1920, height: 1080 },
]) {
  test(`Feature: Compact automation cards — Scenario: Independent controls fit ${viewport.name} (AC50)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    let rule = { id: 'compact-rule', userId: dashboardUser.id, name: 'Trabajo automático', enabled: true, trigger: { type: 'time', timeLocal: '19:00' }, action: { type: 'execute_scene', sceneId: 'work-scene' } };
    await page.route('**/api/v1/automations', route => route.fulfill({ json: [rule] }));
    await page.route('**/api/v1/scenes', route => route.fulfill({ json: [{ id: 'work-scene', name: 'Trabajo', actions: [] }] }));
    let favorites: string[] = [];
    await page.route('**/api/v1/automations/favorites', route => {
      if (route.request().method() === 'PUT') favorites = route.request().postDataJSON().automationIds;
      return route.fulfill({ json: { automationIds: favorites, initialized: true } });
    });
    let runs = 0;
    let toggles = 0;
    let finish: () => void = () => {};
    const gate = new Promise<void>(resolve => { finish = resolve; });
    await page.route('**/api/v1/automations/compact-rule/run', async route => {
      runs += 1;
      await gate;
      await route.fulfill({ json: { success: true } });
    });
    await page.route('**/api/v1/automations/compact-rule/disable', route => {
      toggles += 1;
      rule = { ...rule, enabled: false };
      return route.fulfill({ json: rule });
    });
    await page.goto('/routines/automations');
    const card = page.getByRole('article', { name: rule.name, exact: true });
    await expect(card).toBeVisible();
    for (const theme of ['dark', 'light']) {
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      const geometry = await card.evaluate(element => ({ width: element.offsetWidth, height: element.offsetHeight, overflow: element.scrollWidth > element.clientWidth }));
      expect(geometry.width).toBeLessThanOrEqual(320);
      expect(geometry.height).toBeLessThan(300);
      expect(geometry.overflow).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      for (const button of await card.getByRole('button').all()) {
        await expect(button).toBeVisible();
        const size = await button.evaluate(element => ({ width: element.offsetWidth, height: element.offsetHeight }));
        expect(size.width).toBeGreaterThanOrEqual(44);
        expect(size.height).toBeGreaterThanOrEqual(44);
      }
      if (viewport.name === 'desktop' || viewport.name === 'mobile portrait') await page.screenshot({ path: testInfo.outputPath(`automation-cards-${theme}.png`), animations: 'disabled' });
    }
    await card.getByRole('heading', { name: rule.name }).click();
    expect(runs).toBe(0);
    const execute = card.getByRole('button', { name: /^(Ejecutar ahora|Run now)$/i });
    await execute.focus();
    await page.keyboard.press('Enter');
    await expect(execute).toHaveAttribute('aria-busy', 'true');
    await expect(execute).toBeDisabled();
    await expect.poll(() => runs).toBe(1);
    await page.keyboard.press('Enter');
    expect(runs).toBe(1);
    finish();
    await expect(card.getByRole('status')).toHaveText(/Ejecutada|Completed/i);
    const schedule = card.getByRole('button', { name: /Activar o pausar|Enable or pause/i });
    await expect(schedule).toHaveAttribute('aria-pressed', 'true');
    expect(toggles).toBe(0);
    await schedule.click();
    await expect(schedule).toHaveAttribute('aria-pressed', 'false');
    expect(toggles).toBe(1);
    await card.getByRole('button', { name: /^(Añadir a favoritas|Add to favorites)$/i }).click();
    await expect.poll(() => favorites).toEqual(['compact-rule']);
    expect(runs).toBe(1);
    await card.getByRole('button', { name: /^(Editar|Edit)$/i }).click();
    const editor = page.getByRole('dialog', { name: /Refinar Automatización|Refine Automation/i });
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: /^(Cerrar|Close)$/i }).click();
    await expect(editor).not.toBeVisible();
    await card.getByRole('button', { name: /^(Eliminar|Delete)$/i }).click();
    await expect(page.getByRole('dialog', { name: /Eliminar Automatización|Delete Automation/i })).toBeVisible();
    expect(runs).toBe(1);
  });
}

test('Feature: Stable scene cards — Scenario: Compact from first frame before favorites settle (AC49)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
  await page.route('**/api/v1/scenes', route => route.fulfill({ json: [{ id: 'stable-scene', homeId: 'responsive-home', name: 'Trabajo', roomId: null, actions: [] }] }));
  let finish: () => void = () => {};
  const gate = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/v1/scenes/favorites', async route => {
    await gate;
    await route.fulfill({ json: { sceneIds: ['stable-scene'], initialized: true } });
  });
  await page.addInitScript(() => {
    const frames: { width: number; height: number }[] = [];
    Object.assign(window, { sceneFrames: frames });
    const record = () => {
      for (const article of document.querySelectorAll('article')) if (article.textContent?.includes('Trabajo')) {
        const bounds = article.getBoundingClientRect();
        frames.push({ width: bounds.width, height: bounds.height });
      }
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  await page.goto('/routines/scenes');
  const card = page.getByRole('article', { name: 'Trabajo', exact: true });
  await expect(page.getByRole('status', { name: /Loading|Cargando/i })).toHaveAttribute('aria-busy', 'true');
  await expect(card).toHaveCount(0);
  finish();
  await expect(card.getByRole('button', { name: /Quitar de favoritas|Remove from favorites/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status', { name: /Loading|Cargando/i })).toHaveCount(0);
  const frames = await page.evaluate(() => (window as unknown as { sceneFrames: { width: number; height: number }[] }).sceneFrames);
  expect(frames.length).toBeGreaterThan(0);
  expect(Math.max(...frames.map(frame => frame.width))).toBeLessThanOrEqual(320);
  expect(Math.max(...frames.map(frame => frame.height))).toBeLessThan(160);
});

for (const route of ['scenes', 'automations']) {
  test(`Feature: Reusable collection empty state — Scenario: ${route} has one creation control (AC50)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', request => request.fulfill({ json: [{ id: 'responsive-home', name: 'Casa', ownerId: dashboardUser.id }] }));
    await page.route('**/api/v1/scenes', request => request.fulfill({ json: [] }));
    await page.route('**/api/v1/automations', request => request.fulfill({ json: [] }));
    await page.goto(`/routines/${route}`);
    const title = route === 'scenes' ? /Aún no tienes escenas|No scenes yet/i : /Aún no tienes automatizaciones|No automations yet/i;
    const empty = page.getByRole('status').filter({ has: page.getByRole('heading', { name: title }) });
    await expect(empty).toBeVisible();
    await expect(empty.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: route === 'scenes' ? /^(Crear escena|Create scene)$/i : /^(Crear regla|Create rule)$/i })).toHaveCount(1);
    for (const light of [false, true]) {
      await page.evaluate(value => document.documentElement.classList.toggle('light', value), light);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`empty-${route}-${light ? 'light' : 'dark'}.png`), animations: 'disabled' });
    }
  });
}

test('Feature: Compact automation cards — Scenario: Execution errors permit retry without changing the schedule (AC50)', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  const rule = { id: 'retry-rule', userId: dashboardUser.id, name: 'Rutina pausada', enabled: false, trigger: { type: 'time', timeLocal: '19:00' }, action: { type: 'device_command', targetDeviceId: 'cover-living', command: 'open' } };
  await page.route('**/api/v1/automations', route => route.fulfill({ json: [rule] }));
  await page.route('**/api/v1/scenes', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/automations/favorites', route => route.fulfill({ json: { automationIds: [], initialized: true } }));
  let runs = 0;
  let toggles = 0;
  await page.route('**/api/v1/automations/retry-rule/run', route => {
    runs += 1;
    return runs === 1 ? route.fulfill({ status: 502, json: { message: 'Device unavailable' } }) : route.fulfill({ json: { success: true } });
  });
  await page.route('**/api/v1/automations/retry-rule/enable', route => { toggles += 1; return route.fulfill({ json: rule }); });
  await page.goto('/routines/automations');
  const card = page.getByRole('article', { name: rule.name });
  const execute = card.getByRole('button', { name: /^(Ejecutar ahora|Run now)$/i });
  await execute.click();
  await expect(page.getByRole('alert')).toContainText('Device unavailable');
  await expect(execute).toBeEnabled();
  await expect(card.getByRole('button', { name: /Activar o pausar|Enable or pause/i })).toHaveAttribute('aria-pressed', 'false');
  await execute.click();
  await expect(card.getByRole('status')).toHaveText(/Ejecutada|Completed/i);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(runs).toBe(2);
  expect(toggles).toBe(0);
});

test('Feature: scene favorites — a legacy local favorite migrates once and the server remains authoritative', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('legacy-favorites-seeded')) return;
    localStorage.setItem('hp_fav_scenes', JSON.stringify(['favorite-scene']));
    sessionStorage.setItem('legacy-favorites-seeded', '1');
  });
  await prepareAuthenticatedDashboard(page);
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
  await page.route('**/api/v1/settings/home-personalization', (route) => route.fulfill({
    json: {
      morningPhrase: '',
      afternoonPhrase: '',
      nightPhrase: '',
      heroImages: [],
    },
  }));
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({
    json: {
      current: {
        temperature_2m: 19,
        weather_code: 0,
        wind_speed_10m: 3,
        time: '2026-10-05T12:34',
      },
    },
  }));
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
  await expect(grid).toBeVisible();
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
      id: `compact-scene-${index}`, userId: dashboardUser.id, homeId: 'responsive-home', roomId: null,
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
    await editor.getByRole('button', { name: /^(Cancelar|Cancel)$/i }).click();
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
    let scene = { id: 'organized-scene', userId: dashboardUser.id, sharedUserIds: [] as string[], homeId: 'responsive-home', roomId: null, name: 'Trabajo organizada', description: 'Descripción conservada', actions: [{ deviceId: 'chosen', command: 'turn_off' }, { deviceId: 'unassigned', command: 'turn_on' }] };
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
    await expect(office.locator('..')).not.toHaveAttribute('open');
    await editor.getByRole('checkbox', { name: 'Ana', exact: true }).check();
    await editor.getByRole('checkbox', { name: 'Luis', exact: true }).check();
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
    await expect(page.getByRole('listbox').getByRole('option', { name: /^(Sin espacio|Unassigned space)$/i })).toHaveCount(0);
    await page.getByRole('listbox').getByRole('option', { name: /^Cocina$/i }).click();
    await expect(available.getByRole('button', { name: /Luz huérfana|Luz sin asignar/ })).toHaveCount(0);
    await expect(selected.getByRole('button', { name: /Zeta elegida/ })).toHaveAttribute('aria-pressed', 'true');
    if (viewport.name === 'desktop' || viewport.name === 'mobile') {
      await editor.screenshot({ path: testInfo.outputPath('scene-editor.png') });
    }
    await editor.getByRole('button', { name: /^(Guardar Escena|Save Scene)$/i }).click();
    await expect.poll(() => saved).toBe(true);
    expect(scene.roomId).toBeNull();
    expect(scene.description).toBe('Descripción conservada');
    expect(scene.sharedUserIds).toEqual(['share-recipient', 'share-recipient-2']);
    expect(scene.actions).toEqual([
      { deviceId: 'chosen', command: 'turn_off' }, { deviceId: 'unassigned', command: 'turn_on' }, { deviceId: 'office-19', command: 'turn_on' },
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
    id: 'scene-icon', userId: dashboardUser.id, homeId: 'responsive-home', roomId: null, name: 'Escena icono',
    actions: [{ deviceId: 'cover-living', command: 'open' }], icon: undefined as string | undefined,
  };
  let automation = {
    id: 'automation-icon', userId: dashboardUser.id, homeId: 'responsive-home', name: 'Auto icono', enabled: true,
    sharedUserIds: [] as string[],
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
  await automationEditor.getByRole('checkbox', { name: 'Ana', exact: true }).check();
  await automationEditor.getByRole('checkbox', { name: 'Luis', exact: true }).check();
  await automationEditor.getByRole('button', { name: /^(Icono|Icon)$/i }).click();
  await picker.getByRole('searchbox').fill('weather windy');
  await picker.getByRole('listbox').getByRole('option', { name: 'weather-windy', exact: true }).click();
  await automationEditor.getByRole('button', { name: /^(Confirmar Automatización|Confirm Automation)$/i }).click();
  expect(automation.icon).toBe('mdi:weather-windy');
  expect(automation.sharedUserIds).toEqual(['share-recipient', 'share-recipient-2']);
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
  await page.route('**/api/v1/rooms', (route) => route.fulfill({ json: [{ id: 'responsive-room', homeId: 'responsive-home', name: 'Sala' }] }));
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [{
    id: 'scene-light', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Scene light', type: 'light', semanticType: 'light', status: 'ASSIGNED', lastKnownState: null,
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
  await sceneEditor.getByRole('textbox', { name: /^(Nombre|Name)$/i }).fill('Escena nueva');
  await sceneEditor.getByRole('button', { name: /^(Icono|Icon)$/i }).click();
  const picker = page.getByRole('dialog', { name: /^(Icono|Icon)$/i });
  await picker.getByRole('searchbox').fill('home');
  await picker.getByRole('listbox').getByRole('option', { name: 'home', exact: true }).click();
  await sceneEditor.locator('summary').filter({ hasText: 'Sala' }).click();
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
  await page.route('**/api/v1/rooms', (route) => route.fulfill({ json: [{ id: 'responsive-room', homeId: 'responsive-home', name: 'Sala' }] }));
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [
    { id: 'identity-light', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Luz de sala', type: 'light', status: 'ASSIGNED' },
    { id: 'identity-switch', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Interruptor de sala', type: 'switch', status: 'ASSIGNED' },
    { id: 'identity-sensor', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Sensor de sala', type: 'sensor', status: 'ASSIGNED', capabilities: [{ type: 'sensor', name: 'Sensor' }] },
    { id: 'identity-cover', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Cortina de sala', type: 'cover', status: 'ASSIGNED' },
    { id: 'identity-camera', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Cámara de sala', type: 'camera', status: 'ASSIGNED' },
  ] }));
  await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/automations', (route) => route.fulfill({ json: [] }));

  await page.goto('/routines/scenes');
  await page.getByRole('button', { name: /^(Crear Escena|Create Scene)$/i }).first().click();
  const sceneEditor = page.getByRole('dialog', { name: /^(Crear Escena|Create Scene)$/i });
  await sceneEditor.locator('summary').filter({ hasText: 'Sala' }).click();
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
  await page.route('**/api/v1/rooms', (route) => route.fulfill({ json: [{ id: 'responsive-room', homeId: 'responsive-home', name: 'Sala' }] }));
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [
    { id: 'tv-action', homeId: 'responsive-home', roomId: 'responsive-room', name: 'On/Off tv', type: 'button', semanticType: 'light', status: 'ASSIGNED', capabilities: [{ type: 'button', name: 'Button', commands: [{ name: 'press' }] }] },
    { id: 'read-only', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Read only', type: 'sensor', semanticType: 'light', status: 'ASSIGNED', capabilities: [{ type: 'sensor', name: 'Sensor' }] },
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
  await sceneEditor.getByRole('textbox', { name: /^(Nombre|Name)$/i }).fill('Escena TV');
  await sceneEditor.locator('summary').filter({ hasText: 'Sala' }).click();
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
  await page.route('**/api/v1/rooms', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'responsive-room', homeId: 'responsive-home', name: 'Sala' }]),
    });
  });
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'light-1', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Living Room Light', type: 'light', status: 'ASSIGNED' }]),
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
  await expect(dialog.getByLabel(/naming this automation|nombrar esta automatizaci[oó]n/i)).toHaveCSS('height', '44px');
  await dialog.getByRole('radio', { name: /time|hora/i }).click();

  const deviceSelector = dialog.getByRole('button', { name: /^(Target Device|Dispositivo Objetivo)$/i });
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
