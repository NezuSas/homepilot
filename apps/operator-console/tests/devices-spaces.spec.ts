import { expect, test } from '@playwright/test';
import {
  enterDashboardEdit,
  setupStatus,
  viewports,
  dashboardUser,
  responsiveDevices,
  responsiveDashboard,
  waitForSettledLayout,
  prepareAuthenticatedDashboard,
} from './helpers/responsiveShell';

for (const width of [360, 768, 1440]) {
  test(`Feature: Modular modal fields — Scenario: View and profile consumers retain shared styling at ${width}px (AC79)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    let dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [] }] };
    await prepareAuthenticatedDashboard(page, dashboard);
    let profile = { ...dashboardUser };
    let profileWrites = 0;
    await page.route('**/api/v1/users', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/auth/sso/links', route => route.fulfill({ json: { links: [] } }));
    await page.route('**/api/v1/auth/me', route => {
      if (route.request().method() === 'PATCH') {
        expect(route.request().postDataJSON()).toEqual({ displayName: 'Nombre de prueba', avatarDataUri: null });
        profile = { ...profile, ...route.request().postDataJSON() };
        profileWrites++;
      }
      return route.fulfill({ json: profile });
    });
    await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [dashboard] }));
    await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
      if (route.request().method() === 'PATCH') dashboard = { ...dashboard, ...route.request().postDataJSON() };
      return route.fulfill({ json: dashboard });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    await enterDashboardEdit(page);
    await page.getByRole('button', { name: /Configure view:|Configurar vista:/i }).click();
    const dialog = page.getByRole('dialog');
    const title = dialog.getByRole('textbox', { name: /^(Title|Título)$/i });
    const route = dialog.getByRole('textbox', { name: /^(View route|Ruta de la vista)$/i });
    await expect(route).toHaveAttribute('readonly');
    for (const theme of ['dark', 'light']) {
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      await waitForSettledLayout(dialog);
      for (const field of [title, route]) {
        await expect(field).toHaveCSS('height', '44px');
        await expect(field).toHaveCSS('border-radius', '12px');
        await expect(field).toHaveCSS('font-size', '15px');
      }
      const choices = dialog.getByRole('radiogroup').getByRole('radio');
      await expect(choices).toHaveCount(3);
      for (const choice of await choices.all()) {
        expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await expect(choice.locator('span')).not.toHaveClass(/sr-only/);
        await expect(choice).toHaveCSS('font-size', '14px');
      }
      await choices.first().focus();
      await choices.first().press('End');
      await expect(choices.last()).toHaveAttribute('aria-checked', 'true');
      await choices.last().press('Home');
      await expect(title).toBeVisible();
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`view-fields-${theme}-${width}.png`), fullPage: true });
    }
    await title.fill('  Vista renovada  ');
    await expect(route).toHaveValue('vista-renovada');
    await dialog.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    await expect.poll(() => dashboard.tabs[0].title).toBe('Vista renovada');
    // The same shared input is used by the real profile modal. All writes here
    // are fulfilled by fixtures, never by a running API or device.
    const menuToggle = page.getByRole('main').getByRole('button', { name: /^(Show or hide menu|Mostrar u ocultar menú)$/i });
    if (await menuToggle.isVisible()) await menuToggle.click();
    await page.getByTitle(/^(My Profile|Mi Perfil)$/i).click();
    const profileDialog = page.getByRole('dialog', { name: /^(My Profile|Mi Perfil)$/i });
    const displayName = profileDialog.getByRole('textbox', { name: /^(Display Name|Nombre a Mostrar)$/i });
    await expect(displayName).toHaveValue(dashboardUser.displayName);
    await expect(displayName).toHaveAttribute('maxlength', '40');
    for (const theme of ['dark', 'light']) {
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      await waitForSettledLayout(profileDialog);
      await expect(displayName).toHaveCSS('height', '44px');
      await expect(displayName).toHaveCSS('border-radius', '12px');
      await expect(displayName).toHaveCSS('font-size', '15px');
      expect(await profileDialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`profile-fields-${theme}-${width}.png`), fullPage: true });
    }
    await displayName.fill('  Nombre de prueba  ');
    await profileDialog.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    await expect.poll(() => profileWrites).toBe(1);
    await expect(profileDialog).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
  test(`Feature: Room devices — Scenario: Shared compact controls and readings fit ${viewport.name} (AC16, AC24, AC25)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    const room = { id: 'room-compact', homeId: 'responsive-home', name: 'Kitchen' };
    const base = { homeId: room.homeId, roomId: room.id, status: 'ASSIGNED' };
    const devices = [
      { ...base, id: 'room-light', name: 'Desayunador blanca', type: 'light', lastKnownState: { on: false } },
      { ...base, id: 'room-action', name: 'On/Off TV', type: 'sensor', semanticType: 'light', lastKnownState: { state: 'unknown' }, capabilities: [{ type: 'button', name: 'Button', commands: [{ name: 'press' }] }] },
      { ...base, id: 'room-sensor', name: 'Temperatura Kitchen', type: 'sensor', lastKnownState: { state: '22.5', unit_of_measurement: '°C' } },
      { ...base, id: 'room-missing', name: 'Batería sin lectura', type: 'sensor', lastKnownState: { state: 'unavailable', unit_of_measurement: '%' } },
      { ...base, id: 'room-cover', name: 'Cortina Kitchen', type: 'cover', lastKnownState: { state: 'closed', current_position: 0 }, capabilities: [{ type: 'cover', name: 'Cover', commands: [{ name: 'open' }, { name: 'close' }, { name: 'stop' }] }] },
      { ...base, id: 'room-camera', name: 'Cámara Kitchen', type: 'camera', lastKnownState: null },
      { ...base, id: 'room-music', name: 'Speaker Kitchen', type: 'media_player', lastKnownState: { state: 'idle' } },
      { ...base, id: 'other-room', roomId: 'other', name: 'Luz de otra estancia', type: 'light', lastKnownState: { on: false } },
    ];
    const commands: { id: string; command: string }[] = [];
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: room.homeId, name: 'Casa', ownerId: dashboardUser.id }] }));
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [room] }));
    await page.route('**/api/v1/devices', route => route.fulfill({ json: devices }));
    await page.route('**/api/v1/devices/room-camera/camera/session*', route => route.fulfill({ status: 503, json: { error: 'Camera unavailable' } }));
    await page.route('**/api/v1/devices/*/command', async route => {
      const id = new URL(route.request().url()).pathname.split('/').at(-2)!;
      const command = route.request().postDataJSON().command;
      commands.push({ id, command });
      const device = devices.find(candidate => candidate.id === id)!;
      await route.fulfill({ json: { ...device, lastKnownState: id === 'room-light' ? { on: true } : device.lastKnownState } });
    });
    for (const theme of ['dark', 'light']) {
      await page.goto('/spaces');
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      await page.getByRole('button', { name: /Kitchen.*7 dispositivos|Kitchen.*7 devices/i }).click();
      const detail = page.getByRole('complementary', { name: /Detalle de la estancia|Room details|Detalle de estancia/i });
      await expect(detail).toBeVisible();
      await expect(detail).toContainText('23°C');
      await expect(detail).toContainText(/Sin lectura|No reading/i);
      await expect(detail.getByRole('heading', { name: /^Cortina Kitchen$/i })).toBeVisible();
      await expect(detail).toContainText('Cámara Kitchen');
      await expect(detail).not.toContainText('Luz de otra estancia');
      await expect(detail).not.toContainText('Iluminación');
      const lights = detail.getByRole('region', { name: /^(Luces|Lights)$/i });
      const sensors = detail.getByRole('region', { name: /^(Sensores|Sensors)$/i });
      const music = detail.getByRole('region', { name: /^(Multimedia|Media Player)$/i });
      await expect(lights).toContainText('Desayunador blanca');
      await expect(lights).toContainText('On/Off TV');
      await expect(lights).not.toContainText('Temperatura Kitchen');
      await expect(sensors).toContainText('Temperatura Kitchen');
      await expect(sensors).not.toContainText('Speaker Kitchen');
      await expect(music).toContainText('Speaker Kitchen');
      const light = detail.getByRole('button', { name: /Encender dispositivo: Desayunador blanca|Turn on device: Desayunador blanca/i });
      const action = detail.getByRole('button', { name: /On\/Off TV/i });
      await expect(light).toHaveAttribute('aria-pressed', 'false');
      await expect(action).not.toHaveAttribute('aria-pressed');
      for (const control of [light, action]) {
        const bounds = await control.boundingBox();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
        expect(bounds!.width).toBeLessThanOrEqual(176);
        expect(bounds!.height).toBeLessThanOrEqual(112);
      }
      await light.click();
      await expect(detail.getByRole('button', { name: /Apagar dispositivo: Desayunador blanca|Turn off device: Desayunador blanca/i })).toHaveAttribute('aria-pressed', 'true');
      await action.click();
      await expect(action).toHaveAttribute('data-action-state', 'success');
      await expect(action).toHaveAttribute('data-action-state', 'idle');
      expect(commands.slice(-2)).toEqual([{ id: 'room-light', command: 'turn_on' }, { id: 'room-action', command: 'press' }]);
      const search = detail.getByRole('textbox', { name: /Buscar dispositivos|Search devices/i });
      await search.fill('Batería');
      await expect(detail).toContainText('Batería sin lectura');
      await expect(detail.getByRole('button', { name: /On\/Off TV/i })).toHaveCount(0);
      await search.fill('');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
      if (['desktop', 'mobile portrait', 'tablet portrait'].includes(viewport.name)) {
        await page.screenshot({ path: testInfo.outputPath(`room-devices-${theme}.png`), fullPage: true });
      }
    }
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
  test(`Feature: Room display and configuration — Scenario: Operational controls stay in Spaces on ${viewport.name} (AC26, AC54)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    const room = { id: 'meeting', homeId: 'responsive-home', name: 'Sala de reuniones' };
    const base = { homeId: room.homeId, roomId: room.id, status: 'ASSIGNED' };
    const display = { ...base, id: 'board', name: 'Pizarra oficina', type: 'smart_display', semanticType: 'smart_display', integrationSource: 'android-display', lastKnownState: { connectionState: 'online' } };
    const camera = { ...base, id: 'meeting-camera', name: 'Cámara reuniones', type: 'camera', integrationSource: 'native-camera', lastKnownState: null };
    const light = { ...base, id: 'meeting-light', externalId: 'ha:light.meeting', name: 'Luz reuniones', type: 'light', lastKnownState: { on: false } };
    const command = { key: 'go_home', displayName: 'Inicio pizarra', implementationType: 'legacy_adb', controlType: 'button', visibility: 'visible', executableInHomePilot: true, dashboardEligible: true };
    const catalog = { deviceId: display.id, plan: { id: 1, name: 'Plan oficina', type: null }, commands: [command,
      { ...command, key: 'hidden', displayName: 'Comando oculto', visibility: 'hidden' },
      { ...command, key: 'volume', displayName: 'Volumen pizarra', controlType: 'slider', dashboardEligible: false },
      { ...command, key: 'pending', displayName: 'Comando pendiente', executableInHomePilot: false, dashboardEligible: false },
      ...Array.from({ length: 20 }, (_, i) => ({ ...command, key: `action_${i}`, displayName: `Acción pizarra ${i}` })),
    ] };
    const executions: string[] = [];
    let cameraSessions = 0;
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: room.homeId, name: 'Casa', ownerId: dashboardUser.id }] }));
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [room] }));
    await page.route('**/api/v1/devices', route => route.fulfill({ json: [display, camera, light] }));
    await page.route('**/api/v1/devices/meeting-light', route => route.fulfill({ json: light }));
    await page.route('**/api/v1/devices/meeting-light/activity-logs', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/devices/board/control-catalog', route => route.fulfill({ json: catalog }));
    await page.route('**/api/v1/devices/board/actions/*/execute', async route => {
      executions.push(new URL(route.request().url()).pathname);
      await route.fulfill({ json: display });
    });
    await page.route('**/api/v1/devices/meeting-camera/camera/session*', route => {
      cameraSessions++;
      return route.fulfill({ json: { snapshotPath: '/meeting-frame.png', streamPath: '/meeting-stream' } });
    });
    await page.route('**/meeting-frame.png*', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64') }));
    for (const theme of ['dark', 'light']) {
      cameraSessions = 0;
      await page.goto('/system/devices');
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      const manager = page.getByRole('main');
      await expect(manager.getByRole('heading', { name: camera.name, exact: true })).toBeVisible();
      await expect(manager.locator('img,video')).toHaveCount(0);
      await expect(manager.getByRole('button', { name: /pantalla completa|full screen|Encender|Turn on/i })).toHaveCount(0);
      expect(cameraSessions).toBe(0);
      const lightSummary = manager.getByRole('article').filter({ has: page.getByRole('heading', { name: light.name, exact: true }) });
      await lightSummary.getByRole('button', { name: /Gestionar dispositivo|Manage device/i }).click();
      const inspector = page.getByRole('dialog');
      await expect(inspector.getByText(/Función del dispositivo|Device function/i)).toBeVisible();
      await expect(inspector.getByRole('button', { name: /Forzar|Force|Alternar|Toggle/i })).toHaveCount(0);
      await inspector.getByRole('button', { name: /^(Cerrar|Close)$/i }).click();
      await expect(inspector).toHaveCount(0);
      await page.goto('/spaces');
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      await page.getByRole('button', { name: /Sala de reuniones.*3 dispositivos|Sala de reuniones.*3 devices/i }).click();
      const detail = page.getByRole('complementary', { name: /Detalle de.*estancia|Room details/i });
      await expect(detail.getByRole('button', { name: /pantalla completa|full screen/i })).toBeVisible();
      expect(cameraSessions).toBeGreaterThan(0);
      const board = detail.getByRole('region', { name: display.name, exact: true });
      await expect(board).not.toContainText('Comando oculto');
      await expect(board).toContainText('Volumen pizarra');
      await expect(board.getByRole('button', { name: /Volumen pizarra|Comando pendiente/i })).toHaveCount(0);
      const action = board.getByRole('button', { name: /Inicio pizarra/i });
      await expect(action).not.toHaveAttribute('aria-pressed');
      await action.click();
      await expect(action).toHaveAttribute('data-action-state', 'success');
      await expect(action).toHaveAttribute('data-action-state', 'idle');
      expect(executions.at(-1)).toBe('/api/v1/devices/board/actions/go_home/execute');
      const search = board.getByRole('textbox', { name: /Buscar comandos de la pizarra|Search display commands/i });
      await search.fill('Acción pizarra 19');
      await expect(board.getByRole('button', { name: /Acción pizarra 19/i })).toBeVisible();
      await search.fill('');
      const last = board.getByRole('button', { name: /Acción pizarra 19/i });
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      if (['desktop', 'tablet portrait', 'mobile portrait'].includes(viewport.name)) await page.screenshot({ path: testInfo.outputPath(`room-operational-${theme}.png`), fullPage: true });
    }
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
  test(`Feature: Compact device manager — Scenario: Filters and stable configuration drawer preserve scrolling on ${viewport.name} (AC54, AC77, AC78)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    const base = { homeId: 'responsive-home', roomId: 'responsive-room', status: 'ASSIGNED' };
    const light = { ...base, id: 'compact-light', name: 'Luz escritorio', type: 'light', externalId: 'ha:light.desk', integrationSource: 'sonoff', lastKnownState: { on: false } };
    const display = { ...base, id: 'compact-board', externalId: 'android-display:board', name: 'Pizarra oficina', type: 'smart_display', semanticType: 'smart_display', integrationSource: 'android-display' };
    const camera = { ...base, id: 'compact-camera', name: 'Cámara entrada', type: 'camera', integrationSource: 'native-camera' };
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [{ id: base.roomId, homeId: base.homeId, name: 'Oficina' }] }));
    await page.route('**/api/v1/devices', route => route.fulfill({ json: [light, display, camera] }));
    await page.route('**/api/v1/devices/*/activity-logs', route => route.fulfill({ json: [] }));
    let release: () => void = () => {};
    let requested = false;
    let gate: Promise<void>;
    await page.route('**/api/v1/devices/compact-light', async route => {
      requested = true;
      await gate;
      await route.fulfill({ json: light });
    });
    await page.route('**/api/v1/devices/compact-board', route => route.fulfill({ json: display }));
    await page.route('**/api/v1/devices/compact-board/control-catalog', route => route.fulfill({ json: {
      deviceId: display.id, plan: { id: 1, name: 'Plan oficina', type: null }, commands: [],
    } }));
    for (const theme of ['dark', 'light']) {
      requested = false;
      gate = new Promise<void>(resolve => { release = resolve; });
      await page.goto('/system/devices');
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      const manager = page.getByRole('main');
      const tile = manager.getByRole('article').filter({ has: page.getByRole('heading', { name: light.name, exact: true }) });
      await expect(tile).not.toContainText('Oficina');
      await expect(tile.getByRole('button')).toHaveCount(1);
      expect((await tile.boundingBox())?.height).toBeLessThanOrEqual(96);
      await expect(manager.getByText(/Modo Edge Activo|Edge mode active/i)).toHaveCount(0);
      const typeFilter = manager.getByRole('button', { name: /^(Tipo|Type)$/i });
      await typeFilter.click();
      let popup = page.getByRole('dialog', { name: /^(Tipo|Type)$/i });
      await popup.getByRole('searchbox').fill('c');
      await popup.getByRole('option', { name: /^(Cámaras|Cameras)$/i }).click();
      await expect(manager.getByRole('article')).toHaveCount(1);
      await expect(manager.getByRole('heading', { name: camera.name, exact: true })).toBeVisible();
      await typeFilter.click();
      popup = page.getByRole('dialog', { name: /^(Tipo|Type)$/i });
      await popup.getByRole('option', { name: /^(Todo|All)$/i }).click();
      const originFilter = manager.getByRole('button', { name: /Origen|Origin/i });
      await originFilter.click();
      popup = page.getByRole('dialog', { name: /Origen|Origin/i });
      await popup.getByRole('option', { name: /^Local$/i }).click();
      await expect(manager.getByRole('article')).toHaveCount(2);
      const manage = tile.getByRole('button', { name: /Gestionar dispositivo|Manage device/i });
      const controlBounds = await manage.boundingBox();
      expect(controlBounds?.width).toBeGreaterThanOrEqual(44);
      expect(controlBounds?.height).toBeGreaterThanOrEqual(44);
      await page.evaluate(() => {
        const samples: { x: number; scrollX: number; right: number }[] = [];
        Object.assign(window, { inspectorOpeningFrames: samples });
        const sample = () => {
          const panel = document.querySelector('[role="dialog"]');
          if (panel) {
            const rect = panel.getBoundingClientRect();
            samples.push({ x: rect.x, right: rect.right, scrollX: window.scrollX });
          }
          if (samples.length < 30) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await manage.click();
      const inspector = page.getByRole('dialog', { name: /Inspector técnico|Technical inspector/i });
      await expect.poll(() => requested).toBe(true);
      await expect(inspector.getByRole('status')).toBeVisible();
      const initialPanel = await inspector.elementHandle();
      await expect.poll(() => inspector.evaluate(element => element.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
      const before = await inspector.boundingBox();
      const openingFrames = await page.evaluate(() => (window as unknown as { inspectorOpeningFrames: { x: number; scrollX: number; right: number }[] }).inspectorOpeningFrames);
      expect(openingFrames.length).toBeGreaterThan(0);
      expect(openingFrames.every(frame => frame.scrollX === 0)).toBe(true);
      expect(Math.min(...openingFrames.map(frame => frame.x))).toBeGreaterThanOrEqual(viewport.width - Math.min(viewport.width, 512) - 1);
      expect(before?.x).toBeGreaterThanOrEqual(viewport.width - Math.min(viewport.width, 512) - 1);
      expect(before?.width).toBeLessThanOrEqual(512);
      await expect(inspector.getByText(/Solo alias local|Local Alias Only|Objeto de Datos Core|HomePilot Core Data Object/i)).toHaveCount(0);
      release();
      await expect(inspector.getByText(/Función del dispositivo|Device function/i)).toBeVisible();
      expect(await initialPanel?.evaluate(element => element.isConnected)).toBe(true);
      const after = await inspector.boundingBox();
      expect(after?.x).toBeCloseTo(before!.x, 1);
      expect(after?.width).toBeCloseTo(before!.width, 1);
      // Exercise native scrolling after the chrome is hidden, not programmatic scrolling.
      const scrollArea = inspector.getByText(/Función del dispositivo|Device function/i);
      await scrollArea.hover();
      await page.mouse.wheel(0, 2000);
      const finalControl = inspector.getByRole('button', { name: /^(Eliminar|Delete)$/i });
      await expect(finalControl).toBeInViewport();
      const scrolling = await finalControl.evaluate(element => {
        let ancestor = element.parentElement;
        while (ancestor && getComputedStyle(ancestor).overflowY !== 'auto') ancestor = ancestor.parentElement;
        return ancestor ? { top: ancestor.scrollTop, hidden: getComputedStyle(ancestor).scrollbarWidth, overflow: getComputedStyle(ancestor).overflowY, exceeds: ancestor.scrollHeight > ancestor.clientHeight } : null;
      });
      expect(scrolling?.hidden).toBe('none');
      expect(scrolling?.overflow).toBe('auto');
      if (scrolling?.exceeds) expect(scrolling.top).toBeGreaterThan(0);
      await inspector.getByRole('button', { name: /^(Cerrar|Close)$/i }).click();
      await expect(inspector).toHaveCount(0);
      await expect(manage).toBeFocused();
      const boardTile = manager.getByRole('article').filter({ has: page.getByRole('heading', { name: display.name, exact: true }) });
      await expect(boardTile.getByRole('button')).toHaveCount(1);
      await boardTile.getByRole('button').click();
      await inspector.getByRole('button', { name: /Gestionar controles|Manage controls/i }).click();
      const displayControls = page.getByRole('dialog');
      await expect(displayControls).toContainText('Plan oficina');
      await displayControls.getByRole('button', { name: /^(Cerrar|Close)$/i }).click();
      await expect(displayControls).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      if (['desktop', 'mobile portrait', 'tablet portrait'].includes(viewport.name)) await page.screenshot({ path: testInfo.outputPath(`compact-manager-${theme}.png`), fullPage: true });
    }
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
  test(`Feature: Compact discovery and access — Scenario: Assignment, import and user controls fit ${viewport.name} (AC55, AC56)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    const pending = { id: 'pending-desk', homeId: 'responsive-home', roomId: null, name: 'Luz pendiente', type: 'light', status: 'PENDING', integrationSource: 'sonoff', lastKnownState: { state: 'off' } };
    let devices = [pending, { ...pending, id: 'pending-unavailable', name: 'Luz no disponible', lastKnownState: { state: 'unavailable' } }];
    await page.route('**/api/v1/devices', route => route.fulfill({ json: devices }));
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [{ id: 'office', homeId: pending.homeId, name: 'Oficina' }] }));
    await page.route('**/api/v1/devices/pending-desk/assign', async route => {
      expect(route.request().postDataJSON()).toEqual({ roomId: 'office' });
      await route.fulfill({ json: { ...pending, roomId: 'office', status: 'ASSIGNED' } });
    });
    const candidates = [{ entityId: 'light.new', friendlyName: 'Luz nueva', domain: 'light', profile: { displayName: 'Light', category: 'lighting', supportedCommandCount: 2 } }, { entityId: 'sensor.new', friendlyName: 'Temperatura nueva', domain: 'sensor' }, { entityId: 'sensor.offline', friendlyName: 'Sensor desconectado', domain: 'sensor', available: false }];
    await page.route('**/api/v1/ha/entities?mode=all&view=summary', route => route.fulfill({ json: candidates }));
    let imports = 0;
    await page.route('**/api/v1/ha/import', async route => {
      expect(route.request().postDataJSON()).toEqual({ entityId: 'light.new' });
      imports++;
      await route.fulfill({ json: { ...pending, id: 'new-light', name: 'Luz nueva', integrationSource: 'home-assistant' } });
    });
    const user = { id: 'other-user', username: 'ana', displayName: 'Ana', avatarDataUri: null, role: 'operator', isActive: true, hasActiveSessions: true, createdAt: '', updatedAt: '' };
    await page.route('**/api/v1/admin/users', route => route.fulfill({ json: [user, { ...user, id: dashboardUser.id, username: 'admin', displayName: 'Administrador', role: 'admin', hasActiveSessions: false }] }));
    for (const theme of ['dark', 'light']) {
      devices = [pending, { ...pending, id: 'pending-unavailable', name: 'Luz no disponible', lastKnownState: { state: 'unavailable' } }];
      await page.goto('/system/inbox');
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      const main = page.getByRole('main');
      await expect(main.getByText('Luz no disponible', { exact: true })).toBeVisible();
      await expect(main).not.toContainText(/Local Nativo|Native Local|Pendiente de Puesta en Marcha|Pending Commissioning/i);
      await expect(main.getByRole('heading', { name: /^(Sin asignar|Unassigned)$/i })).toBeVisible();
      const origin = main.getByRole('button', { name: /^(Origen|Origin)$/i });
      const type = main.getByRole('button', { name: /^(Tipo|Type)$/i });
      expect((await origin.boundingBox())?.width).toBeGreaterThanOrEqual(viewport.width < 640 ? 128 : 196);
      expect((await type.boundingBox())?.width).toBeGreaterThanOrEqual(viewport.width < 640 ? 128 : 196);
      const typeBounds = await type.boundingBox();
      const mainBounds = await main.boundingBox();
      expect(typeBounds!.x + typeBounds!.width).toBeGreaterThan(mainBounds!.x + mainBounds!.width - 40);
      const tile = main.getByRole('article').filter({ hasText: 'Luz pendiente' });
      expect((await tile.boundingBox())?.height).toBeLessThanOrEqual(140);
      await tile.getByRole('button', { name: /^(Sin asignar|Unassigned)$/i }).click();
      await page.getByRole('option', { name: 'Oficina', exact: true }).click();
      await tile.getByRole('button', { name: /^(Guardar|Save)$/i }).click();
      await expect(tile).toHaveCount(0);
      await main.getByRole('button', { name: /Descubrir entidades|Discover entities/i }).click();
      const discovery = page.getByRole('region', { name: /Home Assistant/i });
      await expect(discovery.getByRole('article').filter({ hasText: 'Sensor desconectado' })).toContainText(/No disponible|Unavailable/);
      const candidate = discovery.getByRole('article').filter({ hasText: 'Luz nueva' });
      await expect(candidate).toBeVisible();
      await expect(candidate).toContainText(/2 comandos|2 commands/);
      const importBounds = await candidate.getByRole('button', { name: /^(Importar|Import)$/i }).boundingBox();
      const titleBounds = await candidate.getByText('Luz nueva', { exact: true }).boundingBox();
      expect(importBounds!.y).toBeGreaterThan(titleBounds!.y + titleBounds!.height);
      await discovery.getByRole('button', { name: /^(Tipo|Type)$/i }).click();
      await page.getByRole('option', { name: 'Sensor', exact: true }).click();
      await expect(discovery.getByRole('article')).toHaveCount(2);
      await expect(discovery.getByRole('article').filter({ hasText: 'Sensor desconectado' })).toBeVisible();
      await discovery.getByRole('button', { name: /^(Tipo|Type)$/i }).click();
      await page.getByRole('option', { name: /^(Todo|All)$/i }).click();
      const beforeImports = imports;
      await candidate.getByRole('button', { name: /^(Importar|Import)$/i }).click();
      await expect(candidate).toHaveCount(0);
      expect(imports).toBe(beforeImports + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      if (['mobile portrait', 'tablet portrait', 'desktop'].includes(viewport.name)) await page.screenshot({ path: testInfo.outputPath(`discovery-${theme}.png`), fullPage: true });
      await page.goto('/system/users');
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      await expect(page.getByRole('heading', { name: /Personas y acceso|People and access/i })).toBeVisible();
      const card = page.getByRole('article', { name: 'Ana', exact: true });
      await expect(card.getByRole('button', { name: /Suspender|Suspend/i })).toBeVisible();
      await expect(card.getByRole('button', { name: /Revocar|Revoke/i })).toBeEnabled();
      const reset = card.getByRole('button', { name: /Restablecer|Reset/i });
      await expect(reset).toBeVisible();
      await expect(page.getByRole('article', { name: 'Administrador', exact: true }).getByRole('button', { name: /Restablecer|Reset/i })).toHaveCount(0);
      expect((await card.boundingBox())?.height).toBeLessThanOrEqual(300);
      const resetBounds = await reset.boundingBox();
      expect(resetBounds?.height).toBeGreaterThanOrEqual(44);
      expect(resetBounds?.width).toBeGreaterThanOrEqual(44);
      await reset.click();
      const resetDialog = page.getByRole('dialog');
      await expect(resetDialog).toBeVisible();
      await resetDialog.getByRole('button', { name: /^(Cancelar|Cancel)$/i }).click();
      await expect(resetDialog).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      if (['mobile portrait', 'tablet portrait', 'desktop'].includes(viewport.name)) await page.screenshot({ path: testInfo.outputPath(`users-${theme}.png`), fullPage: true });
    }
  });
}

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

test('Feature: Modular selectors — Scenario: The tablet device-function list stays searchable and scrollable above the keyboard', async ({ page }) => {
  await page.setViewportSize(viewports[1]);
  await page.addInitScript(() => {
    const visualViewport = new EventTarget() as VisualViewport;
    Object.defineProperties(visualViewport, {
      height: { configurable: true, value: 1024 },
      width: { configurable: true, value: 768 },
      offsetTop: { configurable: true, value: 0 },
      offsetLeft: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
  });
  await prepareAuthenticatedDashboard(page);
  const cover = { ...responsiveDevices.find((device) => device.id === 'cover-living'), externalId: 'ha:cover.living' };
  await page.route('**/api/v1/rooms', (route) => route.fulfill({ json: [{ id: 'responsive-room', homeId: 'responsive-home', name: 'Sala' }] }));
  await page.route('**/api/v1/devices/cover-living', (route) => route.fulfill({ json: cover }));
  await page.route('**/api/v1/devices/cover-living/activity-logs', (route) => route.fulfill({ json: [] }));

  await page.goto('/system/devices');
  await page.getByRole('article').filter({ hasText: 'Cortina de sala' }).getByRole('button', { name: /gestionar dispositivo|manage device/i }).click();
  const inspector = page.getByRole('dialog', { name: /inspector técnico|technical inspector/i });
  await inspector.getByRole('button', { name: /^(cortina|cover\/blind)$/i }).click();
  const popup = page.getByRole('dialog', { name: /seleccionar opción|select option/i });
  await expect(popup).toBeVisible();
  const search = popup.getByRole('searchbox');
  await search.focus();
  await expect(search).toBeFocused();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 420 });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });

  await expect.poll(() => popup.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(420);
  await expect.poll(() => inspector.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(420);
  const list = popup.getByRole('listbox');
  const lastOption = list.getByRole('option', { name: /desconocido|unknown/i });
  await lastOption.scrollIntoViewIfNeeded();
  const geometry = await popup.evaluate((element) => {
    const listbox = element.querySelector('[role="listbox"]');
    const last = listbox?.lastElementChild;
    return {
      scrollTop: listbox?.scrollTop ?? 0,
      lastBottom: last?.getBoundingClientRect().bottom ?? Infinity,
      listBottom: listbox?.getBoundingClientRect().bottom ?? 0,
    };
  });
  expect(geometry.scrollTop).toBeGreaterThan(0);
  expect(geometry.lastBottom).toBeLessThanOrEqual(geometry.listBottom + 1);
});

test('Feature: Modal visual viewport — Scenario: The tablet scene editor remains usable above the touch keyboard', async ({ page }) => {
  await page.setViewportSize(viewports[1]);
  await page.addInitScript(() => {
    const visualViewport = new EventTarget() as VisualViewport;
    Object.defineProperties(visualViewport, {
      height: { configurable: true, value: 1024 },
      width: { configurable: true, value: 768 },
      offsetTop: { configurable: true, value: 0 },
      offsetLeft: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
  });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', (route) => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
  await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/rooms', route => route.fulfill({ json: [{ id: 'responsive-room', homeId: 'responsive-home', name: 'Sala' }] }));
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [
    ...responsiveDevices,
    { id: 'modal-light', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Luz de prueba', type: 'light', status: 'ASSIGNED', capabilities: [{ type: 'light', name: 'Light', commands: [{ name: 'turn_on' }, { name: 'turn_off' }] }] },
  ] }));

  await page.goto('/routines/scenes');
  await page.getByRole('button', { name: /^(Crear Escena|Create Scene)$/i }).first().click();
  const modal = page.getByRole('dialog', { name: /^(Crear Escena|Create Scene)$/i });
  const name = modal.getByRole('textbox', { name: /^(Name|Nombre)$/i });
  const save = modal.getByRole('button', { name: /^(Guardar Escena|Save Scene)$/i });
  await expect(modal).toBeVisible();
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1024);

  await name.focus();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 420 });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });
  await expect.poll(() => modal.evaluate((element) => element.parentElement?.getBoundingClientRect().bottom ?? Infinity)).toBeLessThanOrEqual(420);
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(420);
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await expect(modal).toBeVisible();
  await name.fill('Escena de prueba');
  await expect.poll(() => modal.evaluate((element) => Array.from(element.querySelectorAll<HTMLElement>('*')).some((child) => (
    getComputedStyle(child).overflowY === 'auto' && child.scrollHeight > child.clientHeight + 1
  )))).toBe(true);

  const lastDevice = modal.getByRole('button', { name: /Luz de prueba/i });
  await modal.getByRole('searchbox').fill('Luz de prueba');
  await lastDevice.scrollIntoViewIfNeeded();
  await expect.poll(() => lastDevice.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(420);
  await expect(lastDevice).toBeEnabled();
  await lastDevice.click();
  await expect(save).toBeEnabled();
  await expect.poll(() => save.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(420);

  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 1024 });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });
  await expect.poll(() => modal.evaluate((element) => element.parentElement?.getBoundingClientRect().bottom ?? Infinity)).toBe(1024);
  await expect(modal).toBeVisible();
  await expect(save).toBeEnabled();

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'width', { configurable: true, value: 1180 });
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 820 });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(820);
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 400 });
    window.visualViewport?.dispatchEvent(new Event('resize'));
  });
  await expect.poll(() => modal.evaluate((element) => element.parentElement?.getBoundingClientRect().bottom ?? Infinity)).toBeLessThanOrEqual(400);
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(400);
  await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await expect.poll(() => save.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(400);
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
  const profileCards = page.getByRole('dialog').getByRole('radio');
  expect(await profileCards.count()).toBeGreaterThanOrEqual(4);
  for (const card of await profileCards.all()) {
    await expect(card).toHaveCSS('border-radius', '28px');
    await expect(card).toHaveCSS('min-height', '48px');
    // The dialog scales during entry; measure the actual target once it settles.
    await expect.poll(async () => (await card.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.getByRole('button', { name: /^(Continue|Continuar)$/i }).click();
  await expect(page.getByText(/Add IP Camera|Añadir cámara IP/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Camera name|Nombre de la cámara/i })).toBeVisible();
});

test('Las cámaras cargan el primer fotograma en Espacios y conservan la tarjeta de imagen del Dashboard', async ({ page }) => {
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

  await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: camera.homeId, name: 'Casa', ownerId: dashboardUser.id }] }));
  await page.goto('/spaces');
  await page.getByRole('button', { name: /Patio.*1 dispositivo|Patio.*1 device/i }).click();
  const managedCamera = page.getByRole('complementary', { name: /Detalle de.*estancia|Room details/i });
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
  await managedCamera.getByRole('button', { name: /pantalla completa|full screen/i }).click();
  const desktopViewer = page.getByRole('dialog');
  await expect(desktopViewer.getByText(/En vivo|Live/i)).toBeVisible();
  const desktopViewerBox = await desktopViewer.boundingBox();
  const desktopFeedBox = await desktopViewer.locator('img[alt*="Cámara patio"]').first().boundingBox();
  expect(desktopViewerBox).not.toBeNull();
  expect(desktopFeedBox).not.toBeNull();
  expect(desktopFeedBox!.width).toBeGreaterThanOrEqual(desktopViewerBox!.width - 2);
  expect(desktopFeedBox!.height).toBeGreaterThanOrEqual(desktopViewerBox!.height - 2);
  expect(desktopViewerBox!.width / desktopViewerBox!.height).toBeCloseTo(1, 1);
  expect(await desktopViewer.locator('img[alt*="Cámara patio"]').first().evaluate((image) => getComputedStyle(image).objectFit)).toBe('contain');
  await page.keyboard.press('Escape');
  await expect(desktopViewer).toHaveCount(0);

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
  await page.getByRole('button', { name: /pantalla completa|full screen/i }).first().click();
  const mobileViewer = page.getByRole('dialog');
  await expect(mobileViewer.getByText(/En vivo|Live/i)).toBeVisible();
  const mobileViewerBox = await mobileViewer.boundingBox();
  const mobileFeedBox = await mobileViewer.locator('img[alt*="Cámara patio"]').first().boundingBox();
  expect(mobileViewerBox).not.toBeNull();
  expect(mobileFeedBox).not.toBeNull();
  expect(mobileFeedBox!.width).toBeGreaterThanOrEqual(mobileViewerBox!.width - 2);
  expect(mobileFeedBox!.height).toBeGreaterThanOrEqual(mobileViewerBox!.height - 2);
  expect(mobileViewerBox!.width / mobileViewerBox!.height).toBeCloseTo(1, 1);
  await mobileViewer.getByRole('button', { name: /cerrar|close/i }).click();
  await expect(mobileViewer).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewports[0].width + 1);
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

for (const width of [360, 768, 1440]) {
  test(`Feature: Modular first admin fields — Scenario: Shared fields preserve initial account validation at ${width}px (AC79)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await page.route('**/api/v1/system/features', route => route.fulfill({ json: { homeChat: true } }));
    await page.route('**/api/v1/system/setup-status', route => route.fulfill({ json: { ...setupStatus, hasAdminUser: false } }));
    let submissions = 0;
    await page.route('**/api/v1/system/bootstrap-admin', route => {
      submissions++;
      expect(route.request().postDataJSON()).toEqual({ username: 'test_admin', displayName: 'Nombre ficticio', password: 'fixture-password-only' });
      return route.fulfill({ status: 409, json: { error: { message: 'Fixture: account already created' } } });
    });
    await page.goto('/');
    const name = page.getByRole('textbox', { name: /^(Display name|Nombre visible)$/i });
    const username = page.getByRole('textbox', { name: /^(Administrator username|Usuario administrador)$/i });
    const password = page.getByLabel(/^(Password|Contraseña)$/i, { exact: true });
    const confirmation = page.getByLabel(/^(Confirm password|Confirmar contraseña)$/i, { exact: true });
    const submit = page.getByRole('button', { name: /Create administrator and continue|Crear administrador y continuar/i });
    for (const theme of ['dark', 'light']) {
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      await page.evaluate(() => document.fonts.ready);
      for (const field of [name, username, password, confirmation]) {
        await expect(field).toHaveCSS('height', '44px');
        await expect(field).toHaveCSS('border-radius', '12px');
        await expect(field).toHaveCSS('font-size', '15px');
        await expect(field).toHaveCSS('padding-left', '40px');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`first-admin-fields-${theme}-${width}.png`), fullPage: true });
    }
    await expect(submit).toBeDisabled();
    await name.fill('  Nombre ficticio  ');
    await username.fill('test_admin');
    await password.fill('fixture-password-only');
    await confirmation.fill('different-fixture');
    await expect(submit).toBeDisabled();
    expect(submissions).toBe(0);
    await confirmation.fill('fixture-password-only');
    await expect(submit).toBeEnabled();
    await confirmation.press('Enter');
    await expect.poll(() => submissions).toBe(1);
    await expect(page.getByText('Fixture: account already created', { exact: true })).toBeVisible();
    await expect(submit).toBeEnabled();
  });
}

for (const width of [360, 768, 1440]) {
  test(`Feature: Modular inspector fields — Scenario: Renaming retains shared geometry and payload at ${width}px (AC79)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await prepareAuthenticatedDashboard(page);
    let device = { id: 'inspector-fixture', externalId: 'fixture:light', name: 'Luz ficticia', type: 'light', status: 'ASSIGNED', homeId: 'responsive-home', roomId: 'fixture-room', lastKnownState: { on: false } };
    let writes = 0;
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [{ id: device.roomId, homeId: device.homeId, name: 'Sala ficticia' }] }));
    await page.route('**/api/v1/devices', route => route.fulfill({ json: [device] }));
    await page.route('**/api/v1/devices/inspector-fixture/activity-logs', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/devices/inspector-fixture', route => {
      if (route.request().method() === 'PATCH') {
        expect(route.request().postDataJSON()).toEqual({ name: 'Luz renovada' });
        device = { ...device, name: 'Luz renovada' };
        writes++;
      }
      return route.fulfill({ json: device });
    });
    await page.goto('/system/devices');
    const tile = page.getByRole('article').filter({ has: page.getByRole('heading', { name: device.name, exact: true }) });
    await tile.getByRole('button', { name: /^(Manage device|Gestionar dispositivo): Luz ficticia$/i }).click();
    const dialog = page.getByRole('dialog');
    const choices = dialog.getByRole('radiogroup').getByRole('radio');
    await expect(choices).toHaveCount(3);
    for (const choice of await choices.all()) {
      expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(choice).toHaveCSS('font-size', '14px');
    }
    await dialog.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
    const name = dialog.getByRole('textbox', { name: /^(New name|Nuevo nombre)$/i });
    await expect(name).toBeFocused();
    for (const theme of ['dark', 'light']) {
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      await waitForSettledLayout(dialog);
      await expect(name).toHaveCSS('height', '44px');
      await expect(name).toHaveCSS('border-radius', '12px');
      await expect(name).toHaveCSS('font-size', '15px');
      expect((await name.boundingBox())!.width).toBeGreaterThanOrEqual(96);
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`inspector-fields-${theme}-${width}.png`), fullPage: true });
    }
    await name.fill('Sin guardar');
    await dialog.getByRole('button', { name: /^(Cancel|Cancelar)$/i }).click();
    expect(writes).toBe(0);
    await dialog.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
    await expect(name).toHaveValue('Luz ficticia');
    await name.fill('  Luz renovada  ');
    await name.press('Enter');
    await expect.poll(() => writes).toBe(1);
    await expect(dialog.getByRole('heading', { name: 'Luz renovada', exact: true })).toBeVisible();
  });
}

for (const width of [360, 768, 1440]) {
  test(`Feature: Modular space fields — Scenario: Home and room editing retain shared geometry at ${width}px (AC79)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await prepareAuthenticatedDashboard(page);
    const home = { id: 'responsive-home', name: 'Casa ficticia', ownerId: dashboardUser.id };
    let rooms: Array<{ id: string; homeId: string; name: string }> = [];
    let writes = 0;
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [home] }));
    await page.route('**/api/v1/devices', route => route.fulfill({ json: [] }));
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: rooms }));
    await page.route('**/api/v1/homes/responsive-home/rooms', route => {
      if (route.request().method() === 'POST') {
        expect(route.request().postDataJSON()).toEqual({ name: 'Sala ficticia' });
        const room = { id: 'room-fixture', homeId: home.id, name: 'Sala ficticia' };
        rooms = [room];
        writes++;
        return route.fulfill({ json: room });
      }
      return route.fulfill({ json: rooms });
    });
    await page.route('**/api/v1/rooms/room-fixture', route => {
      expect(route.request().method()).toBe('PATCH');
      expect(route.request().postDataJSON()).toEqual({ name: 'Sala renovada' });
      rooms = [{ ...rooms[0], name: 'Sala renovada' }];
      writes++;
      return route.fulfill({ json: rooms[0] });
    });
    await page.goto('/spaces');
    const create = page.getByRole('textbox', { name: /^(Room name\.\.\.|Nombre de la estancia\.\.\.)$/i });
    await expect(create).toBeVisible();
    for (const theme of ['dark', 'light']) {
      await page.evaluate(light => document.documentElement.classList.toggle('light', light), theme === 'light');
      await page.getByRole('button', { name: /^(Rename home|Renombrar hogar)$/i }).click();
      const rename = page.getByRole('textbox', { name: /^(Rename home|Renombrar hogar)$/i });
      await expect(rename).toBeFocused();
      await expect(rename).toHaveValue(home.name);
      for (const field of [create, rename]) {
        await expect(field).toHaveCSS('height', '44px');
        await expect(field).toHaveCSS('border-radius', '12px');
        await expect(field).toHaveCSS('font-size', '15px');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`space-fields-${theme}-${width}.png`), fullPage: true });
      await rename.locator('..').locator('..').locator('..').getByRole('button', { name: /^(Cancel|Cancelar)$/i }).click();
      expect(writes).toBe(0);
    }
    await create.fill('  Sala ficticia  ');
    await create.press('Enter');
    await expect.poll(() => writes).toBe(1);
    const detail = page.getByRole('complementary', { name: /Detalle de.*estancia|Room details/i });
    await expect(detail).toContainText('Sala ficticia');
    await detail.getByRole('button', { name: /^(Rename room|Renombrar estancia)$/i }).click();
    const name = detail.getByRole('textbox', { name: /^(Edit name|Editar nombre)$/i });
    await expect(name).toHaveCSS('height', '44px');
    await expect(name).toHaveCSS('border-radius', '12px');
    await expect(name).toHaveAttribute('maxlength', '80');
    await name.fill('  Sala renovada  ');
    await name.press('Enter');
    await expect.poll(() => writes).toBe(2);
    await expect(detail).toContainText('Sala renovada');
  });
}

test('Feature: Room details — Scenario: A home owner selects a room, controls a light, renames the room and closes its details', async ({ page }) => {
  await page.setViewportSize(viewports[1]);
  await prepareAuthenticatedDashboard(page);

  const room = { id: 'responsive-room', homeId: 'responsive-home', name: 'Sala de prueba' };
  const light = {
    id: 'responsive-light', name: 'Lámpara central', type: 'light', semanticType: 'light',
    status: 'ASSIGNED', homeId: room.homeId, roomId: room.id, lastKnownState: { on: false },
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
  await expect(detail).toContainText(/Dispositivos en la estancia|Devices in room/i);

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
