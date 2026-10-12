import { expect, test } from '@playwright/test';
import {
  setupStatus,
  dashboardUser,
  responsiveDevices,
  prepareAuthenticatedDashboard,
} from './helpers/responsiveShell';

for (const viewport of [
  { name: 'mobile', width: 320, height: 720 }, { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 }, { name: 'desktop', width: 1440, height: 900 },
  { name: 'kiosk portrait', width: 1080, height: 1920 },
]) {
  test(`Feature: Shared event filters — Scenario: Audit and execution names stay usable on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'es'));
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/devices', route => route.fulfill({ json: [{ id: 'gata', name: 'Gata', type: 'light', roomId: 'room', homeId: 'home', status: 'ASSIGNED', lastKnownState: { state: 'on' } }] }));
    await page.route('**/api/v1/activity-logs', route => route.fulfill({ json: [
      { timestamp: '2026-10-01T12:00:00Z', deviceId: 'gata', type: 'COMMAND_DISPATCHED', description: 'Gata command', data: { deviceName: 'Gata', command: 'turn_on', isAutomation: false, detail: 'x'.repeat(600) } },
      { timestamp: '2026-10-01T12:00:00Z', deviceId: 'other', type: 'COMMAND_DISPATCHED', description: 'Patio command', data: { deviceName: 'Patio', command: 'turn_off', isAutomation: false } },
    ] }));
    await page.route('**/api/v1/executions/recent?*', route => route.fulfill({ json: [
      { id: 'run-gata', sourceType: 'scene', sourceId: 'scene', status: 'success', startedAt: '2026-10-01T12:00:00Z', completedAt: '2026-10-01T12:00:01Z', durationMs: 1000, actionCount: 1, successCount: 1, failedCount: 0, skippedCount: 0, summary: 'Escena Gata', actions: [{ deviceId: 'gata', commandName: 'turn_on', status: 'success' }] },
      { id: 'run-patio', sourceType: 'manual', sourceId: 'other', status: 'success', startedAt: '2026-10-01T12:00:00Z', completedAt: '2026-10-01T12:00:01Z', durationMs: 1000, actionCount: 0, successCount: 0, failedCount: 0, skippedCount: 0, summary: 'Comando Patio', actions: [] },
    ] }));
    for (const path of ['/system/audit', '/system/executions']) {
      await page.goto(path);
      const main = page.getByRole('main');
      const search = main.getByRole('textbox', { name: 'Nombre', exact: true });
      await expect(search).toBeVisible();
      const date = await main.getByLabel('Fecha', { exact: true }).boundingBox();
      const action = await main.getByRole('button', { name: 'Acción', exact: true }).boundingBox();
      expect(date!.height).toBeCloseTo(action!.height, 1);
      if (viewport.width >= 640) expect(date!.y).toBeCloseTo(action!.y, 1);
      await search.fill('Gat');
      await expect(main.getByText(path.endsWith('audit') ? 'Gata' : 'Escena Gata', { exact: true })).toBeVisible();
      await expect(main.getByText(path.endsWith('audit') ? 'Patio' : 'Comando Patio', { exact: true })).toHaveCount(0);
      await search.fill('No existe');
      await expect(main.getByText('No hay eventos que coincidan con los filtros.', { exact: true })).toBeVisible();
      await search.fill('Gat');
      if (path.endsWith('audit')) {
        await main.locator('summary').click();
        const payload = main.locator('pre');
        await expect(payload).toBeVisible();
        expect(await payload.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
        await payload.evaluate(element => { element.scrollLeft = element.scrollWidth; });
        expect(await payload.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      if (viewport.name === 'mobile' || viewport.name === 'tablet portrait') await page.screenshot({ path: testInfo.outputPath(`${path.split('/').pop()}.png`), fullPage: true });
    }
  });
}

test('Feature: Automatic appearance — Scenario: Optional schedule switches at local boundaries and manual disables it', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/settings/home-personalization', route => route.fulfill({ json: { morningPhrase: '', afternoonPhrase: '', nightPhrase: '', heroImages: [] } }));
  await page.goto('/system/home-personalization');
  const selector = page.getByRole('button', { name: /Appearance|Apariencia/i });
  await expect(selector).toContainText(/Manual/i);
  const localStart = await page.evaluate(() => new Date(2026, 9, 1, 18, 29, 59).getTime());
  await page.clock.install({ time: localStart });
  await page.clock.pauseAt(localStart);
  await selector.click();
  await page.getByRole('listbox', { name: /Appearance|Apariencia/i }).getByRole('option', { name: /^(Automatic|Automático)\b/i }).click();
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.clock.fastForward(1000);
  await expect(page.locator('html')).not.toHaveClass(/light/);
  await page.clock.fastForward(11.5 * 60 * 60 * 1000);
  await expect(page.locator('html')).toHaveClass(/light/);
  // The existing inactivity policy returns to Home while the clock advances overnight.
  await page.clock.resume();
  await page.goto('/system/home-personalization');
  await expect(selector).toContainText(/Automatic|Automático/i);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
  await selector.click();
  await page.getByRole('option', { name: 'Manual', exact: true }).click();
  await page.clock.fastForward(12.5 * 60 * 60 * 1000);
  await expect(page.locator('html')).toHaveClass(/light/);
});

for (const viewport of [
  { name: 'mobile', width: 320, height: 720 }, { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 }, { name: 'desktop', width: 1920, height: 1080 },
]) {
  test(`Feature: Compact settings and loading — Scenario: Collections, personalization, HA and installation fit ${viewport.name} (AC61)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'es'));
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [] }));
    const main = page.getByRole('main');
    for (const collection of [{ path: '/routines/scenes', endpoint: '**/api/v1/scenes' }, { path: '/routines/automations', endpoint: '**/api/v1/automations' }]) {
      let release: () => void = () => {};
      const gate = new Promise<void>(resolve => { release = resolve; });
      await page.route(collection.endpoint, async route => { await gate; await route.fulfill({ json: [] }); });
      await page.goto(collection.path);
      const loading = main.getByRole('status', { name: /Cargando/i });
      await expect(loading).toBeVisible();
      const geometry = await loading.evaluate(element => {
        const grid = element.querySelector('[aria-hidden="true"]')!.lastElementChild!;
        const bounds = grid.getBoundingClientRect();
        const tiles = Array.from(grid.children).map(tile => tile.getBoundingClientRect()).filter(tile => tile.height > 0);
        return { width: bounds.width, height: bounds.height, gap: parseFloat(getComputedStyle(grid).columnGap), tiles: tiles.map(tile => ({ x: tile.x, y: tile.y, width: tile.width, height: tile.height })) };
      });
      expect(geometry.tiles.length).toBeGreaterThan(0);
      expect(new Set(geometry.tiles.map(tile => Math.round(tile.y))).size).toBe(1);
      const occupied = geometry.tiles.reduce((sum, tile) => sum + tile.width, 0) + (geometry.tiles.length - 1) * geometry.gap;
      expect(geometry.width - occupied).toBeLessThan(geometry.tiles[0]!.width + geometry.gap);
      expect(geometry.height).toBeLessThanOrEqual(geometry.tiles[0]!.height + 1);
      await page.screenshot({ path: testInfo.outputPath(`${collection.path.split('/').pop()}-loading.png`) });
      release();
      await expect(loading).not.toBeVisible();
      await page.unroute(collection.endpoint);
    }
    const settings = { morningPhrase: 'Frase completa. '.repeat(50), afternoonPhrase: 'Tarde tranquila', nightPhrase: 'Descansa', heroImages: Array.from({ length: 5 }, (_, i) => ({ slot: i + 1, url: `/test-home-${i + 1}.png` })) };
    await page.route('**/test-home-*.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') }));
    await page.route('**/api/v1/settings/home-personalization', route => route.fulfill({ json: settings }));
    await page.route('**/api/v1/settings/home-assistant', route => route.fulfill({ json: { baseUrl: 'http://192.0.2.1:8123', hasToken: true, maskedToken: '***', configurationStatus: 'configured', connectivityStatus: 'unknown', lastCheckedAt: null, activeSource: 'database' } }));
    await page.route('**/api/v1/settings/test-ha-connection', route => route.fulfill({ json: { success: true } }));
    await page.route('**/api/v1/system/features', route => route.fulfill({ json: { homeChat: true } }));
    await page.route('**/api/v1/system/setup-status', route => route.fulfill({ json: { ...setupStatus, installationProfile: 'bridge_ha', requiresHomeAssistant: true, runtimeTarget: 'docker_desktop', homeAssistantBridgeUrl: 'http://host.docker.internal:8123', homeAssistantSetupUrl: 'http://localhost:8123' } }));
    for (const theme of ['dark', 'light']) {
      await page.goto('/system/home-personalization');
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      const phrase = main.getByRole('textbox', { name: 'Frase de la mañana' });
      await expect(phrase).toHaveValue(settings.morningPhrase);
      expect(await phrase.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
      await expect(main.getByText('Fondo 1', { exact: true })).toBeVisible();
      await expect(main.getByRole('button', { name: 'Eliminar imagen 5', exact: true })).toBeVisible();
      await expect(main).not.toContainText('image_home_');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`personalization-${theme}.png`), fullPage: true });
      await page.goto('/system/ha');
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      const testButton = main.getByRole('button', { name: 'Probar conexión', exact: true });
      await expect(testButton).toBeEnabled();
      await testButton.click();
      await expect(main.getByText('Conexión correcta', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`ha-${theme}.png`), fullPage: true });
      await page.goto('/system/onboarding');
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      await page.getByRole('button', { name: 'Conectar mi Home Assistant', exact: true }).click();
      await page.getByRole('textbox', { name: 'URL para enlazar HomePilot', exact: true }).fill('http://192.0.2.1:8123');
      await page.getByLabel('Token de Acceso de Larga Duración', { exact: true }).fill('test-fixture-token');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.getByRole('button', { name: 'Probar Conexión', exact: true }).click();
      await page.getByRole('button', { name: 'Guardar y Continuar', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Finalizar Configuración e Iniciar Workspace', exact: true })).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`onboarding-${theme}.png`), fullPage: true });
    }
  });
}

for (const viewport of [{ name: 'mobile', width: 320, height: 720 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`Feature: Assigned compact insights — Scenario: Home, Assistant and Energy retain only operational readings on ${viewport.name} (AC60)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'es'));
    const room = { id: 'office', homeId: 'responsive-home', name: 'Oficina' };
    const devices = Array.from({ length: 7 }, (_, i) => ({ ...responsiveDevices[0], id: `assigned-${i}`, name: `Equipo ${i}`, roomId: room.id, externalId: `ha:sensor.energy_${i}` }));
    const pending = { ...responsiveDevices[0], id: 'pending', name: 'Pendiente de estancia', roomId: null, status: 'PENDING', externalId: 'ha:sensor.pending' };
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: room.homeId, name: 'Casa', ownerId: dashboardUser.id }] }));
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [room] }));
    await page.route('**/api/v1/devices', route => route.fulfill({ json: [...devices, pending] }));
    await page.route('**/api/v1/scenes', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/automations', route => route.fulfill({ json: [] }));
    const findings = [...devices, pending].map(device => ({
      id: `finding-${device.id}`, type: 'habit_pattern_detected', severity: 'medium', title: '', description: '',
      relatedEntityType: 'device', relatedEntityId: device.id, status: 'open', score: 1,
      metadata: { deviceName: device.name, timeWindow: '19:30' },
      actions: [{ type: 'configure_automation', label: 'assistant.actions.create_automation' }],
    }));
    const alert = { ...findings[7], id: 'missing-room-alert', type: 'device_missing_room', actions: [{ type: 'assign_room', label: 'assistant.actions.assign_room', payload: { deviceId: pending.id } }] };
    const assignments: Array<{ findingId: string; actionType: string; payload: { roomId: string } }> = [];
    await page.route('**/api/v1/assistant/actions', route => {
      assignments.push(route.request().postDataJSON());
      return route.fulfill({ json: { success: true } });
    });
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/assistant/findings', async route => { await gate; await route.fulfill({ json: [...findings, alert] }); });
    await page.route('**/api/v1/ha/entities?*', route => route.fulfill({ json: [
      { entityId: 'sensor.energy_0', friendlyName: 'Raw', state: '125', attributes: { unit_of_measurement: 'W' } },
      { entityId: 'sensor.energy_1', friendlyName: 'Raw', state: '4.5', attributes: { unit_of_measurement: 'kWh' } },
      { entityId: 'sensor.pending', friendlyName: pending.name, state: '900', attributes: { unit_of_measurement: 'W' } },
    ] }));
    await page.goto('/home');

    const homeLoading = page
      .getByRole('main')
      .getByRole('status', { name: /Cargando/i });

    await expect(homeLoading).toBeVisible();

    release();

    // DashboardView keeps HomeSkeleton visible until its initial snapshot,
    // findings, routines, personalization, favorites and home context settle.
    // Waiting for that UI contract is stronger than waiting for one HTTP
    // response because findings are filtered against the completed snapshot.
    await expect(homeLoading).not.toBeVisible();

    const initialInsights = page.getByRole('region', {
      name: 'Sugerencias Inteligentes',
      exact: true,
    });

    await expect(initialInsights.getByRole('article')).toHaveCount(5);

    for (const theme of ['dark', 'light']) {
      if (theme === 'light') {
        await page.goto('/home');
      }

      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      const insights = page.getByRole('region', { name: 'Sugerencias Inteligentes', exact: true });
      await expect(insights.getByRole('article')).toHaveCount(5);
      await expect(insights).not.toContainText(pending.name);
      await page.screenshot({ path: testInfo.outputPath(`home-insights-${theme}.png`), fullPage: true });
      await page.goto('/assistant');
      await page.getByRole('button', { name: 'Patrón de Hábito Detectado 7', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Crear automatización', exact: true })).toHaveCount(7);
      const assignmentAlert = page.getByRole('article', { name: pending.name, exact: true });
      await expect(assignmentAlert.getByRole('button', { name: /Asignar/i })).toBeVisible();
      await expect(assignmentAlert.getByRole('button', { name: 'Crear automatización', exact: true })).toHaveCount(0);
      await assignmentAlert.getByRole('button', { name: /Asignar/i }).click();
      const assignmentDialog = page.getByRole('dialog');
      const roomOption = assignmentDialog.getByRole('radio', { name: 'Oficina', exact: true });
      await expect(roomOption).toHaveCSS('border-radius', '28px');
      await expect(roomOption).toHaveAttribute('aria-checked', 'false');
      await roomOption.click();
      await expect(roomOption).toHaveAttribute('aria-checked', 'true');
      await assignmentDialog.getByRole('button', { name: /^(Confirmar|Confirm)$/i }).click();
      await expect(assignmentDialog).not.toBeVisible();
      expect(assignments[assignments.length - 1]).toEqual({ findingId: alert.id, actionType: 'assign_room', payload: { roomId: room.id } });
      await page.goto('/energy');
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Oficina', exact: true })).toBeVisible();
      await expect(main).toContainText('Equipo 0');
      await expect(main).toContainText('125 W');
      await expect(main).not.toContainText(pending.name);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`energy-${theme}.png`), fullPage: true });
    }
  });
}

for (const viewport of [{ name: 'mobile', width: 320, height: 720 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`Feature: Compact system presentation — Scenario: Suggestions and IP camera setup fit ${viewport.name} in both themes (AC59)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'es'));
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'responsive-home', name: 'Casa', ownerId: dashboardUser.id }] }));
    await page.route('**/api/v1/scenes', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/automations', route => route.fulfill({ json: [] }));
    const findings = ['Altavoz estudio', 'Lámpara entrada', 'Enchufe oficina'].map((name, i) => ({
      id: `finding-${i}`, type: 'habit_pattern_detected', severity: 'medium', title: '', description: '',
      relatedEntityId: `device-${i}`, relatedEntityType: 'device', status: 'open', score: 1,
      metadata: { deviceName: name, timeWindow: i === 0 ? '00:00' : '19:30' },
      actions: [{ type: 'configure_automation', label: 'assistant.actions.create_automation' }, { type: 'ignore', label: 'assistant.actions.ignore' }],
    }));
    await page.route('**/api/v1/assistant/findings', route => route.fulfill({ json: findings }));
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [{ id: 'office', homeId: 'responsive-home', name: 'Oficina' }] }));
    await page.route('**/api/v1/devices', route => route.fulfill({ json: findings.map((finding, index) => ({ ...responsiveDevices[0], id: finding.relatedEntityId, name: `Dispositivo ${index}`, roomId: 'office' })) }));
    const cameras = ['Entrada', 'Patio', 'Estudio'].map((name, i) => ({
      deviceId: `camera-${i}`, homeId: 'responsive-home', sourceType: 'onvif-ptz', name,
      host: `192.0.2.${i + 1}`, rtspPort: 554, onvifPort: 8000, rtspPath: '/stream', enabled: true, createdAt: '',
    }));
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/native-cameras?*', async route => { await gate; await route.fulfill({ json: { cameras } }); });
    await page.route('**/api/v1/native-cameras/discover', route => route.fulfill({ json: { devices: [] } }));
    for (const theme of ['dark', 'light']) {
      await page.goto('/assistant');
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      const group = page.getByRole('button', { name: 'Patrón de Hábito Detectado 3', exact: true });
      await expect(group).toHaveAttribute('aria-expanded', 'false');
      await group.click();
      await expect(group).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('heading', { name: 'Altavoz estudio', exact: true })).toBeVisible();
      await expect(page.getByText('Franja registrada · 00:00', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Crear automatización', exact: true })).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`assistant-${theme}.png`), fullPage: true, animations: 'disabled' });
      await group.click();
      await expect(page.getByRole('button', { name: 'Crear automatización', exact: true })).toHaveCount(0);
      await page.goto('/system/cameras');
      const main = page.getByRole('main');
      if (theme === 'dark') {
        await expect(main.locator('[aria-busy="true"][role="status"]')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('camera-skeleton.png') });
        release();
      }
      await expect(main.getByRole('article')).toHaveCount(3);
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      const camera = main.getByRole('article', { name: 'Entrada', exact: true });
      await expect(camera.getByRole('button', { name: 'Editar: Entrada', exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`cameras-${theme}.png`), fullPage: true, animations: 'disabled' });
      await camera.getByRole('button', { name: 'Editar: Entrada', exact: true }).click();
      const edit = page.getByRole('dialog');
      await expect(edit.getByRole('textbox', { name: 'Nombre de la cámara', exact: true })).toHaveValue('Entrada');
      await expect(edit.getByLabel(/Contraseña/)).toHaveValue('');
      await page.screenshot({ path: testInfo.outputPath(`camera-edit-${theme}.png`), animations: 'disabled' });
      await edit.getByRole('button', { name: /^(Cancelar|Cancel)$/i }).click();
      await expect(edit).toHaveCount(0);
      await main.getByRole('button', { name: 'Agregar cámara', exact: true }).click();
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      const create = page.getByRole('dialog');
      await expect(create.getByRole('textbox', { name: 'Nombre de la cámara', exact: true })).toHaveValue('');
      await expect(create.getByRole('textbox', { name: /Host|Dirección IP/ })).toBeVisible();
      const modalBounds = await create.boundingBox();
      expect(modalBounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(modalBounds!.height).toBeLessThanOrEqual(viewport.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await create.getByRole('button', { name: /^(Cancelar|Cancel)$/i }).click();
    }
  });
}

for (const viewport of [{ name: 'mobile', width: 320, height: 720 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`Feature: Diagnostics presentation — Scenario: Component skeletons and local timeline filters work on ${viewport.name} (AC58)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'es'));
    await page.route('**/api/v1/scenes', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/automations', route => route.fulfill({ json: [] }));
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/system/diagnostics', async route => {
      await gate;
      await route.fulfill({ json: { overallStatus: 'healthy', haConnectionStatus: 'reachable', websocketStatus: 'connected', automationEngineStatus: 'active', reconciliationStatus: 'idle', lastEventAt: null, lastReconnectAt: null, lastReconciliationAt: null, lastAutomationExecutionAt: null, systemTime: '2026-10-01T12:00:00Z', systemTimeLocal: '01/10/2026 07:00', systemTimezone: 'America/Guayaquil', counters: { recentReconnects: 0, recentAutomationSuccess: 1, recentAutomationFailures: 0, recentReconciliations: 0 }, issues: [] } });
    });
    await page.route('**/api/v1/system/backups', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/system/diagnostics/events', route => route.fulfill({ json: [
      { occurredAt: '2026-10-01T12:00:00Z', category: 'automation', eventType: 'AUTOMATION_EXECUTED', description: 'Rule ran', data: { ruleId: 'a', ruleName: 'Regla única' }, correlationId: 'rule' },
      { occurredAt: '2026-10-01T12:00:01Z', category: 'command', eventType: 'COMMAND_SUCCESS', description: 'Traza conservada', data: { deviceName: 'Gata' }, correlationId: 'rule' },
      { occurredAt: '2026-10-01T13:00:00Z', category: 'automation', eventType: 'SCENE_EXECUTED', description: 'Escena única', data: { sceneId: 's', sceneName: 'Escena única' } },
      { occurredAt: '2026-09-30T12:00:00Z', category: 'automation', eventType: 'AUTOMATION_EXECUTED', description: 'Comando único', data: { command: 'Comando único', isAutomation: false } },
    ] }));
    await page.goto('/system/diagnostics');
    const main = page.getByRole('main');
    const skeleton = main.locator('[role="status"][aria-busy="true"]');
    await expect(skeleton).toBeVisible();
    await expect(skeleton.getByRole('button')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('diagnostics-skeleton.png'), fullPage: true });
    release();
    await expect(skeleton).toHaveCount(0);
    await expect(main.getByText('Regla única', { exact: false })).toBeVisible();
    await expect(main.getByText('Automatización', { exact: true })).toBeVisible();
    const action = main.getByRole('button', { name: 'Acción', exact: true });
    for (const light of [false, true]) {
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), light);
      const dateInput = main.getByLabel('Fecha', { exact: true });
      await expect(main.getByText('Elegir fecha', { exact: true })).toBeVisible();
      const dateBounds = await dateInput.boundingBox();
      const actionBounds = await action.boundingBox();
      expect(dateBounds!.height).toBeCloseTo(actionBounds!.height, 1);
      expect(await dateInput.evaluate(element => getComputedStyle(element).colorScheme)).toBe(light ? 'light' : 'dark');
      await page.screenshot({ path: testInfo.outputPath(`date-${light ? 'light' : 'dark'}.png`), fullPage: true });
    }
    await action.click();
    await page.getByRole('option', { name: 'Escenas', exact: true }).click();
    await expect(main.getByText('Escena única', { exact: false })).toBeVisible();
    await expect(main.getByText('Regla única', { exact: false })).toHaveCount(0);
    await action.click();
    await page.getByRole('option', { name: 'Comandos', exact: true }).click();
    await expect(main.getByText('Comando único', { exact: false })).toBeVisible();
    await main.getByLabel('Fecha', { exact: true }).fill('2026-10-01');
    await expect(main.getByText('No hay eventos que coincidan con los filtros.', { exact: true })).toBeVisible();
    await main.getByLabel('Fecha', { exact: true }).fill('');
    await action.click();
    await page.getByRole('option', { name: 'Automatizaciones', exact: true }).click();
    await main.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Gat');
    await expect(main.getByText('Regla única', { exact: false })).toBeVisible();
    await main.getByText('Regla única', { exact: false }).click();
    await expect(main.getByText('Traza conservada', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('diagnostics-loaded.png'), fullPage: true });
  });
}

for (const view of [
  { name: 'Spaces', path: '/spaces', endpoint: '**/api/v1/homes', data: [] },
  { name: 'Users', path: '/system/users', endpoint: '**/api/v1/admin/users', data: [] },
  { name: 'Home Assistant', path: '/system/ha', endpoint: '**/api/v1/settings/home-assistant', data: { baseUrl: '', hasToken: false, maskedToken: '', configurationStatus: 'not_configured', connectivityStatus: 'unknown', lastCheckedAt: null, activeSource: 'none' } },
  { name: 'Personalization', path: '/system/home-personalization', endpoint: '**/api/v1/settings/home-personalization', data: { morningPhrase: '', afternoonPhrase: '', nightPhrase: '', heroImages: [] } },
  { name: 'Executions', path: '/system/executions', endpoint: '**/api/v1/executions/recent?*', data: [] },
  { name: 'Cameras', path: '/system/cameras', endpoint: '**/api/v1/native-cameras?*', data: [] },
  { name: 'Assistant', path: '/assistant', endpoint: '**/api/v1/assistant/findings', data: [] },
  { name: 'Audit', path: '/system/audit', endpoint: '**/api/v1/activity-logs', data: [] },
  { name: 'Device manager', path: '/system/devices', endpoint: '**/api/v1/devices', data: [] },
  { name: 'Discovery', path: '/system/inbox', endpoint: '**/api/v1/devices', data: [] },
  { name: 'System status', path: '/resilience-showcase', endpoint: '**/api/v1/automations', data: [] },
  { name: 'Energy', path: '/energy', endpoint: '**/api/v1/ha/entities?mode=all', data: [] },
  { name: 'Dashboards', path: '/dashboards', endpoint: '**/api/v1/dashboards', data: [] },
  { name: 'Diagnostics error', path: '/system/diagnostics', endpoint: '**/api/v1/system/diagnostics', data: { error: 'Unavailable' }, status: 503 },
]) {
  test(`Feature: Initial view skeletons — Scenario: ${view.name} keeps an accessible skeleton until its initial service settles (AC51)`, async ({ page }) => {
    await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/scenes', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/automations', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/system/diagnostics/events', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/system/backups', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'responsive-home', name: 'Casa', ownerId: dashboardUser.id }] }));
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let requested = false;
    await page.route(view.endpoint, async route => {
      requested = true;
      await gate;
      await route.fulfill({ status: 'status' in view ? view.status : 200, json: view.data });
    });
    await page.goto(view.path);
    await expect.poll(() => requested).toBe(true);
    const skeleton = page.getByRole('main').locator('[role="status"][aria-busy="true"]');
    await expect(skeleton).toBeVisible();
    await expect(skeleton.getByRole('button')).toHaveCount(0);
    release();
    await expect(skeleton).toHaveCount(0);
    await expect(page.getByRole('main')).toBeVisible();
  });
}

test('Feature: Initial view skeletons — Scenario: Home waits for favorites and settings but stays visible during refresh (AC51)', async ({ page }, testInfo) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api.open-meteo.com/**', route => route.fulfill({ json: { current: { temperature_2m: 19, weather_code: 3, wind_speed_10m: 1 } } }));
  const scene = { id: 'ready-scene', userId: dashboardUser.id, homeId: 'responsive-home', name: 'Trabajo', roomId: null, actions: [] };
  const automation = { id: 'ready-rule', userId: dashboardUser.id, name: 'Noche', enabled: true, trigger: { type: 'time', timeLocal: '19:00' }, action: { type: 'execute_scene', sceneId: scene.id } };
  let findingsRead = 0;
  let releaseRefresh: () => void = () => {};
  const refresh = new Promise<void>(resolve => { releaseRefresh = resolve; });
  await page.route('**/api/v1/scenes', route => route.fulfill({ json: [scene] }));
  await page.route('**/api/v1/assistant/findings', async route => {
    findingsRead += 1;
    if (findingsRead > 1) await refresh;
    await route.fulfill({ json: [] });
  });
  await page.route('**/api/v1/automations', route => route.fulfill({ json: [automation] }));
  await page.route('**/api/v1/scenes/favorites', route => route.fulfill({ json: { sceneIds: [scene.id], initialized: true } }));
  let releaseFavorites: () => void = () => {};
  const favorites = new Promise<void>(resolve => { releaseFavorites = resolve; });
  await page.route('**/api/v1/automations/favorites', async route => {
    await favorites;
    await route.fulfill({ json: { automationIds: [automation.id], initialized: true } });
  });
  let releaseSettings: () => void = () => {};
  const settings = new Promise<void>(resolve => { releaseSettings = resolve; });
  await page.route('**/api/v1/settings/home-personalization', async route => {
    await settings;
    await route.fulfill({ json: { morningPhrase: '', afternoonPhrase: '', nightPhrase: '', heroImages: [] } });
  });
  await page.route('**/api/v1/scenes/ready-scene/execute', route => route.fulfill({ json: { success: true } }));
  await page.goto('/');
  const skeleton = page.locator('[role="status"][aria-busy="true"]');
  await expect(skeleton).toBeVisible();
  await expect(page.getByTestId('favorite-routine-grid')).not.toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('home-initial-skeleton.png') });
  releaseSettings();
  await expect(skeleton).toBeVisible();
  releaseFavorites();
  const favoriteGrid = page.getByTestId('favorite-routine-grid');
  await expect(favoriteGrid).toBeVisible();
  await expect(favoriteGrid.getByRole('button')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('home-complete.png') });
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const hero = (await page.locator('.homepilot-home-hero').boundingBox())!;
    const watermark = (await page.locator('.homepilot-home-watermark').boundingBox())!;
    expect(watermark.x).toBeGreaterThanOrEqual(hero.x);
    expect(watermark.x).toBeLessThan(hero.x + hero.width / 2);
    const borderBottom = await page.locator('.homepilot-home-hero').evaluate(element => parseFloat(getComputedStyle(element).borderBottomWidth));
    expect(hero.y + hero.height - borderBottom - watermark.y - watermark.height).toBeCloseTo(16, 0);
  }
  await expect(skeleton).toHaveCount(0);
  await favoriteGrid.getByRole('button', { name: 'Run Trabajo', exact: true }).click();
  await expect.poll(() => findingsRead).toBeGreaterThan(1);
  await expect(favoriteGrid).toBeVisible();
  await expect(skeleton).toHaveCount(0);
  releaseRefresh();
});

test('Feature: Initial view skeletons — Scenario: Early favorites do not release Home before the actual catalog preferences settle (AC51)', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/automations', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/automations/favorites', route => route.fulfill({ json: { automationIds: [], initialized: true } }));
  await page.route('**/api/v1/settings/home-personalization', route => route.fulfill({ json: { morningPhrase: '', afternoonPhrase: '', nightPhrase: '', heroImages: [] } }));
  await page.route('**/api.open-meteo.com/**', route => route.fulfill({ json: { current: { temperature_2m: 19, weather_code: 3 } } }));
  const scene = { id: 'late-catalog-scene', userId: dashboardUser.id, homeId: 'responsive-home', name: 'Descanso', roomId: null, actions: [] };
  let releaseCatalog: () => void = () => {};
  const catalog = new Promise<void>(resolve => { releaseCatalog = resolve; });
  await page.route('**/api/v1/scenes', async route => {
    await catalog;
    await route.fulfill({ json: [scene] });
  });
  let releaseFavorites: () => void = () => {};
  const preferences = new Promise<void>(resolve => { releaseFavorites = resolve; });
  let reads = 0;
  let catalogReleased = false;
  let catalogPreferencesRequested = false;
  await page.route('**/api/v1/scenes/favorites', async route => {
    reads += 1;
    if (catalogReleased) {
      catalogPreferencesRequested = true;
      await preferences;
    }
    await route.fulfill({ json: { sceneIds: [scene.id], initialized: true } });
  });
  await page.goto('/');
  await expect.poll(() => reads).toBeGreaterThanOrEqual(1);
  catalogReleased = true;
  releaseCatalog();
  await expect.poll(() => catalogPreferencesRequested).toBe(true);
  await expect(page.locator('[role="status"][aria-busy="true"]')).toBeVisible();
  await expect(page.getByTestId('favorite-routine-grid')).not.toBeVisible();
  releaseFavorites();
  await expect(page.getByTestId('favorite-routine-grid').getByRole('button', { name: 'Run Descanso', exact: true })).toBeVisible();
  await expect(page.locator('[role="status"][aria-busy="true"]')).toHaveCount(0);
});

test('Feature: Initial view skeletons — Scenario: A favorites failure releases the skeleton instead of blocking Scenes (AC51)', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'responsive-home', name: 'Casa', ownerId: dashboardUser.id }] }));
  await page.route('**/api/v1/scenes', route => route.fulfill({ json: [{ id: 'offline-favorite', homeId: 'responsive-home', name: 'Trabajo', roomId: null, actions: [] }] }));
  await page.route('**/api/v1/scenes/favorites', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.goto('/routines/scenes');
  await expect(page.getByRole('article', { name: 'Trabajo', exact: true })).toBeVisible();
  await expect(page.locator('[role="status"][aria-busy="true"]')).toHaveCount(0);
});
