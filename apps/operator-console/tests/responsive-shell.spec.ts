import { expect, test } from '@playwright/test';
import { mdiAutoFix, mdiHome, mdiRobot, mdiWeatherWindy } from '@mdi/js';

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'tablet portrait', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`Feature: Modbus table refinement — Scenario: Fixed headers filters and safe drafts fit ${viewport.name} (AC16/AC17/AC79/AC80)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport); await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'h', name: 'Home' }] }));
    let reads = 0;
    await page.route('**/api/v1/modbus/connections*', route => route.fulfill({ json: { connections: [] } }));
    await page.route('**/api/v1/modbus/probe', route => {
      reads++;
      return route.fulfill({ json: { sampledAt: '2026-10-02T12:00:00Z', rows: Array.from({ length: 31 }, (_, i) => ({
        address: 100 + i, raw: i === 0 ? 0x41b4 : i === 29 ? 17 : 0, status: i === 30 ? 'error' : 'ok', elapsedMs: 10,
        ...(i === 30 ? { error: 'TIMEOUT' } : {}),
      })) } });
    });
    await page.goto('/system/modbus'); await page.getByRole('button', { name: /^(Test reading|Probar lectura)$/i }).click();
    const dialog = page.getByRole('dialog', { name: /^(Test reading|Probar lectura)$/i });
    const id = dialog.getByLabel(/^(Unit ID)$/i);
    await dialog.getByLabel(/^(PLC private IP|IP privada del PLC)$/i).fill('192.168.1.5');
    await id.fill(''); await expect(id).toHaveValue('');
    await dialog.getByRole('button', { name: /^(Read range|Leer rango)$/i }).click(); expect(reads).toBe(0);
    await id.fill('2'); await id.press('Escape'); await expect(dialog).toBeVisible(); await expect(id).toHaveValue('2');
    const bounds = (await dialog.boundingBox())!;
    await page.mouse.click(bounds.x / 2, bounds.y + bounds.height / 2);
    await expect(dialog).toBeVisible(); await expect(id).toHaveValue('2');
    const area = dialog.getByRole('button', { name: /^(Area|Área)$/i });
    const inputBounds = (await id.boundingBox())!, selectBounds = (await area.boundingBox())!;
    expect(inputBounds.height).toBeCloseTo(44, 1); expect(selectBounds.height).toBeCloseTo(44, 1);
    if (viewport.name !== 'mobile') {
      const neighbor = (await dialog.getByLabel(/^(Timeout \(ms\)|Espera máxima \(ms\))$/i).boundingBox())!;
      expect(Math.abs(neighbor.y - selectBounds.y)).toBeLessThan(1);
    }
    await dialog.getByLabel(/^(End PDU|PDU final)$/i).fill('130');
    await dialog.getByRole('button', { name: /^(Read range|Leer rango)$/i }).click();
    const table = dialog.getByRole('table'); await expect(table.getByRole('row')).toHaveCount(32);
    const filter = dialog.getByRole('button', { name: /^(Readings|Lecturas)$/i });
    await filter.click(); await page.getByRole('option', { name: /^(Valid readings|Lecturas válidas)$/i }).click();
    await expect(table.getByRole('row')).toHaveCount(31);
    await filter.click(); await page.getByRole('option', { name: /With activity|Con actividad/ }).click();
    await expect(table.getByRole('row')).toHaveCount(3);
    await dialog.getByRole('button', { name: /^(Data type|Tipo de dato)$/i }).click(); await page.getByRole('option', { name: 'float32', exact: true }).click();
    const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '100', exact: true }) });
    await expect(row).toContainText('22.5');
    await dialog.getByRole('button', { name: /^(Unit|Unidad)$/i }).click(); await page.getByRole('option', { name: '°C', exact: true }).click();
    await expect(row).toContainText('°C');
    await dialog.getByRole('button', { name: /^(Data type|Tipo de dato)$/i }).click(); await page.getByRole('option', { name: 'uint16', exact: true }).click();
    await filter.click(); await page.getByRole('option', { name: /^(All|Todas)$/i, exact: true }).click();
    const lastRow = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '130', exact: true }) });
    const region = dialog.getByRole('region', { name: /Read results|Resultados de lectura/ });
    const header = table.getByRole('columnheader', { name: /^(Variable)$/i });
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      await lastRow.getByRole('button', { name: /^(Create variable|Crear variable)$/i }).scrollIntoViewIfNeeded();
      await expect(header).toBeVisible();
      const headerBounds = (await header.boundingBox())!, regionBounds = (await region.boundingBox())!;
      const frame = region.locator('..');
      expect(await frame.evaluate(element => ({ left: element.scrollLeft, overflow: getComputedStyle(element).overflowX }))).toEqual({ left: 0, overflow: 'hidden' });
      const scrolling = await region.evaluate(element => ({ left: element.scrollLeft, width: element.scrollWidth, visible: element.clientWidth }));
      if (scrolling.width > scrolling.visible) expect(scrolling.left).toBeGreaterThan(0);
      else expect(scrolling.left).toBe(0);
      const frameBounds = (await frame.boundingBox())!, dialogBounds = (await dialog.boundingBox())!;
      expect(frameBounds.x).toBeGreaterThanOrEqual(dialogBounds.x); expect(frameBounds.x + frameBounds.width).toBeLessThanOrEqual(dialogBounds.x + dialogBounds.width);
      expect(Math.abs(headerBounds.y - regionBounds.y)).toBeLessThan(2);
      expect(await header.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
      expect(await lastRow.getByRole('button', { name: /^(Create variable|Crear variable)$/i }).evaluate(element => getComputedStyle(element).whiteSpace)).toBe('nowrap');
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`table-refinement-${theme}.png`), animations: 'disabled' });
    }
    await dialog.getByRole('button', { name: /^(Close|Cerrar)$/i }).click(); await expect(dialog).not.toBeVisible();
  });
}

test('Feature: Safe Modbus deletion — Scenario: Confirm cancel conflict and deletion on tablet (AC18)', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1024 }); await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'h', name: 'Home' }] }));
  let exists = true, linked = true, variables = [{ deviceId: 'v', connectionId: 'c', name: 'Temperature', area: 'holding_register', address: 100, dataType: 'uint16', wordOrder: 'high_first', scale: 1, offset: 0, unit: '°C', writable: false }];
  let deletes = 0;
  await page.route('**/api/v1/modbus/**', route => {
    const request = route.request();
    if (request.method() === 'DELETE') {
      deletes++;
      if (request.url().includes('/variables/')) {
        if (linked) return route.fulfill({ status: 409, json: { code: 'IN_USE' } });
        variables = [];
      } else {
        if (variables.length) return route.fulfill({ status: 409, json: { code: 'IN_USE' } });
        exists = false;
      }
      return route.fulfill({ json: { deleted: true } });
    }
    return route.fulfill({ json: { connections: exists ? [{ id: 'c', homeId: 'h', name: 'PLC', host: '192.168.1.5', port: 502, unitId: 1, timeoutMs: 2000, pollIntervalMs: 5000, enabled: false, variables }] : [] } });
  });
  await page.goto('/system/modbus');
  const card = page.getByRole('region', { name: 'PLC', exact: true });
  await card.getByRole('button', { name: /^(Configure|Configurar)$/i, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^(Delete|Eliminar)$/i }).click();
  let confirmation = page.getByRole('dialog', { name: /^(Delete connection|Eliminar conexión)$/i });
  await confirmation.getByRole('button', { name: /^(Cancel|Cancelar)$/i }).click(); expect(deletes).toBe(0);
  await page.getByRole('dialog').getByRole('button', { name: /^(Delete|Eliminar)$/i }).click();
  await confirmation.getByRole('button', { name: /^(Delete|Eliminar)$/i }).click(); await expect(confirmation.getByRole('alert')).toContainText(/variables/);
  await confirmation.getByRole('button', { name: /^(Cancel|Cancelar)$/i }).click(); await page.getByRole('dialog').getByRole('button', { name: /^(Cancel|Cancelar)$/i }).click();
  await card.getByRole('button', { name: /Configure Temperature|Configurar Temperature/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^(Delete|Eliminar)$/i }).click();
  confirmation = page.getByRole('dialog', { name: /^(Delete variable|Eliminar variable)$/i });
  await confirmation.getByRole('button', { name: /^(Delete|Eliminar)$/i }).click(); await expect(confirmation.getByRole('alert')).toContainText(/scene|escena/i);
  await page.screenshot({ path: testInfo.outputPath('delete-conflict.png'), animations: 'disabled' });
  linked = false; await confirmation.getByRole('button', { name: /^(Delete|Eliminar)$/i }).click(); await expect(confirmation).not.toBeVisible(); await expect(card).not.toContainText('Temperature');
  await card.getByRole('button', { name: /^(Configure|Configurar)$/i, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^(Delete|Eliminar)$/i }).click();
  await page.getByRole('dialog', { name: /^(Delete connection|Eliminar conexión)$/i }).getByRole('button', { name: /^(Delete|Eliminar)$/i }).click(); await expect(card).not.toBeVisible();
  await page.reload(); await expect(page.getByRole('region', { name: 'PLC', exact: true })).not.toBeVisible();
});

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'tablet portrait', width: 768, height: 1024 }, { name: 'tablet landscape', width: 1024, height: 768 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`Feature: Sensor visualizers — Scenario: Shared shell preview and persistence fit ${viewport.name} (AC45)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const section = responsiveDashboard.tabs[0]!.widgets[1]!;
    let dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [section] }] };
    await prepareAuthenticatedDashboard(page, dashboard);
    await page.route('**/api/v1/devices', route => route.fulfill({ json: responsiveDevices.map(device => device.id === 'sensor-climate'
      ? { ...device, lastKnownState: { state: '22.4567', unit_of_measurement: '°C', attributes: { device_class: 'temperature', min: -20, max: 60 } } } : device) }));
    await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [dashboard] }));
    let savedStyle: unknown;
    await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
      if (route.request().method() === 'PATCH') {
        dashboard = { ...dashboard, ...route.request().postDataJSON() };
        savedStyle = (dashboard.tabs[0]!.widgets[0]!.config.extra.cards[0] as { visualStyle?: string }).visualStyle;
      }
      return route.fulfill({ json: dashboard });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab'); await enterDashboardEdit(page);
    const card = page.locator('[data-dashboard-card-id="responsive-sensor"]');
    await card.hover(); await card.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
    const editor = page.getByRole('heading', { name: /^(Edit|Editar)$/i }).locator('..').locator('..').locator('..');
    const selector = editor.getByRole('button', { name: /^(Visualization|Visualización)$/i });
    const preview = editor.locator('.sensor-metric-card');
    await expect(preview).toBeVisible();
    await expect(preview.getByRole('meter')).toHaveAttribute('aria-valuetext', '22.4567 °C');
    const original = (await preview.boundingBox())!;
    for (const [label, style] of [[/^(Thermometer|Termómetro)$/, 'thermometer'], [/^(Level|Nivel)$/, 'level'], [/^(Battery|Batería)$/, 'battery'], [/^(Circular)$/, 'gauge']] as const) {
      await selector.click(); await page.getByRole('option', { name: label }).click();
      if (style === 'gauge') await expect(preview.locator('canvas')).toBeVisible();
      else await expect(preview.locator(`[data-sensor-visualizer="${style}"]`)).toBeVisible();
      if (style === 'level') await expect(preview.locator('[data-sensor-level-tank]')).toBeVisible();
      if (style === 'battery') await expect(preview.locator('[data-sensor-level-tank]')).toHaveCount(0);
      await expect(preview.getByRole('meter')).toHaveAttribute('aria-valuetext', '22.4567 °C');
      const bounds = (await preview.boundingBox())!;
      expect(bounds.width).toBeCloseTo(original.width, 1); expect(bounds.height).toBeCloseTo(original.height, 1);
      expect(await preview.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    await selector.click(); await page.getByRole('option', { name: /^(Level|Nivel)$/ }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await preview.locator('.sensor-liquid, .sensor-liquid-surface').evaluateAll(elements => elements.every(el => getComputedStyle(el).transitionDuration === '0s'))).toBe(true);
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      await preview.scrollIntoViewIfNeeded(); await page.screenshot({ path: testInfo.outputPath(`sensor-visualizers-${theme}.png`), animations: 'disabled' });
    }
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    await expect.poll(() => savedStyle).toBe('level'); await page.reload();
    await expect(card.locator('[data-sensor-visualizer="level"]')).toBeVisible();
  });
}

test('Feature: Sensor fixed scale — Scenario: Editor preview and reload keep optional bounds (AC42)', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  let dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [section] }] };
  await prepareAuthenticatedDashboard(page, dashboard);
  let reading = '22.4567';
  await page.route('**/api/v1/devices', route => route.fulfill({ json: responsiveDevices.map(device => device.id === 'sensor-climate'
    ? { ...device, lastKnownState: { state: reading, unit_of_measurement: '°C', attributes: { min: 0, max: 50 } } } : device) }));
  let savedScale: unknown;
  await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [dashboard] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
    if (route.request().method() === 'PATCH') {
      dashboard = { ...dashboard, ...route.request().postDataJSON() };
      savedScale = (dashboard.tabs[0]!.widgets[0]!.config.extra.cards[0] as { sensorScale?: unknown }).sensorScale;
    }
    return route.fulfill({ json: dashboard });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab'); await enterDashboardEdit(page);
  const sensor = page.locator('[data-dashboard-card-id="responsive-sensor"]');
  await sensor.hover(); await sensor.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  const heading = page.getByRole('heading', { name: /^(Edit|Editar)$/i });
  const editor = heading.locator('..').locator('..').locator('..');
  const minimum = editor.getByLabel(/^(Minimum|Mínimo)$/i), maximum = editor.getByLabel(/^(Maximum|Máximo)$/i);
  await expect(minimum).toHaveValue(''); await minimum.fill('-20');
  const save = editor.getByRole('button', { name: /^(Save|Guardar)$/i });
  await expect(save).toBeDisabled(); await maximum.fill('100'); await expect(save).toBeEnabled();
  const decimals = editor.getByRole('switch', { name: /Show up to two decimal places|Mostrar hasta dos decimales/ });
  await expect(decimals).toHaveAttribute('aria-checked', 'false'); await decimals.click();
  await expect(decimals).toHaveAttribute('aria-checked', 'true');
  const preview = editor.getByRole('meter'); await expect(preview).toHaveAttribute('aria-valuemin', '-20'); await expect(preview).toHaveAttribute('aria-valuemax', '100');
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
    await minimum.scrollIntoViewIfNeeded(); await page.screenshot({ path: testInfo.outputPath(`sensor-scale-${theme}.png`), animations: 'disabled' });
  }
  await save.click(); await expect.poll(() => savedScale).toEqual({ min: -20, max: 100 });
  await page.reload(); await expect(sensor.getByRole('meter')).toHaveAttribute('aria-valuemin', '-20');
  await expect(sensor.locator('.sensor-reading-number')).toHaveText(/22[.,]46/);
  await expect(sensor.getByRole('meter')).toHaveAttribute('aria-valuetext', '22.4567 °C');
  reading = '123.4567'; await page.reload();
  await expect(sensor.getByRole('meter')).toHaveAttribute('aria-valuemin', '-20'); await expect(sensor.getByRole('meter')).toHaveAttribute('aria-valuemax', '100');
  await expect(sensor.locator('.sensor-reading-number')).toHaveText(/123[.,]46/);
  await expect(sensor.getByRole('meter')).toHaveAttribute('aria-valuetext', '123.4567 °C');
  reading = 'unavailable'; await page.reload(); await expect(sensor.getByRole('meter')).toHaveCount(0); await expect(sensor.locator('.sensor-scale-caption')).toHaveCount(0);
  reading = '22.4567'; await page.reload();
  await enterDashboardEdit(page); await sensor.hover(); await sensor.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  await expect(minimum).toHaveValue('-20'); await expect(maximum).toHaveValue('100');
  await expect(decimals).toHaveAttribute('aria-checked', 'true'); await decimals.click();
  await minimum.fill(''); await maximum.fill(''); await save.click(); await expect.poll(() => savedScale).toBeUndefined();
  await expect(sensor.locator('.sensor-reading-number')).toHaveText('22');
});

test('Feature: Dashboard idle preference — Scenario: Optional local stay preserves only the open dashboard (AC34)', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1024 }); await prepareAuthenticatedDashboard(page);
  const start = Date.now(); await page.clock.install({ time: start }); await page.clock.pauseAt(start);
  await page.route('**/api/v1/settings/home-personalization', route => route.fulfill({ json: { morningPhrase: '', afternoonPhrase: '', nightPhrase: '', heroImages: [] } }));
  await page.goto('/system/home-personalization');
  const selector = page.getByRole('button', { name: /Dashboard navigation|Navegación del tablero/ });
  await expect(selector).toContainText(/Return to Home|Volver a Inicio/);
  await selector.click(); await page.getByRole('option', { name: /Stay on the dashboard|Permanecer en el tablero/ }).click();
  await page.screenshot({ path: testInfo.outputPath('dashboard-idle-preference.png'), animations: 'disabled' });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab'); await expect(page.locator('[data-dashboard-card-id="responsive-sensor"]')).toBeVisible();
  await page.clock.fastForward(121_000); await expect(page).toHaveURL(/\/dashboards\/responsive-dashboard\/responsive-tab$/);
  await page.reload(); await expect(page.locator('[data-dashboard-card-id="responsive-sensor"]')).toBeVisible(); await page.clock.fastForward(121_000); await expect(page).toHaveURL(/\/dashboards\/responsive-dashboard\/responsive-tab$/);
  await page.goto('/system/home-personalization'); await expect(selector).toContainText(/Stay on the dashboard|Permanecer en el tablero/);
  await page.clock.fastForward(121_000); await expect(page).toHaveURL(/\/$/);
  await page.goto('/system/home-personalization'); await selector.click(); await page.getByRole('option', { name: /Return to Home after 2 minutes|Volver a Inicio tras 2 minutos/ }).click();
  await page.goto('/dashboards/responsive-dashboard/responsive-tab'); await expect(page.locator('[data-dashboard-card-id="responsive-sensor"]')).toBeVisible(); await page.clock.fastForward(121_000); await expect(page).toHaveURL(/\/$/);
});

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'tablet portrait', width: 768, height: 1024 }, { name: 'tablet landscape', width: 1024, height: 768 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`Feature: PLC address profiles — Scenario: Symbol resolution read preview and persistence fits ${viewport.name} (AC11/AC12/AC13/AC14)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport); await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'h', name: 'Home' }] }));
    const connections: Array<Record<string, unknown>> = []; const probes: Array<Record<string, unknown>> = []; let saved: Record<string, unknown> | undefined;
    await page.route('**/api/v1/modbus/**', route => {
      const request = route.request();
      if (request.method() === 'GET') return route.fulfill({ json: { connections } });
      const body = request.postDataJSON();
      if (request.url().endsWith('/probe')) {
        probes.push(body); const bits = body.area === 'coil';
        return route.fulfill({ json: { sampledAt: '2026-10-02T12:00:00Z', rows: (bits ? [true, false] : [0x41b4, 0]).map((raw, i) => ({ address: body.start + i, raw, status: 'ok', elapsedMs: 12 })) } });
      }
      if (request.url().includes('/variables')) { saved = { ...body, deviceId: 'v', connectionId: 'c' }; connections[0].variables = [saved]; return route.fulfill({ json: { variable: saved } }); }
      connections.push({ ...body, id: 'c', variables: [] }); return route.fulfill({ json: { connection: connections[0] } });
    });
    await page.goto('/system/modbus'); await page.getByRole('button', { name: /^(Test reading|Probar lectura)$/i }).click();
    const dialog = page.getByRole('dialog', { name: /^(Test reading|Probar lectura)$/i });
    await dialog.getByLabel(/^(PLC private IP|IP privada del PLC)$/i).fill('192.168.1.5');
    await dialog.getByRole('button', { name: /^(Addressing|Direccionamiento)$/i }).click();
    await page.getByRole('option', { name: 'Xinje XL5E · XL5E-16T v1', exact: true }).click();
    const symbol = dialog.getByLabel(/^(PLC element|Elemento PLC)$/i, { exact: true });
    const end = dialog.getByLabel(/^(Final PLC element|Elemento PLC final)$/i, { exact: true });
    await symbol.fill('X8'); await end.fill('X10');
    await expect(dialog.getByRole('button', { name: /^(Read range|Leer rango)$/i })).toBeDisabled(); expect(probes).toHaveLength(0);
    await symbol.fill('X10007'); await end.fill('X10010');
    await expect(dialog.getByText(/X10007 – X10010 · .* · PDU 20743 – 20744/)).toBeVisible();
    await expect(dialog.getByText(/Reserved addresses:|Direcciones reservadas:/)).toBeVisible();
    await dialog.getByRole('button', { name: /^(Read range|Leer rango)$/i }).click();
    const bitRow = dialog.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '20743', exact: true }) });
    await expect(bitRow).toContainText(/Active|Activada/);
    expect(probes[0]).toMatchObject({ profileId: 'xinje-xl5e-16t-v1', symbolicStart: 'X10007', symbolicEnd: 'X10010', area: 'coil', start: 20743, end: 20744 });
    expect(probes[0]).not.toHaveProperty('writable'); expect(connections).toEqual([]);
    await symbol.fill('D100'); await end.fill('D101');
    await expect(dialog.getByText(/D100 – D101 · .* · PDU 100 – 101/)).toBeVisible();
    await dialog.getByRole('button', { name: /^(Read range|Leer rango)$/i }).click();
    const row = dialog.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '100', exact: true }) });
    await expect(row).toContainText('16820');
    await dialog.getByRole('button', { name: /^(Data type|Tipo de dato)$/i }).click(); await page.getByRole('option', { name: 'float32', exact: true }).click();
    await dialog.getByLabel(/^(Scale|Escala)$/i).fill('0.1'); await dialog.getByLabel(/^(Offset|Desplazamiento)$/i).fill('2');
    await dialog.getByRole('button', { name: /^(Unit|Unidad)$/i, exact: true }).click(); await page.getByRole('option', { name: '°C', exact: true }).click();
    await expect(row).toContainText('4.25'); await expect(row).toContainText('D100'); await expect(row).toContainText('°C');
    await expect(dialog.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '101', exact: true }) }).getByRole('button', { name: /^(Create variable|Crear variable)$/i })).toBeDisabled();
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      await dialog.getByRole('heading', { name: /^(Test reading|Probar lectura)$/i }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`plc-profile-${theme}.png`), animations: 'disabled', fullPage: true });
      await row.getByRole('rowheader', { name: '100', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`plc-profile-results-${theme}.png`), animations: 'disabled', fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      expect((await dialog.boundingBox())!.height).toBeLessThanOrEqual(viewport.height);
    }
    await row.getByRole('button', { name: /^(Create variable|Crear variable)$/i }).click();
    const editor = page.getByRole('dialog', { name: /^(Configure variable|Configurar variable)$/i });
    await expect(editor.getByLabel(/^(PLC element|Elemento PLC)$/i, { exact: true })).toHaveValue('D100');
    await expect(editor.getByRole('switch', { name: /Allow coil writes|Permitir escritura de coil/ })).toHaveCount(0);
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    expect(saved).toMatchObject({ profileId: 'xinje-xl5e-16t-v1', symbolicAddress: 'D100', area: 'holding_register', address: 100, dataType: 'float32', wordOrder: 'high_first', scale: 0.1, offset: 2, unit: '°C', writable: false });
    expect(connections[0]).toMatchObject({ profileId: 'xinje-xl5e-16t-v1', enabled: false });
    await page.reload(); const card = page.getByRole('region', { name: 'PLC 192.168.1.5' }); await expect(card).toContainText('D100');
    await card.getByRole('button', { name: /Configure D100|Configurar D100/i }).click();
    await expect(page.getByRole('dialog').getByLabel(/^(PLC element|Elemento PLC)$/i, { exact: true })).toHaveValue('D100');
  });
}

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'tablet portrait', width: 768, height: 1024 }, { name: 'tablet landscape', width: 1024, height: 768 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`Feature: Modbus commissioning — Scenario: Read-only RAW conversion and mapping fits ${viewport.name} (AC8/AC9/AC10)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport); await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'h', name: 'Home' }] }));
    const connections: Array<Record<string, unknown>> = []; let savedVariable: Record<string, unknown> | undefined; let probeBody: Record<string, unknown> | undefined;
    await page.route('**/api/v1/modbus/**', async route => {
      const request = route.request();
      if (request.method() === 'GET') return route.fulfill({ json: { connections } });
      const body = request.postDataJSON();
      if (request.url().endsWith('/probe')) { probeBody = body; return route.fulfill({ json: { sampledAt: '2026-10-02T12:00:00Z', rows: [22, 100, 1].map((raw, i) => ({ address: 100 + i, raw, status: 'ok', elapsedMs: 12 })) } }); }
      if (request.url().includes('/variables')) { savedVariable = { ...body, deviceId: 'v', connectionId: 'c' }; connections[0].variables = [savedVariable]; return route.fulfill({ json: { variable: savedVariable } }); }
      connections.push({ ...body, id: 'c', variables: [] }); return route.fulfill({ json: { connection: connections[0] } });
    });
    await page.goto('/system/modbus');
    await page.getByRole('button', { name: /^(Test reading|Probar lectura)$/i }).click();
    const dialog = page.getByRole('dialog', { name: /^(Test reading|Probar lectura)$/i });
    await dialog.getByLabel(/^(PLC private IP|IP privada del PLC)$/i).fill('192.168.1.5');
    await dialog.getByLabel(/^(End PDU|PDU final)$/i).fill('102');
    await dialog.getByRole('button', { name: /^(Read range|Leer rango)$/i }).click();
    const row = dialog.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '100', exact: true }) });
    await expect(row).toContainText('22'); await expect(row).toContainText('12 ms');
    expect(probeBody).toMatchObject({ host: '192.168.1.5', unitId: 1, area: 'holding_register', start: 100, end: 102 });
    expect(probeBody).not.toHaveProperty('writable'); expect(connections).toEqual([]);
    await dialog.getByLabel(/^(Scale|Escala)$/i).fill('0.1'); await dialog.getByLabel(/^(Offset|Desplazamiento)$/i).fill('2');
    await dialog.getByRole('button', { name: /^(Unit|Unidad)$/i, exact: true }).click(); await page.getByRole('option', { name: '°C', exact: true }).click();
    await expect(row).toContainText('4.2'); await expect(row).toContainText('°C');
    await dialog.getByRole('button', { name: /^(Data type|Tipo de dato)$/i }).click(); await page.getByRole('option', { name: 'uint32', exact: true }).click();
    const last = dialog.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '102', exact: true }) });
    await expect(last.getByRole('button', { name: /^(Create variable|Crear variable)$/i })).toBeDisabled();
    const bounds = await dialog.boundingBox(); expect(bounds!.height).toBeLessThanOrEqual(viewport.height);
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      await dialog.getByRole('heading', { name: /^(Test reading|Probar lectura)$/i }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`modbus-probe-${theme}.png`), animations: 'disabled', fullPage: true });
      await row.getByRole('rowheader', { name: '100', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`modbus-probe-results-${theme}.png`), animations: 'disabled', fullPage: true });
    }
    await row.getByRole('button', { name: /^(Create variable|Crear variable)$/i }).click();
    await expect(dialog).not.toBeVisible(); expect(connections[0]).toMatchObject({ enabled: false });
    const variableEditor = page.getByRole('dialog', { name: /^(Configure variable|Configurar variable)$/i });
    await expect(variableEditor.getByLabel(/^(Address|Dirección)$/i, { exact: true })).toHaveValue('100');
    await expect(variableEditor.getByRole('button', { name: /^(Data type|Tipo de dato)$/i })).toContainText('uint32');
    await variableEditor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    expect(savedVariable).toMatchObject({ address: 100, dataType: 'uint32', scale: 0.1, offset: 2, unit: '°C', writable: false });
    await page.reload(); await expect(page.getByRole('region', { name: 'PLC 192.168.1.5' })).toContainText('uint32');
  });
}
test('Feature: Modbus commissioning — Scenario: Periodic read failure keeps RAW marked previous and Stop prevents further reads (AC9)', async ({ page }) => {
  await prepareAuthenticatedDashboard(page); await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'h', name: 'Home' }] }));
  let reads = 0;
  await page.route('**/api/v1/modbus/connections*', route => route.fulfill({ json: { connections: [] } }));
  await page.route('**/api/v1/modbus/probe', route => { reads++; return route.fulfill({ json: { sampledAt: '2026-10-02T12:00:00Z', rows: [{ address: 100, raw: reads === 1 ? 42 : null, status: reads === 1 ? 'ok' : 'error', error: reads === 1 ? undefined : 'TIMEOUT', elapsedMs: 20 }] } }); });
  await page.goto('/system/modbus'); await page.getByRole('button', { name: /^(Test reading|Probar lectura)$/i }).click();
  const dialog = page.getByRole('dialog', { name: /^(Test reading|Probar lectura)$/i });
  await dialog.getByLabel(/^(PLC private IP|IP privada del PLC)$/i).fill('192.168.1.5'); await dialog.getByLabel(/^(End PDU|PDU final)$/i).fill('100');
  await dialog.getByRole('button', { name: /^(Refresh|Refresco)$/i }).click(); await page.getByRole('option', { name: '5 s', exact: true }).click();
  await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-02T12:00:01Z'));
  await dialog.getByRole('button', { name: /^(Read range|Leer rango)$/i }).click();
  await expect(dialog.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '100', exact: true }) })).toContainText('42');
  await expect(dialog.getByRole('status')).toHaveText(/Waiting for next refresh|Esperando próximo refresco/i);
  expect(reads).toBe(1); await page.clock.runFor(5000);
  await expect(dialog.getByText(/^(Previous|Anterior)$/i)).toBeVisible(); expect(reads).toBe(2);
  await expect(dialog.getByRole('button', { name: /^(Create variable|Crear variable)$/i })).toBeDisabled();
  await dialog.getByRole('button', { name: /^(Stop|Detener)$/i }).click(); await page.clock.runFor(20000); expect(reads).toBe(2);
});

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'tablet portrait', width: 768, height: 1024 }, { name: 'tablet landscape', width: 1024, height: 768 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`Feature: Native Modbus configuration — Scenario: Safe explicit mapping fits ${viewport.name} (AC7)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'h', name: 'Home' }] }));
    const connections: Array<Record<string, unknown>> = [];
    const variables: Array<Record<string, unknown>> = [];
    await page.route('**/api/v1/modbus/**', async route => {
      const request = route.request();
      if (request.method() === 'GET') return route.fulfill({ json: { connections } });
      const data = request.postDataJSON();
      if (request.url().includes('/variables')) { variables.push({ ...data, deviceId: `v-${variables.length}`, connectionId: 'c' }); connections[0].variables = variables; return route.fulfill({ json: { variable: variables[variables.length - 1] } }); }
      connections.push({ ...data, id: 'c', variables: [] }); return route.fulfill({ json: { connection: connections[0] } });
    });
    await page.goto('/system/modbus');
    await expect(page.getByRole('heading', { name: 'Modbus TCP', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^(Add connection|Añadir conexión)$/i }).click();
    const dialog = page.getByRole('dialog', { name: /^(Configure connection|Configurar conexión)$/i });
    await dialog.getByLabel(/^(Name|Nombre)$/i).fill('PLC simulado');
    await dialog.getByLabel(/^(PLC private IP|IP privada del PLC)$/i).fill('192.168.1.5');
    await expect(dialog.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    const connectionBounds = await dialog.boundingBox();
    expect(connectionBounds!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: testInfo.outputPath('modbus-connection-editor.png'), animations: 'disabled' });
    await dialog.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    await expect(dialog).not.toBeVisible();
    expect(connections[0]).toMatchObject({ enabled: false, host: '192.168.1.5', port: 502 });
    const card = page.getByRole('region', { name: 'PLC simulado', exact: true });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /^(Add variable|Añadir variable)$/i }).click();
    const variableDialog = page.getByRole('dialog', { name: /^(Configure variable|Configurar variable)$/i });
    await variableDialog.getByLabel(/^(Name|Nombre)$/i).fill('Temperatura ambiente');
    await variableDialog.getByLabel(/^(Address|Dirección)$/i, { exact: true }).fill('123');
    await variableDialog.getByRole('button', { name: /^(Unit|Unidad)$/i, exact: true }).click(); await page.getByRole('option', { name: '°C', exact: true }).click();
    await variableDialog.getByRole('button', { name: /^(Save|Guardar)$/i }).scrollIntoViewIfNeeded();
    await expect(variableDialog.getByRole('button', { name: /^(Save|Guardar)$/i })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath('modbus-variable-editor.png'), animations: 'disabled' });
    await variableDialog.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    await expect(variableDialog).not.toBeVisible();
    expect(variables[0]).toMatchObject({ writable: false, address: 123, dataType: 'uint16' });
    await expect(card.getByText('Temperatura ambiente', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: /^(Add variable|Añadir variable)$/i }).click();
    await variableDialog.getByLabel(/^(Name|Nombre)$/i).fill('Luz patio');
    await variableDialog.getByRole('button', { name: /^(Area|Área)$/i }).click();
    await page.getByRole('option', { name: 'Coil', exact: true }).click();
    const writePermission = variableDialog.getByRole('switch', { name: /^(Allow commands on this coil|Permitir órdenes sobre esta coil)$/i });
    await expect(writePermission).toHaveAttribute('aria-checked', 'false');
    await writePermission.click();
    await variableDialog.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    await expect(variableDialog).not.toBeVisible();
    expect(variables[1]).toMatchObject({ area: 'coil', dataType: 'boolean', writable: true });
    await page.reload(); await expect(page.getByRole('region', { name: 'PLC simulado' })).toContainText('Temperatura ambiente');
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`modbus-${theme}.png`), fullPage: true, animations: 'disabled' });
    }
  });
}
test('Feature: Native Modbus configuration — Scenario: Non-Admin direct navigation never requests configuration (AC2)', async ({ page }) => {
  await prepareAuthenticatedDashboard(page, responsiveDashboard, { ...dashboardUser, role: 'operator' });
  let calls = 0;
  await page.route('**/api/v1/modbus/**', route => { calls++; return route.fulfill({ json: { connections: [] } }); });
  await page.goto('/system/modbus');
  await expect(page.getByRole('button', { name: /^(Add connection|Añadir conexión)$/i })).toHaveCount(0);
  await expect(page.getByRole('navigation').getByText('Modbus TCP', { exact: true })).toHaveCount(0);
  expect(calls).toBe(0);
});

async function enterDashboardEdit(page: import('@playwright/test').Page, touch = false) {
  const header = page.locator('.homepilot-dashboard-titlebar');
  const more = header.getByLabel(/^(More|Más)$/i);
  if (touch) await more.tap(); else await more.click();
  const edit = header.getByRole('menuitem', { name: /^(Edit|Editar)$/i });
  if (touch) await edit.tap(); else await edit.click();
}

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'tablet', width: 1024, height: 768 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`Feature: Dashboard unified editing — Scenario: Stable sections and cross-section movement on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const template = responsiveDashboard.tabs[0].widgets[1];
    const makeSection = (id: string, title: string, cards: Array<Record<string, unknown>>) => ({ ...template, id, config: { ...template.config, layout: { ...template.config.layout, span: 1 }, appearance: { title, showTitle: true }, extra: { cards } } });
    const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [responsiveDashboard.tabs[0].widgets[0],
      makeSection('tech', 'Tech', [{ id: 'movable', kind: 'light', title: 'Gata', entityId: 'light-kitchen', span: 'small', icon: 'Lightbulb' }]),
      makeSection('patio', 'Patio', [{ id: 'tall', kind: 'clock_minimal', title: 'Reloj', span: 'full', icon: 'Clock' }]),
      makeSection('cocina', 'Cocina', [{ id: 'second-light', kind: 'light', title: 'Cocina', span: 'small', icon: 'Lightbulb' }]),
    ] }] };
    await prepareAuthenticatedDashboard(page, dashboard);
    let saved = dashboard;
    await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
    await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
      if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
      return route.fulfill({ json: saved });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const regions = ['Tech', 'Patio', 'Cocina'].map(name => page.getByRole('region', { name, exact: true }));
    const bounds = async () => Promise.all(regions.map(region => region.boundingBox()));
    await expect(regions[2]).toBeVisible();
    const before = await bounds();
    await enterDashboardEdit(page);
    await expect.poll(bounds).toEqual(before);
    await page.screenshot({ path: testInfo.outputPath('dashboard-editing.png'), fullPage: true });
    const header = page.locator('.homepilot-dashboard-titlebar');
    await expect(header.getByRole('button', { name: /^(Edit|Editar|Rename|Renombrar)$/i })).toHaveCount(0);
    const source = page.locator('[data-dashboard-card-id="movable"]');
    await source.scrollIntoViewIfNeeded();
    await source.focus();
    await page.keyboard.press('Space');
    await expect(source).toHaveAttribute('aria-pressed', 'true');
    await expect(source).toHaveAttribute('data-dashboard-drag-origin', 'true');
    const overlay = page.locator('[data-dashboard-drag-preview="true"]');
    await expect(overlay).toBeVisible();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.keyboard.press('Escape');
    await expect(source).not.toHaveAttribute('aria-pressed', 'true');
    expect(saved.tabs[0].widgets.find(widget => widget.id === 'tech')?.config.extra.cards.map(card => card.id)).toEqual(['movable']);
    const sourceBounds = await source.boundingBox();
    if (!sourceBounds) throw new Error('Missing draggable card bounds');
    const destinationBounds = await regions[1].getByRole('heading', { name: 'Patio' }).boundingBox();
    if (!destinationBounds) throw new Error('Missing destination section bounds');
    await page.mouse.move(sourceBounds.x + sourceBounds.width * 0.1, sourceBounds.y + sourceBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(destinationBounds.x + destinationBounds.width / 2, destinationBounds.y + destinationBounds.height / 2, { steps: 12 });
    await expect(source).toHaveAttribute('aria-pressed', 'true');
    await expect(source).toHaveAttribute('data-dashboard-drag-origin', 'true');
    const dragBounds = (await page.locator('[data-dashboard-drag-preview="true"]').boundingBox())!;
    await expect(regions[1].locator('[data-dashboard-card-id="movable"]')).toBeVisible();
    expect(saved.tabs[0].widgets.find(widget => widget.id === 'tech')?.config.extra.cards.map(card => card.id)).toEqual(['movable']);
    expect(dragBounds.width).toBeCloseTo(sourceBounds.width, 1);
    expect(dragBounds.height).toBeCloseTo(sourceBounds.height, 1);
    await expect(page.locator('[data-dashboard-drop-target="true"]').filter({ visible: true })).not.toHaveCount(0);
    await page.mouse.up();
    await expect.poll(() => saved.tabs[0].widgets.find(widget => widget.id === 'patio')?.config.extra?.cards.map(card => card.id)).toEqual(['tall', 'movable']);
    await expect(regions[0].locator('[data-dashboard-card-id="movable"]')).toHaveCount(0);
    await expect(regions[1].locator('[data-dashboard-card-id="movable"]')).toBeVisible();
    await header.getByRole('textbox', { name: /^(Rename|Renombrar)$/i }).fill('Casa renovada');
    await header.getByRole('button', { name: /^(Done|Listo)$/i }).click();
    await expect.poll(() => saved.title).toBe('Casa renovada');
    await page.reload();
    await expect(regions[1].locator('[data-dashboard-card-id="movable"]')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('dashboard-unified-editing.png'), fullPage: true });
  });
}

test('Feature: Dashboard unified editing — Scenario: Touch hold moves a card into an empty section without executing it', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    const template = responsiveDashboard.tabs[0].widgets[1];
    const makeSection = (id: string, title: string, cards: Array<Record<string, unknown>>) => ({ ...template, id, config: { ...template.config, layout: { ...template.config.layout, span: 1 }, appearance: { title, showTitle: true }, extra: { cards } } });
    const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [responsiveDashboard.tabs[0].widgets[0], makeSection('tech', 'Tech', [{ id: 'touch-card', kind: 'light', title: 'Gata', entityId: 'light-kitchen', span: 'small', icon: 'Lightbulb' }]), makeSection('patio', 'Patio', [])] }] };
    let saved = dashboard;
    let commands = 0;
    await prepareAuthenticatedDashboard(page, dashboard);
    await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
    await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
      if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
      return route.fulfill({ json: saved });
    });
    await page.route('**/api/v1/devices/*/command', route => { commands += 1; return route.fulfill({ json: {} }); });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    await enterDashboardEdit(page, true);
    const card = page.locator('[data-dashboard-card-id="touch-card"]');
    await card.scrollIntoViewIfNeeded();
    const source = await card.boundingBox();
    const target = await page.getByRole('region', { name: 'Patio', exact: true }).boundingBox();
    if (!source || !target) throw new Error('Missing touch drag bounds');
    await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-02T12:00:01Z'));
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: source.x + source.width / 2, y: source.y + source.height / 2 }] });
    await page.clock.runFor(450);
    await expect(card).not.toHaveAttribute('aria-pressed', 'true');
    await page.clock.runFor(100);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    const preview = page.locator('[data-dashboard-drag-preview]');
    await expect(preview).toContainText('Gata');
    const previewBounds = await preview.boundingBox();
    expect(previewBounds!.width).toBeCloseTo(source.width, -1);
    await page.clock.resume();
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2 }] });
    await expect(preview).toContainText('Gata');
    await expect.poll(async () => (await preview.boundingBox())!.x).toBeCloseTo(target.x + target.width / 2 - source.width / 2, -1);
    await page.screenshot({ path: testInfo.outputPath('card-over-other-section.png') });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const landingAnimation = await page.evaluate(() => document.getAnimations().some(animation => {
      const effect = animation.effect;
      return effect instanceof KeyframeEffect && effect.target instanceof Element
        && Boolean(effect.target.querySelector('[data-dashboard-drag-preview]'))
        && effect.getKeyframes().some(frame => typeof frame.transform === 'string');
    }));
    expect(landingAnimation).toBe(true);
    await expect.poll(() => saved.tabs[0].widgets.find(widget => widget.id === 'patio')?.config.extra.cards.map(card => card.id)).toEqual(['touch-card']);
    expect(commands).toBe(0);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Patio', exact: true }).locator('[data-dashboard-card-id="touch-card"]')).toBeVisible();
  } finally { await context.close(); }
});

test('Feature: Dashboard tab transfer — Scenario: The active tab exports and imports as a new tab without replacing defaults', async ({ page }) => {
  await page.addInitScript(() => {
    const paths: string[] = [];
    Object.assign(window, { dashboardRouteWrites: paths });
    const replace = history.replaceState.bind(history);
    history.replaceState = (data, unused, url) => { if (url) paths.push(String(url)); replace(data, unused, url); };
  });
  await prepareAuthenticatedDashboard(page);
  const exported = { format: 'homepilot-dashboard-tab', version: 1, tab: { id: 'portable-tab', title: 'Patio', widgets: [] } };
  let exportedTab = '';
  let received: unknown;
  let saved = responsiveDashboard;
  await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard/tabs/responsive-tab/export', route => { exportedTab = 'responsive-tab'; return route.fulfill({ json: exported }); });
  await page.route('**/api/v1/dashboards/responsive-dashboard/tabs/import', route => {
    received = route.request().postDataJSON();
    saved = { ...saved, tabs: [...saved.tabs, { ...saved.tabs[0], id: 'new-tab', title: 'Patio', widgets: [], isDefault: false }] };
    return route.fulfill({ status: 201, json: saved });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  const header = page.locator('.homepilot-dashboard-titlebar');
  await header.getByLabel(/^(More|Más)$/i).click();
  const download = page.waitForEvent('download');
  await header.getByRole('menuitem', { name: /^(Export tab|Exportar pestaña)$/i }).click();
  expect((await download).suggestedFilename()).toBe('principal.homepilot-dashboard-tab.json');
  expect(exportedTab).toBe('responsive-tab');
  await header.getByLabel(/^(More|Más)$/i).click();
  const chooser = page.waitForEvent('filechooser');
  await header.getByRole('menuitem', { name: /^(Import tab|Importar pestaña)$/i }).click();
  await (await chooser).setFiles({ name: 'patio.homepilot-dashboard-tab.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect.poll(() => received).toEqual(exported);
  await expect(page).toHaveURL(/\/new-tab$/);
  await page.getByRole('button', { name: 'Principal', exact: true }).click();
  await expect(page).toHaveURL(/\/responsive-tab$/);
  await page.getByRole('button', { name: 'Patio', exact: true }).click();
  await expect(page).toHaveURL(/\/new-tab$/);
  const writes = await page.evaluate(() => (window as unknown as { dashboardRouteWrites: string[] }).dashboardRouteWrites.filter(path => path.includes('/dashboards/')));
  expect(writes).toEqual(['/dashboards/responsive-dashboard/new-tab', '/dashboards/responsive-dashboard/responsive-tab', '/dashboards/responsive-dashboard/new-tab']);
  expect(saved.tabs).toHaveLength(2);
  expect(saved.tabs[0].isDefault).toBe(true);
  expect(saved.tabs[1].isDefault).toBe(false);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Patio', exact: true })).toBeVisible();
});

test('Feature: Dashboard unified editing — Scenario: Keyboard transfers a card between sections and Escape cancels a second movement', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const template = responsiveDashboard.tabs[0].widgets[1];
  const makeSection = (id: string, title: string, cardId: string) => ({ ...template, id, config: { ...template.config, layout: { ...template.config.layout, span: 1 }, appearance: { title, showTitle: true }, extra: { cards: [{ id: cardId, kind: 'light', title: cardId, span: 'small', icon: 'Lightbulb' }] } } });
  const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [responsiveDashboard.tabs[0].widgets[0], makeSection('tech', 'Tech', 'keyboard-card'), makeSection('patio', 'Patio', 'target-card')] }] };
  let saved = dashboard;
  let writes = 0;
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
    if (route.request().method() === 'PATCH') { writes += 1; saved = { ...saved, ...route.request().postDataJSON() }; }
    return route.fulfill({ json: saved });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  const card = page.locator('[data-dashboard-card-id="keyboard-card"]');
  await card.focus();
  await page.keyboard.press('Space');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
    // dnd-kit installs its document keyboard listener after activation; let
    // the activated frame settle before the user's next key.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('status')).toContainText('Patio');
  await expect(page.getByRole('region', { name: 'Patio', exact: true }).locator('[data-dashboard-card-id="keyboard-card"]')).toBeVisible();
  expect(writes).toBe(0);
  await page.keyboard.press('Space');
  await expect.poll(() => saved.tabs[0].widgets.find(widget => widget.id === 'patio')?.config.extra.cards.map(card => card.id)).toEqual(['keyboard-card', 'target-card']);
  await expect(page.locator('[data-dashboard-drag-preview="true"]')).toHaveCount(0);
  // The transferred node registers its sortable listeners in a layout effect.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await card.focus();
  await expect(card).toBeFocused();
  await page.keyboard.press('Space');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('region', { name: 'Tech', exact: true }).locator('[data-dashboard-card-id="keyboard-card"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).not.toHaveAttribute('aria-pressed', 'true');
  expect(writes).toBe(1);
  await expect(page.getByRole('region', { name: 'Patio', exact: true }).locator('[data-dashboard-card-id="keyboard-card"]')).toBeVisible();
});

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
  const localStart = await page.evaluate(() => new Date(2026, 9, 1, 18, 29, 59).getTime());
  await page.clock.install({ time: localStart });
  await page.clock.pauseAt(localStart);
  await page.route('**/api/v1/settings/home-personalization', route => route.fulfill({ json: { morningPhrase: '', afternoonPhrase: '', nightPhrase: '', heroImages: [] } }));
  await page.goto('/system/home-personalization');
  const selector = page.getByRole('button', { name: /Appearance|Apariencia/i });
  await expect(selector).toContainText(/Manual/i);
  await selector.click();
  await page.getByRole('listbox', { name: /Appearance|Apariencia/i }).getByRole('option', { name: /^(Automatic|Automático)\b/i }).click();
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.clock.fastForward(1000);
  await expect(page.locator('html')).not.toHaveClass(/light/);
  await page.clock.fastForward(11.5 * 60 * 60 * 1000);
  await expect(page.locator('html')).toHaveClass(/light/);
  // The existing inactivity policy returns to Home while the clock advances overnight.
  await page.goto('/system/home-personalization');
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
      const testButton = main.getByRole('button', { name: 'Testear Conexión', exact: true });
      await expect(testButton).toBeEnabled();
      await testButton.click();
      await expect(main.getByText('Conexión Exitosa', { exact: true })).toBeVisible();
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
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/assistant/findings', async route => { await gate; await route.fulfill({ json: [...findings, alert] }); });
    await page.route('**/api/v1/ha/entities?*', route => route.fulfill({ json: [
      { entityId: 'sensor.energy_0', friendlyName: 'Raw', state: '125', attributes: { unit_of_measurement: 'W' } },
      { entityId: 'sensor.energy_1', friendlyName: 'Raw', state: '4.5', attributes: { unit_of_measurement: 'kWh' } },
      { entityId: 'sensor.pending', friendlyName: pending.name, state: '900', attributes: { unit_of_measurement: 'W' } },
    ] }));
    await page.goto('/home');
    await expect(page.getByRole('main').getByRole('status', { name: /Cargando/i })).toBeVisible();
    release();
    for (const theme of ['dark', 'light']) {
      await page.goto('/home');
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
      await page.keyboard.press('Escape');
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
      await page.keyboard.press('Escape');
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

test('Feature: Initial view skeletons — Scenario: A favorites failure releases the skeleton instead of blocking Scenes (AC51)', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'responsive-home', name: 'Casa', ownerId: dashboardUser.id }] }));
  await page.route('**/api/v1/scenes', route => route.fulfill({ json: [{ id: 'offline-favorite', homeId: 'responsive-home', name: 'Trabajo', roomId: null, actions: [] }] }));
  await page.route('**/api/v1/scenes/favorites', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.goto('/routines/scenes');
  await expect(page.getByRole('article', { name: 'Trabajo', exact: true })).toBeVisible();
  await expect(page.locator('[role="status"][aria-busy="true"]')).toHaveCount(0);
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
    await page.keyboard.press('Escape');
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
      await expect(detail).toContainText('22.5');
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

const dashboardUser = {
  id: 'responsive-admin',
  username: 'admin',
  role: 'admin',
  displayName: 'Administrador',
  avatarDataUri: null,
};

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
      await page.keyboard.press('Escape');
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
      await page.keyboard.press('Escape');
      await expect(inspector).toHaveCount(0);
      await expect(manage).toBeFocused();
      const boardTile = manager.getByRole('article').filter({ has: page.getByRole('heading', { name: display.name, exact: true }) });
      await expect(boardTile.getByRole('button')).toHaveCount(1);
      await boardTile.getByRole('button').click();
      await inspector.getByRole('button', { name: /Gestionar controles|Manage controls/i }).click();
      await expect(page.getByRole('dialog')).toContainText('Plan oficina');
      await page.keyboard.press('Escape');
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
      await expect(page.getByRole('heading', { name: /Usuarios y Acceso|Users and Access/i })).toBeVisible();
      const card = page.getByRole('article', { name: 'Ana', exact: true });
      await expect(card.getByRole('button', { name: /Suspender|Suspend/i })).toBeVisible();
      await expect(card.getByRole('button', { name: /Revocar|Revoke/i })).toBeEnabled();
      const reset = card.getByRole('button', { name: /Restablecer|Reset/i });
      await expect(reset).toBeVisible();
      await expect(page.getByRole('article', { name: 'Administrador', exact: true }).getByRole('button', { name: /Restablecer|Reset/i })).toHaveCount(0);
      expect((await card.boundingBox())?.height).toBeLessThanOrEqual(240);
      const resetBounds = await reset.boundingBox();
      expect(resetBounds?.height).toBeGreaterThanOrEqual(44);
      expect(resetBounds?.width).toBeGreaterThanOrEqual(44);
      await reset.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      if (['mobile portrait', 'tablet portrait', 'desktop'].includes(viewport.name)) await page.screenshot({ path: testInfo.outputPath(`users-${theme}.png`), fullPage: true });
    }
  });
}

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

async function prepareAuthenticatedDashboard(page: import('@playwright/test').Page, dashboard: object = responsiveDashboard, user = dashboardUser) {
  await page.addInitScript((user) => {
    localStorage.setItem('hp_session_token', 'responsive-test-token');
    localStorage.setItem('hp_user_ctx', JSON.stringify(user));
  }, user);

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(user) });
  });
  await page.route('**/api/v1/scenes/share-users', route => route.fulfill({ json: [{ id: 'share-recipient', name: 'Ana' }, { id: 'share-recipient-2', name: 'Luis' }] }));
  await page.route('**/api/v1/system/setup-status', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(setupStatus) });
  });
  await page.route('**/api/v1/dashboards', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([dashboard]) });
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

for (const viewport of [
  ...viewports,
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'portrait kiosk', ...portraitKioskViewport },
]) {
  test(`Feature: Sensor clarity — readings and missing data fit ${viewport.name} in both themes`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const readings = [
      { id: 'clarity-temperature', title: 'Sala principal', deviceClass: 'temperature', state: '22.4', unit: '°C' },
      { id: 'clarity-pressure', title: 'Presión de agua', deviceClass: 'pressure', state: '3.2', unit: 'bar' },
      { id: 'clarity-atmosphere', title: 'Presión atmosférica', deviceClass: 'pressure', state: '1013', unit: 'hPa' },
      { id: 'clarity-humidity', title: 'Humedad ambiente', deviceClass: 'humidity', state: '58', unit: '%' },
      { id: 'clarity-battery', title: 'Batería de la tablet', deviceClass: 'battery', state: '18', unit: '%' },
      { id: 'clarity-memory', title: 'RAM del estudio', deviceClass: 'memory', state: '74.03', unit: '%' },
      { id: 'clarity-load', title: 'Procesador', deviceClass: 'cpu', state: '100', unit: '%' },
      { id: 'clarity-missing', title: 'Temperatura exterior', deviceClass: 'temperature', state: 'unavailable', unit: '°C' },
      { id: 'clarity-state', title: 'Estado de batería', deviceClass: 'battery', state: 'not charging', unit: '' },
      { id: 'clarity-numeric', title: 'Energía acumulada', deviceClass: 'energy', state: '123456.7', unit: 'kWh' },
    ];
    const baseSection = responsiveDashboard.tabs[0]!.widgets[1]!;
    const dashboard = {
      ...responsiveDashboard,
      tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [{
        ...baseSection,
        config: { ...baseSection.config, extra: { cards: readings.map(({ id, title }) => ({ id, title, kind: 'sensor', entityId: id, span: 'small', sensorDecimals: true })) } },
      }] }],
    };
    await prepareAuthenticatedDashboard(page, dashboard);
    await page.route('**/api/v1/rooms', (route) => route.fulfill({ json: [{ id: 'clarity-room', homeId: 'responsive-home', name: 'Oficina' }] }));
    await page.route('**/api/v1/devices', (route) => route.fulfill({ json: readings.map((reading) => ({
      id: reading.id, homeId: 'responsive-home', roomId: 'clarity-room', name: `Technical ${reading.id}`, type: 'sensor', status: 'ASSIGNED',
      lastKnownState: { state: reading.state, unit_of_measurement: reading.unit, device_class: reading.deviceClass },
    })) }));
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const cards = page.locator('.sensor-metric-card');
    await expect(cards).toHaveCount(readings.length);
    const geometry = () => cards.evaluateAll((elements) => elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    }));
    const darkGeometry = await geometry();
    const temperature = page.locator('[data-dashboard-card-id="clarity-temperature"] .sensor-metric-card');
    const hierarchy = await temperature.evaluate((element) => {
      const title = element.querySelector('.sensor-reading-title')!;
      const value = element.querySelector('.sensor-reading-value > span')!;
      return { title: Number.parseFloat(getComputedStyle(title).fontSize), value: Number.parseFloat(getComputedStyle(value).fontSize) };
    });
    expect(hierarchy.value).toBeGreaterThan(hierarchy.title);
    expect(hierarchy.value).toBeGreaterThanOrEqual(32);
    for (const theme of ['dark', 'light']) {
      await page.evaluate((isLight) => document.documentElement.classList.toggle('light', isLight), theme === 'light');
      for (const reading of readings) {
        const card = page.locator(`[data-dashboard-card-id="${reading.id}"] .sensor-metric-card`);
        await expect(card.getByText(reading.title, { exact: true })).toHaveCount(1);
        await expect(card.getByText(reading.title, { exact: true })).toBeVisible();
        const titleFits = await card.getByText(reading.title, { exact: true }).evaluate((element) => ({ width: element.clientWidth, contentWidth: element.scrollWidth, height: element.clientHeight, contentHeight: element.scrollHeight }));
        expect(titleFits.contentWidth).toBeLessThanOrEqual(titleFits.width);
        expect(titleFits.contentHeight).toBeLessThanOrEqual(titleFits.height);
        expect(await card.evaluate(element => getComputedStyle(element).borderRadius)).toBe('16px');
        const density = await card.evaluate(element => {
          const style = getComputedStyle(element);
          const value = element.querySelector('.sensor-reading-value')!.getBoundingClientRect();
          const footer = element.querySelector('.sensor-reading-footer')?.getBoundingClientRect();
          return { top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom), readingToFooter: footer ? footer.top - value.bottom : 0 };
        });
        expect(density.top).toBeLessThanOrEqual(8);
        expect(density.bottom).toBeLessThanOrEqual(8);
        expect(density.readingToFooter).toBeLessThanOrEqual(8);
        await expect(card.getByText('Oficina', { exact: true })).toHaveCount(0);
        await expect(card).not.toContainText(`Technical ${reading.id}`);
        await expect(card.getByRole('button')).toHaveCount(0);
        if (!['clarity-battery', 'clarity-memory'].includes(reading.id)) await expect(card.locator('.sensor-reading-footer')).toHaveCount(0);
        if (Number.isFinite(Number(reading.state))) {
          await expect(card.getByText(reading.state, { exact: true })).toBeVisible();
          await expect(card.getByRole('meter', { name: reading.title })).toHaveAttribute('aria-valuenow', reading.state);
          await expect(card.getByRole('meter', { name: reading.title })).toHaveAttribute('aria-valuetext', `${reading.state}${reading.unit === '%' ? '%' : ` ${reading.unit}`}`);
          const meterBounds = await card.getByRole('meter', { name: reading.title }).boundingBox();
          const readingBounds = await card.getByText(reading.state, { exact: true }).boundingBox();
          expect(readingBounds!.y).toBeGreaterThanOrEqual(meterBounds!.y);
          expect(readingBounds!.y + readingBounds!.height).toBeLessThanOrEqual(meterBounds!.y + meterBounds!.height + 1);
          const unitBounds = await card.getByText(reading.unit, { exact: true }).boundingBox();
          expect(unitBounds!.x).toBeGreaterThanOrEqual(readingBounds!.x + readingBounds!.width - 1);
          expect(unitBounds!.y).toBeGreaterThanOrEqual(readingBounds!.y);
          expect(unitBounds!.y).toBeLessThan(readingBounds!.y + readingBounds!.height);
          if (reading.state.length <= 6) {
            expect(await card.getByText(reading.state, { exact: true }).evaluate(element => getComputedStyle(element).fontSize))
              .toBe(await temperature.getByText('22.4', { exact: true }).evaluate(element => getComputedStyle(element).fontSize));
          }
        }
      }
      const missing = page.locator('[data-dashboard-card-id="clarity-missing"] .sensor-metric-card');
      await expect(missing.getByText(/^(Sin lectura|No reading)$/i)).toBeVisible();
      await expect(missing.getByText('—', { exact: true })).toBeVisible();
      await expect(missing).not.toContainText('°C');
      await expect(missing.getByRole('meter')).toHaveCount(0);
      await expect(page.locator('[data-dashboard-card-id="clarity-memory"]').getByText(/^(Uso elevado|High usage)$/i)).toBeVisible();
      await expect(page.locator('[data-dashboard-card-id="clarity-state"]').getByText(/^(Sin cargar|Not charging)$/i)).toBeVisible();
      await expect(page.locator('[data-dashboard-card-id="clarity-state"]').getByRole('switch')).toHaveCount(0);
      await expect(page.locator('[data-dashboard-card-id="clarity-numeric"]').getByText('123456.7', { exact: true })).toBeVisible();
      const cardOverflow = await cards.evaluateAll((elements) => elements.map((element) => ({ text: element.textContent, width: element.clientWidth, contentWidth: element.scrollWidth, height: element.clientHeight, contentHeight: element.scrollHeight })));
      expect(cardOverflow.every(element => element.contentWidth <= element.width && element.contentHeight <= element.height), JSON.stringify(cardOverflow)).toBe(true);
      const valueBounds = await cards.locator('.sensor-reading-value > span').evaluateAll((elements) => elements.map(element => ({ reading: element.textContent, width: element.clientWidth, contentWidth: element.scrollWidth })));
      expect(valueBounds.every(value => value.contentWidth <= value.width), JSON.stringify(valueBounds)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(await geometry()).toEqual(darkGeometry);
      await page.screenshot({ path: testInfo.outputPath(`sensor-fiches-${theme}.png`), fullPage: true });
    }
  });
}

test('Feature: Sensor width — Scenario: A sensor stays medium without a width control or repeated room', async ({ page }) => {
  const baseSection = responsiveDashboard.tabs[0]!.widgets[1]!;
  const dashboard = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [{
    ...baseSection, config: { ...baseSection.config, extra: { cards: [{ ...baseSection.config.extra.cards[0]!, span: 'full' }] } },
  }] }] };
  await prepareAuthenticatedDashboard(page, dashboard);
  let savedDashboard = dashboard;
  await page.route('**/api/v1/dashboards/responsive-dashboard', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    savedDashboard = { ...savedDashboard, ...route.request().postDataJSON() };
    await route.fulfill({ json: savedDashboard });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  const sensor = page.locator('[data-dashboard-card-id="responsive-sensor"]');
  await expect(sensor.getByRole('slider', { name: /resize card|redimensionar tarjeta/i })).toHaveCount(0);
  await sensor.hover();
  await sensor.getByRole('button', { name: /^(Edit|Editar)$/i }).click();
  const heading = page.getByRole('heading', { name: /^(Edit|Editar)$/i });
  await expect(heading).toBeVisible();
  const editor = heading.locator('..').locator('..').locator('..');
  await expect(editor.getByText(/^(Card width|Ancho de tarjeta)$/i)).toHaveCount(0);
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect.poll(() => savedDashboard.tabs[0]!.widgets[0]!.config.extra.cards[0]!.span).toBe('medium');
});

test('disables the Home dashboard action without an owned main tab', async ({ page }) => {
  const shared = { ...responsiveDashboard, ownerId: 'another-user' };
  await prepareAuthenticatedDashboard(page, shared);
  await page.goto('/');

  const context = page.getByLabel(/contexto local del hogar|local home context/i);
  const action = context.getByRole('button', { name: /sin pestaña principal|no main tab/i });
  await expect(action).toContainText(/Ir a tablero|Go to dashboard/);
  await expect(action).toBeDisabled();
});

test('opens the owned main tab even when a shared dashboard is also accessible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);
  const shared = { ...responsiveDashboard, id: 'shared-dashboard', ownerId: 'another-user', title: 'Hogar compartido', tabs: [
    { ...responsiveDashboard.tabs[0], id: 'shared-tab', title: 'Compartida' },
  ] };
  await page.route('**/api/v1/dashboards', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([shared, responsiveDashboard]) });
  });
  await page.goto('/');

  const dashboardGroup = page.getByRole('button', { name: /dashboards|tableros/i }).first();
  await dashboardGroup.click();
  await expect(page.getByRole('button', { name: 'Hogar de prueba' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hogar compartido' })).toBeVisible();
  const context = page.getByLabel(/contexto local del hogar|local home context/i);
  await context.getByRole('button', { name: /abrir la pestaña Principal de mi tablero|open Principal in my dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboards\/responsive-dashboard\/responsive-tab$/);
});

test('Feature: Section slots — moving to a gap and swapping Sections persist without changing another profile', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const baseSection = responsiveDashboard.tabs[0]!.widgets[1]!;
  let dashboard = {
    ...responsiveDashboard,
    tabs: [{
      ...responsiveDashboard.tabs[0]!,
      widgets: ['a', 'b', 'c'].map((id) => ({
        ...baseSection, id,
        config: { ...baseSection.config, layout: { x: 0, y: 0, w: 1, h: 2, span: 1 }, appearance: { title: id.toUpperCase(), showTitle: true }, extra: { cards: [] } },
      })),
      sectionLayout: {
        columns4: ['a', 'b', 'c'] as Array<string | null>,
        columns3: ['c', 'b', 'a'] as Array<string | null>,
        columns2: ['b', null, 'a', 'c'] as Array<string | null>,
        columns1: ['a', null, 'c', 'b'] as Array<string | null>,
      },
    }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/dashboards', (route) => route.fulfill({ json: [dashboard] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const patch = route.request().postDataJSON() as Partial<typeof dashboard>;
    dashboard = { ...dashboard, ...patch };
    await route.fulfill({ json: dashboard });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);

  const section = (name: string) => page.locator('.homepilot-dashboard-widget').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const handle = (name: string) => page.getByRole('button', { name: new RegExp(`^(Drag to reorder|Arrastrar para reordenar): ${name}$`) });
  const dragSection = async (name: string, destination: import('@playwright/test').Locator) => {
    const source = handle(name);
    const bounds = await source.boundingBox();
    if (!bounds) throw new Error('Missing section bounds');
    await source.dragTo(destination, { sourcePosition: { x: bounds.width * 0.02, y: bounds.height / 2 }, steps: 12 });
  };
  await expect(page.locator('[data-section-slot="3"]')).toBeVisible();
  await dragSection('B', page.locator('[data-section-slot="4"]'));
  await expect.poll(() => dashboard.tabs[0]?.sectionLayout.columns4).toEqual(['a', null, 'c', null, 'b']);
  await dragSection('A', section('C'));
  await expect.poll(() => dashboard.tabs[0]?.sectionLayout.columns4).toEqual(['c', null, 'a', null, 'b']);
  expect(dashboard.tabs[0]?.sectionLayout.columns3).toEqual(['c', 'b', 'a']);

  await page.reload();
  await expect(page.locator('[data-section-slot="1"] .homepilot-dashboard-widget')).toHaveCount(0);
  await expect(page.locator('[data-section-slot="4"]')).toContainText('B');
  for (const profile of [
    { width: 1440, height: 900, first: 'C', gap: false },
    { width: 768, height: 1024, first: 'B', gap: true },
    { width: 320, height: 720, first: 'A', gap: true },
  ]) {
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await expect(page.locator('[data-section-slot="0"]')).toContainText(profile.first);
    await expect(page.locator('[data-section-slot="1"] .homepilot-dashboard-widget')).toHaveCount(profile.gap ? 0 : 1);
  }
});

for (const input of ['mouse', 'touch'] as const) {
  test(`Feature: Section masonry drag — ${input} moves a section under the shorter third column`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: input === 'touch' });
    const page = await context.newPage();
    try {
      const template = responsiveDashboard.tabs[0].widgets[1];
      const makeSection = (id: string, tall: boolean) => ({ ...template, id, config: { ...template.config,
        appearance: { title: id.toUpperCase(), showTitle: true }, extra: { cards: tall ? Array.from({ length: 4 }, (_, index) => ({ id: `${id}-${index}`, kind: 'sensor', title: `Lectura ${index}`, entityId: 'sensor-memory', span: 'medium' })) : [] } } });
      let saved = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [makeSection('a', true), makeSection('b', true), makeSection('c', false), makeSection('d', false)], sectionLayout: { columns3: ['a', 'b', 'c', 'd'] as Array<string | null> } }] };
      await prepareAuthenticatedDashboard(page, saved);
      await page.route('**/api/v1/dashboards', route => route.fulfill({ json: [saved] }));
      await page.route('**/api/v1/dashboards/responsive-dashboard', route => {
        if (route.request().method() === 'PATCH') saved = { ...saved, ...route.request().postDataJSON() };
        return route.fulfill({ json: saved });
      });
      await page.goto('/dashboards/responsive-dashboard/responsive-tab');
      await enterDashboardEdit(page, input === 'touch');
      const source = page.getByRole('button', { name: /^(Drag to reorder|Arrastrar para reordenar): D$/ });
      const destination = page.locator('[data-section-slot="5"]');
      await source.scrollIntoViewIfNeeded();
      const sourceBounds = await source.boundingBox();
      const targetBounds = await destination.boundingBox();
      if (!sourceBounds || !targetBounds) throw new Error('Missing masonry drag bounds');
      expect(targetBounds.y).toBeLessThan(sourceBounds.y);
      await expect(source.getByRole('button', { name: /Drag to reorder|Arrastrar para reordenar/ })).toHaveCount(0);
      const start = { x: sourceBounds.x + sourceBounds.width * 0.02, y: sourceBounds.y + sourceBounds.height / 2 };
      const end = { x: targetBounds.x + targetBounds.width / 2, y: targetBounds.y + targetBounds.height / 2 };
      if (input === 'touch') {
        await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
        await page.clock.pauseAt(new Date('2026-10-02T12:00:01Z'));
        const session = await context.newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
        await page.clock.runFor(450);
        await expect(source).not.toHaveAttribute('aria-pressed', 'true');
        await page.clock.runFor(100);
        await expect(source).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('[data-dashboard-drag-preview]')).toContainText('D');
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
        await expect(destination.locator('[data-dashboard-section-id="d"]')).toBeVisible();
        expect(saved.tabs[0].sectionLayout.columns3).toEqual(['a', 'b', 'c', 'd']);
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 12 });
        const preview = page.locator('[data-dashboard-drag-preview]');
        await expect(preview).toContainText('D');
        await expect(destination.locator('[data-dashboard-section-id="d"]')).toBeVisible();
        expect(saved.tabs[0].sectionLayout.columns3).toEqual(['a', 'b', 'c', 'd']);
        await page.screenshot({ path: testInfo.outputPath('section-elevated.png') });
        await page.mouse.up();
      }
      await expect.poll(() => saved.tabs[0].sectionLayout.columns3).toEqual(['a', 'b', 'c', null, null, 'd']);
      if (input === 'touch') await page.clock.resume();
      await page.reload();
      const c = await page.getByRole('region', { name: 'C', exact: true }).boundingBox();
      const d = await page.getByRole('region', { name: 'D', exact: true }).boundingBox();
      const a = await page.getByRole('region', { name: 'A', exact: true }).boundingBox();
      expect(d!.x).toBeCloseTo(c!.x, 0);
      expect(d!.y).toBeGreaterThanOrEqual(c!.y + c!.height);
      expect(d!.y).toBeLessThan(a!.y + a!.height);
    } finally { await context.close(); }
  });
}

test('Feature: Section slots — a historical wide Section edits and saves as one slot without a width picker', async ({ page }) => {
  const baseSection = responsiveDashboard.tabs[0]!.widgets[1]!;
  let dashboard = {
    ...responsiveDashboard,
    tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [{
      ...baseSection, id: 'legacy-wide-section',
      config: { ...baseSection.config, layout: { x: 0, y: 0, w: 12, h: 2, span: 4 }, appearance: { title: 'Sala', showTitle: true }, extra: { cards: [{ id: 'legacy-card', kind: 'sensor', title: 'Batería' }] } },
    }], sectionLayout: { columns4: ['legacy-wide-section', null] as Array<string | null> } }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/dashboards', (route) => route.fulfill({ json: [dashboard] }));
  await page.route('**/api/v1/dashboards/responsive-dashboard', (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    dashboard = { ...dashboard, ...route.request().postDataJSON() as Partial<typeof dashboard> };
    return route.fulfill({ json: dashboard });
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  await expect(page.locator('[data-section-slot="1"] .homepilot-dashboard-widget')).toHaveCount(0);
  await page.getByRole('button', { name: /Editar sección|Edit section/i }).click();
  const editor = page.getByRole('dialog', { name: /Editar sección|Edit section/i });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('group', { name: /Ancho de la tarjeta|Card width/i })).toHaveCount(0);
  await editor.getByRole('button', { name: /^(Guardar|Save)$/i }).click();
  await expect.poll(() => dashboard.tabs[0].widgets[0].config.layout.span).toBe(1);
  expect(dashboard.tabs[0].widgets[0].config.extra.cards.map((card) => card.id)).toEqual(['legacy-card']);
  expect(dashboard.tabs[0].sectionLayout.columns4).toEqual(['legacy-wide-section', null]);
});

test('Feature: Sidebar navigation — a main view resets shell scroll but an internal tab does not', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  const dashboard = {
    ...responsiveDashboard,
    tabs: [responsiveDashboard.tabs[0]!, { ...responsiveDashboard.tabs[0]!, id: 'secondary-tab', title: 'Sala', isDefault: false }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  const scrollArea = page.locator('main > section');
  await scrollArea.evaluate((element) => {
    const spacer = document.createElement('div');
    spacer.style.height = '2000px';
    spacer.setAttribute('aria-hidden', 'true');
    element.appendChild(spacer);
    element.scrollTop = 400;
  });
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.locator('.homepilot-dashboard-tabs').getByRole('button', { name: 'Sala', exact: true }).click();
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.locator('aside nav').getByRole('button', { name: /^(Home|Inicio)$/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBe(0);

  await page.goto('/system/home-personalization');
  await scrollArea.evaluate((element) => {
    const spacer = document.createElement('div');
    spacer.style.height = '2000px';
    spacer.setAttribute('aria-hidden', 'true');
    element.appendChild(spacer);
    element.scrollTop = 400;
  });
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const systemMenu = page.locator('aside nav').getByRole('button', { name: /^(System|Sistema)$/i });
  if (await systemMenu.getAttribute('aria-expanded') === 'false') await systemMenu.click();
  await page.locator('aside nav').getByRole('button', { name: /^(Cámaras IP|IP Cameras)$/i }).click();
  await expect(page).toHaveURL(/\/system\/cameras$/);
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBe(0);
});

test('Feature: Section slots — a shared read-only tab exposes its gaps but no drag controls', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const baseSection = responsiveDashboard.tabs[0]!.widgets[1]!;
  const shared = {
    ...responsiveDashboard, ownerId: 'other-owner',
    tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: ['a', 'b'].map((id) => ({
      ...baseSection, id,
      config: { ...baseSection.config, layout: { x: 0, y: 0, w: 1, h: 2, span: 1 }, appearance: { title: id.toUpperCase(), showTitle: true }, extra: { cards: [] } },
    })), sectionLayout: { columns4: ['a', null, 'b'] } }],
  };
  await prepareAuthenticatedDashboard(page, shared);
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await expect(page.locator('[data-section-slot="1"] .homepilot-dashboard-widget')).toHaveCount(0);
  await expect(page.locator('.homepilot-dashboard-titlebar').getByRole('button', { name: /^(Edit|Editar)$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Drag to reorder|Arrastrar para reordenar/i })).toHaveCount(0);
});

test('Feature: scene favorites — a legacy local favorite migrates once and the server remains authoritative', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('legacy-favorites-seeded')) return;
    localStorage.setItem('hp_fav_scenes', JSON.stringify(['favorite-scene']));
    sessionStorage.setItem('legacy-favorites-seeded', '1');
  });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/automations', route => route.fulfill({ json: [] }));
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

const favoriteAutomationRules = [
  { id: 'automation-x', homeId: 'responsive-home', name: 'Luz nocturna', enabled: true,
    trigger: { type: 'time', timeLocal: '22:00', timezone: 'America/Guayaquil' },
    action: { type: 'device_command', targetDeviceId: 'sensor-climate', command: 'turn_on' } },
  { id: 'automation-y', homeId: 'responsive-home', name: 'Luz matutina', enabled: true,
    trigger: { type: 'time', timeLocal: '07:00', timezone: 'America/Guayaquil' },
    action: { type: 'device_command', targetDeviceId: 'sensor-climate', command: 'turn_on' } },
];

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
    await page.keyboard.press('Escape');
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
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [{
    id: 'scene-light', homeId: 'responsive-home', roomId: null, name: 'Scene light', type: 'light', semanticType: 'light', status: 'ASSIGNED', lastKnownState: null,
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
  await sceneEditor.getByRole('textbox', { name: /Cena con invitados|Dinner Party/i }).fill('Escena nueva');
  await sceneEditor.getByRole('button', { name: /^(Icono|Icon)$/i }).click();
  const picker = page.getByRole('dialog', { name: /^(Icono|Icon)$/i });
  await picker.getByRole('searchbox').fill('home');
  await picker.getByRole('listbox').getByRole('option', { name: 'home', exact: true }).click();
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
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [
    { id: 'identity-light', homeId: 'responsive-home', roomId: null, name: 'Luz de sala', type: 'light', status: 'ASSIGNED' },
    { id: 'identity-switch', homeId: 'responsive-home', roomId: null, name: 'Interruptor de sala', type: 'switch', status: 'ASSIGNED' },
    { id: 'identity-sensor', homeId: 'responsive-home', roomId: null, name: 'Sensor de sala', type: 'sensor', status: 'ASSIGNED', capabilities: [{ type: 'sensor', name: 'Sensor' }] },
    { id: 'identity-cover', homeId: 'responsive-home', roomId: null, name: 'Cortina de sala', type: 'cover', status: 'ASSIGNED' },
    { id: 'identity-camera', homeId: 'responsive-home', roomId: null, name: 'Cámara de sala', type: 'camera', status: 'ASSIGNED' },
  ] }));
  await page.route('**/api/v1/scenes', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/automations', (route) => route.fulfill({ json: [] }));

  await page.goto('/routines/scenes');
  await page.getByRole('button', { name: /^(Crear Escena|Create Scene)$/i }).first().click();
  const sceneEditor = page.getByRole('dialog', { name: /^(Crear Escena|Create Scene)$/i });
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
  await page.route('**/api/v1/devices', (route) => route.fulfill({ json: [
    { id: 'tv-action', homeId: 'responsive-home', roomId: null, name: 'On/Off tv', type: 'button', semanticType: 'light', status: 'ASSIGNED', capabilities: [{ type: 'button', name: 'Button', commands: [{ name: 'press' }] }] },
    { id: 'read-only', homeId: 'responsive-home', roomId: null, name: 'Read only', type: 'sensor', semanticType: 'light', status: 'ASSIGNED', capabilities: [{ type: 'sensor', name: 'Sensor' }] },
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
  await sceneEditor.getByRole('textbox', { name: /Cena con invitados|Dinner Party/i }).fill('Escena TV');
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

test('allows clearing the current open-on-load tab before enabling another', async ({ page }) => {
  let dashboard = { ...responsiveDashboard, tabs: [
    responsiveDashboard.tabs[0],
    { ...responsiveDashboard.tabs[0], id: 'second-tab', title: 'Sala', isDefault: false, widgets: [] },
  ] };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/dashboards', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([dashboard]) });
  });
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const payload = route.request().postDataJSON() as { tabs: typeof dashboard.tabs };
    dashboard = { ...dashboard, tabs: payload.tabs };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(dashboard) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);
  const tabs = page.locator('.homepilot-dashboard-tabs');
  await tabs.getByRole('button', { name: /configurar vista: Sala|configure view: Sala/i }).click();
  let dialog = page.getByRole('dialog', { name: /configuración de la vista Sala|view configuration for Sala/i });
  const otherSwitch = dialog.getByRole('switch', { name: /abrir al cargar|open on load/i });
  await expect(otherSwitch).toBeDisabled();
  await expect(dialog.getByText(/Principal.*ya está configurada|Principal.*already set/i)).toBeVisible();
  await dialog.getByRole('button', { name: /^(Cerrar|Close)$/i }).click();

  await tabs.getByRole('button', { name: /configurar vista: Principal|configure view: Principal/i }).click();
  dialog = page.getByRole('dialog', { name: /configuración de la vista Principal|view configuration for Principal/i });
  const ownSwitch = dialog.getByRole('switch', { name: /abrir al cargar|open on load/i });
  await expect(ownSwitch).toBeEnabled();
  await expect(ownSwitch).toBeChecked();
  await ownSwitch.click();
  await dialog.getByRole('button', { name: /^(Guardar|Save)$/i }).click();
  await expect.poll(() => dashboard.tabs[0].isDefault).toBe(false);

  await tabs.getByRole('button', { name: /configurar vista: Sala|configure view: Sala/i }).click();
  dialog = page.getByRole('dialog', { name: /configuración de la vista Sala|view configuration for Sala/i });
  await expect(dialog.getByRole('switch', { name: /abrir al cargar|open on load/i })).toBeEnabled();
});

for (const viewport of [...viewports, { name: 'tablet landscape', width: 1024, height: 768 }, { name: 'portrait kiosk', ...portraitKioskViewport }]) {
  test(`Feature: Unified palette — Dashboard, Home and portal editor share theme colors on ${viewport.name} (AC76)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'responsive-home', ownerId: dashboardUser.id, name: 'Casa' }] }));
    await page.route('**/api/v1/scenes', route => route.fulfill({ json: [{ id: 'palette-scene', homeId: 'responsive-home', roomId: null, name: 'Paleta compartida', actions: [{ deviceId: 'cover-living', command: 'open' }] }] }));
    await page.route('**/api/v1/scenes/favorites', route => route.fulfill({ json: { sceneIds: [], initialized: true } }));
    const tokens = ['--primary', '--primary-foreground', '--card', '--popover', '--foreground', '--muted-foreground', '--border', '--ring', '--success', '--warning', '--danger'];
    for (const theme of ['dark', 'light']) {
      await page.goto('/dashboards/responsive-dashboard/responsive-tab');
      await page.evaluate(isLight => document.documentElement.classList.toggle('light', isLight), theme === 'light');
      const dashboard = page.locator('.homepilot-dashboard-screen');
      await expect(page.locator('.homepilot-dashboard-section')).toBeVisible();
      const global = await page.locator('html').evaluate((element, names) => names.map(name => getComputedStyle(element).getPropertyValue(name).trim()), tokens);
      const inherited = await dashboard.evaluateAll((elements, names) => elements.map(element => names.map(name => getComputedStyle(element).getPropertyValue(name).trim())), tokens);
      expect(inherited.length).toBeGreaterThan(0);
      for (const palette of inherited) expect(palette).toEqual(global);
      if (viewport.name === 'mobile' || viewport.name === 'desktop') await page.screenshot({ path: testInfo.outputPath(`dashboard-${theme}.png`), animations: 'disabled' });
      await page.goto('/');
      await page.evaluate(isLight => document.documentElement.classList.toggle('light', isLight), theme === 'light');
      expect(await page.locator('body').evaluate((element, names) => names.map(name => getComputedStyle(element).getPropertyValue(name).trim()), tokens)).toEqual(global);
      const homeAction = page.getByRole('button', { name: /Open Principal in my dashboard|Abrir.*Principal.*mi tablero/i });
      await expect(homeAction).toBeVisible();
      expect(await homeAction.evaluate(element => getComputedStyle(element).color)).toBe(await page.locator('body').evaluate(element => getComputedStyle(element).color));
      if (viewport.name === 'mobile' || viewport.name === 'desktop') await page.screenshot({ path: testInfo.outputPath(`home-${theme}.png`), animations: 'disabled' });
      await page.goto('/routines/scenes');
      await page.evaluate(isLight => document.documentElement.classList.toggle('light', isLight), theme === 'light');
      await page.getByRole('button', { name: /^(Editar|Edit)$/i }).click();
      const editor = page.getByRole('dialog');
      await expect(editor).toBeVisible();
      expect(await editor.evaluate((element, names) => names.map(name => getComputedStyle(element).getPropertyValue(name).trim()), tokens)).toEqual(global);
      const save = editor.getByRole('button', { name: /^(Guardar escena|Save Scene)$/i });
      await expect(save).toBeEnabled();
      const contrast = await save.evaluate(element => {
        const style = getComputedStyle(element);
        const luminance = (color: string) => {
          const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(value => Number(value) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
          return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
        };
        const text = luminance(style.color), background = luminance(style.backgroundColor);
        return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
      });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      const bounds = await editor.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      if (viewport.name === 'mobile' || viewport.name === 'desktop') await page.screenshot({ path: testInfo.outputPath(`editor-${theme}.png`), animations: 'disabled' });
    }
  });
}

for (const viewport of [...viewports, { name: 'portrait kiosk', ...portraitKioskViewport }]) {
  test(`premium dashboard surfaces preserve section bounds and avoid overflow on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const section = responsiveDashboard.tabs[0]!.widgets[1]!;
    if (!('extra' in section.config)) throw new Error('Responsive fixture has no section cards');
    const dashboard = {
      ...responsiveDashboard,
      tabs: [{
        ...responsiveDashboard.tabs[0]!,
        widgets: [responsiveDashboard.tabs[0]!.widgets[0]!, {
          ...section,
          config: {
            ...section.config,
            extra: { ...section.config.extra, cards: [
              ...section.config.extra.cards,
              { id: 'premium-action', kind: 'action', title: 'Indirecta espalda muy larga', span: 'small' },
            ] },
          },
        }],
      }],
    };
    await prepareAuthenticatedDashboard(page, dashboard);
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');

    const sectionSurface = page.locator('.homepilot-dashboard-section');
    const tile = page.locator('[data-dashboard-card-id="premium-action"]');
    await expect(sectionSurface).toBeVisible();
    await expect(tile).toBeVisible();
    await expect(page.locator('[data-homepilot-clock]')).toBeVisible();
    const sectionBefore = await sectionSurface.boundingBox();
    const dark = await sectionSurface.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      backdrop: getComputedStyle(element).backdropFilter,
    }));
    expect(dark.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(dark.backdrop).not.toBe('none');
    const tileGeometry = await tile.evaluate((element) => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      label: element.querySelector('button span')?.textContent,
    }));
    expect(tileGeometry.scrollWidth).toBeLessThanOrEqual(tileGeometry.width);
    expect(tileGeometry.label).toContain('Indirecta espalda');
    await page.evaluate(() => document.documentElement.classList.add('light'));
    const sectionAfter = await sectionSurface.boundingBox();
    expect(sectionAfter?.width).toBe(sectionBefore?.width);
    expect(sectionAfter?.height).toBe(sectionBefore?.height);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`dashboard initial skeleton preserves card, section and canvas geometry on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareAuthenticatedDashboard(page);
    let releaseDevices: (() => void) | undefined;
    const blockedDevices = new Promise<void>((resolve) => { releaseDevices = resolve; });
    await page.route('**/api/v1/devices', async (route) => {
      await blockedDevices;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(responsiveDevices) });
    });

    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const card = page.locator('[data-dashboard-card-id="responsive-sensor"]');
    await expect(card.locator('[data-dashboard-skeleton="sensor"]')).toBeVisible();
    const geometry = async () => page.evaluate(() => {
      const cardElement = document.querySelector('[data-dashboard-card-id="responsive-sensor"]');
      const sectionElement = cardElement?.closest('.homepilot-dashboard-widget');
      const canvasElement = document.querySelector('.homepilot-dashboard-content');
      const rect = (element: Element | null | undefined) => {
        const bounds = element?.getBoundingClientRect();
        return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, bottom: bounds.bottom } : null;
      };
      const items = Array.from(cardElement?.parentElement?.children ?? []).map((element, index) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          index,
          id: element.getAttribute('data-dashboard-card-id') ?? element.getAttribute('data-testid') ?? element.tagName.toLowerCase(),
          x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, bottom: bounds.bottom,
          gridRowStart: style.gridRowStart,
          gridRowEnd: style.gridRowEnd,
          position: style.position,
          display: style.display,
          visibility: style.visibility,
        };
      });
      return {
        card: rect(cardElement), section: rect(sectionElement), canvas: rect(canvasElement),
        items, childCount: items.length,
        sectionBottom: sectionElement?.getBoundingClientRect().bottom ?? null,
        maxChildBottom: items.length ? Math.max(...items.map((item) => item.bottom ?? -Infinity)) : null,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    const before = await geometry();
    expect(before.card).not.toBeNull();
    expect(before.section).not.toBeNull();
    expect(before.canvas).not.toBeNull();
    expect(before.overflow).toBe(false);
    await card.screenshot({ path: testInfo.outputPath('sensor-skeleton.png') });

    releaseDevices?.();
    await expect(card.locator('.sensor-metric-card')).toBeVisible();
    await expect(card.locator('[data-dashboard-skeleton]')).toHaveCount(0);
    const after = await geometry();
    const weatherBefore = before.items.find((item) => item.id === 'responsive-weather');
    const weatherAfter = after.items.find((item) => item.id === 'responsive-weather');
    expect(weatherBefore).toBeDefined();
    expect(weatherAfter?.height).toBe(weatherBefore?.height);
    expect(weatherAfter?.gridRowStart).toBe(weatherBefore?.gridRowStart);
    expect(weatherAfter?.gridRowEnd).toBe(weatherBefore?.gridRowEnd);
    const geometryChanges = (['card', 'section', 'canvas'] as const).flatMap((key) =>
      (['x', 'y', 'width', 'height'] as const).map((axis) => {
        const initial = before[key]![axis];
        const final = after[key]![axis];
        return { key, axis, initial, final, delta: Math.abs(final - initial) };
      }),
    );
    const geometryReport = geometryChanges
      .map(({ key, axis, initial, final, delta }) => `${key}.${axis}: before=${initial} after=${final} delta=${delta}`)
      .join('\n');
    const describeItem = (item: (typeof before.items)[number] | undefined) => item
      ? `${item.id} x=${item.x} y=${item.y} width=${item.width} height=${item.height} bottom=${item.bottom} row=${item.gridRowStart}/${item.gridRowEnd} position=${item.position} display=${item.display} visibility=${item.visibility}`
      : 'missing';
    const itemReport = Array.from({ length: Math.max(before.childCount, after.childCount) }, (_, index) =>
      `item[${index}] before: ${describeItem(before.items[index])}\n` +
      `item[${index}] after:  ${describeItem(after.items[index])}`,
    ).join('\n');
    const sectionReport = `childCount before=${before.childCount} after=${after.childCount}; ` +
      `sectionBottom before=${before.sectionBottom} after=${after.sectionBottom}; ` +
      `maxChildBottom before=${before.maxChildBottom} after=${after.maxChildBottom}`;
    expect(geometryChanges.filter(({ delta }) => delta > 2), `${viewport.name} geometry:\n${geometryReport}\n${sectionReport}\n${itemReport}`).toEqual([]);
    expect(after.overflow).toBe(false);
    await card.screenshot({ path: testInfo.outputPath('sensor-loaded.png') });
  });
}

test('a fast initial snapshot never flashes a Dashboard skeleton', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await expect(page.locator('[data-dashboard-card-id="responsive-sensor"] .sensor-metric-card')).toBeVisible();
  await expect(page.locator('[data-dashboard-skeleton]')).toHaveCount(0);
});

test('a failed first device snapshot leaves loading and offers recovery', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await expect(page.getByText(/No se pudo cargar el estado de los dispositivos|Device status could not be loaded/)).toBeVisible();
  await expect(page.locator('[data-dashboard-skeleton]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Reintentar|Retry/i })).toBeVisible();
});

test('Dashboard skeleton motion is disabled when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepareAuthenticatedDashboard(page);
  let releaseDevices: (() => void) | undefined;
  const blockedDevices = new Promise<void>((resolve) => { releaseDevices = resolve; });
  await page.route('**/api/v1/devices', async (route) => {
    await blockedDevices;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(responsiveDevices) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  const skeleton = page.locator('[data-dashboard-skeleton="sensor"]').first();
  await expect(skeleton).toBeVisible();
  expect(await skeleton.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  releaseDevices?.();
});

for (const viewport of [viewports[1], viewports[2]]) {
  test(`dashboard backgrounds keep viewport and canvas geometry during navigation on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    const first = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], background: '/media/dashboards/test-backdrop-a.svg' }] };
    const second = { ...responsiveDashboard, id: 'second-dashboard', title: 'Segundo tablero', tabs: [{ ...responsiveDashboard.tabs[0], id: 'second-tab', background: '/media/dashboards/test-backdrop-b.svg' }] };
    const plain = { ...responsiveDashboard, id: 'plain-dashboard', title: 'Sin fondo', tabs: [{ ...responsiveDashboard.tabs[0], id: 'plain-tab', background: undefined }] };
    await page.route('**/api/v1/dashboards', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([first, second, plain]) });
    });
    let releaseSecondImage: () => void = () => undefined;
    const secondImageGate = new Promise<void>((resolve) => { releaseSecondImage = resolve; });
    await page.route('**/media/dashboards/test-backdrop-*.svg', async (route) => {
      if (route.request().url().endsWith('test-backdrop-b.svg')) await secondImageGate;
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#483b32"/></svg>' });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const backdrop = page.locator('.homepilot-dashboard-backdrop');
    const backdropImage = backdrop.locator(':scope > div');
    const canvas = page.locator('.homepilot-dashboard-content');
    await expect(backdropImage).toHaveCSS('background-image', /test-backdrop-a/);
    const geometry = async () => ({
      backdrop: await backdrop.boundingBox(), canvas: await canvas.boundingBox(),
      viewport: await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
    });
    const before = await geometry();
    const navigate = async (dashboardId: string, tabId: string) => {
      await page.evaluate(({ dashboardId, tabId }) => {
        window.history.pushState({}, '', `/dashboards/${dashboardId}/${tabId}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, { dashboardId, tabId });
    };

    await navigate('second-dashboard', 'second-tab');
    await expect(page).toHaveURL(/second-dashboard\/second-tab/);
    await expect(backdropImage).toHaveCSS('background-image', /test-backdrop-a/);
    const whileLoading = await geometry();
    expect(whileLoading.backdrop).toEqual(before.backdrop);
    expect(whileLoading.viewport).toEqual(before.viewport);
    expect(Math.abs((whileLoading.canvas?.y ?? 0) - (before.canvas?.y ?? 0))).toBeLessThanOrEqual(2);

    releaseSecondImage();
    await expect(backdropImage).toHaveCSS('background-image', /test-backdrop-b/);
    await expect(page).toHaveURL(/second-dashboard\/second-tab/);
    const after = await geometry();
    expect(after.backdrop).toEqual(before.backdrop);
    expect(after.viewport).toEqual(before.viewport);
    expect(Math.abs((after.canvas?.y ?? 0) - (before.canvas?.y ?? 0))).toBeLessThanOrEqual(2);

    await navigate('plain-dashboard', 'plain-tab');
    await expect(backdropImage).toHaveCSS('background-image', 'none');
    expect((await geometry()).backdrop).toEqual(before.backdrop);
    await navigate('second-dashboard', 'second-tab');
    await expect(backdropImage).toHaveCSS('background-image', /test-backdrop-b/);
    expect((await geometry()).backdrop).toEqual(before.backdrop);
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

for (const viewport of [viewports[2], viewports[1], viewports[0], { name: 'portrait kiosk', ...portraitKioskViewport }]) {
  test(`Feature: Dashboard layout parity — Scenario: Editing preserves section geometry on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const layoutDevices = [1, 2, 3, 4, 5].map((number) => ({
      id: `layout-light-${number}`,
      homeId: 'responsive-home',
      roomId: 'responsive-room',
      name: `Luz ${number}`,
      type: 'light',
      semanticType: 'light',
      status: 'ASSIGNED',
      lastKnownState: { state: 'off' },
    }));
    const layoutDashboard = {
      ...responsiveDashboard,
      tabs: [{
        ...responsiveDashboard.tabs[0],
        // No title widget: the edit-only add-title and add-section controls
        // must not create extra auto-fit tracks or squeeze these sections.
        // Fill the desktop profile's four slots so auto-fit view mode and
        // explicit-slot edit mode share the same section track width.
        widgets: ['Tech', 'Patio', 'Sala', 'Cocina'].map((title, index) => ({
          id: `layout-section-${index}`,
          type: 'section',
          config: {
            layout: { x: index, y: 0, w: 1, h: 2, span: 1 },
            binding: { entityId: `layout-section-${index}`, entityType: 'system', entityName: title },
            visibility: { rules: [], defaultState: 'show' },
            appearance: { title, showTitle: true },
            extra: { cards: layoutDevices.map((device) => ({
              id: `${index}-${device.id}`,
              kind: 'light',
              title: device.name,
              entityId: device.id,
              span: 'small',
              icon: 'Lightbulb',
            })) },
          },
        })),
      }],
    };
    await prepareAuthenticatedDashboard(page, layoutDashboard);
    await page.route('**/api/v1/devices', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([...responsiveDevices, ...layoutDevices]) });
    });
    await page.route('**/api/v1/scenes', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/automations', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: '[]' });
    });
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');

    const canvas = page.locator('.homepilot-dashboard-content > div.grid');
    const section = (title: string) => page.locator('.homepilot-dashboard-widget').filter({
      has: page.getByRole('heading', { name: title, exact: true }),
    });
    await expect(section('Tech')).toBeVisible();
    await expect(section('Patio')).toBeVisible();

    const geometry = async (title: string) => section(title).evaluate((element) => {
      const content = element.querySelector(':scope > div > section') as HTMLElement | null;
      const cardGrid = content?.querySelector(':scope > div.grid') as HTMLElement | null;
      const canvasElement = document.querySelector('.homepilot-dashboard-content > div.grid') as HTMLElement | null;
      if (!content || !cardGrid || !canvasElement) throw new Error('Dashboard section geometry is unavailable');
      const tracks = (template: string) => template.split(/\s+/).map(Number.parseFloat).filter((width) => Number.isFinite(width) && width > 1);
      const sectionRect = element.getBoundingClientRect();
      const gridRect = cardGrid.getBoundingClientRect();
      const canvasRect = canvasElement.getBoundingClientRect();
      const heading = content.querySelector(':scope > h2') as HTMLElement | null;
      const cardRects = [...cardGrid.querySelectorAll<HTMLElement>(':scope > [data-card-id]')]
        .map((card) => card.getBoundingClientRect());
      const addCardButton = content.querySelector<HTMLElement>('button[aria-label="Add card"], button[aria-label="Añadir tarjeta"]');
      const toolbar = element.querySelector<HTMLElement>(':scope > div.absolute.z-30');
      const addCardRect = addCardButton?.getBoundingClientRect();
      const toolbarRect = toolbar?.getBoundingClientRect();
      return {
        sectionWidth: sectionRect.width,
        sectionHeight: sectionRect.height,
        contentWidth: content.getBoundingClientRect().width,
        cardGridWidth: gridRect.width,
        cardGridHeight: gridRect.height,
        titleTop: (heading?.getBoundingClientRect().top ?? sectionRect.top) - sectionRect.top,
        titleToCards: cardRects[0] ? cardRects[0].top - (heading?.getBoundingClientRect().bottom ?? 0) : 0,
        sectionBackground: getComputedStyle(element).backgroundColor,
        cardTopOffsets: cardRects.map((card) => card.top - gridRect.top),
        rowGap: getComputedStyle(cardGrid).rowGap,
        transitionProperty: getComputedStyle(element).transitionProperty,
        canvasTransitionProperty: getComputedStyle(canvasElement).transitionProperty,
        canvasTransitionDuration: getComputedStyle(canvasElement).transitionDuration,
        cardTracks: tracks(getComputedStyle(cardGrid).gridTemplateColumns),
        canvasWidth: canvasElement.getBoundingClientRect().width,
        canvasTracks: tracks(getComputedStyle(canvasElement).gridTemplateColumns),
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineOffset: getComputedStyle(element).outlineOffset,
        toolbarPosition: getComputedStyle(toolbar ?? element).position,
        addCardLeft: addCardRect?.left ?? null,
        addCardRight: addCardRect?.right ?? null,
        addCardTop: addCardRect?.top ?? null,
        toolbarLeft: toolbarRect?.left ?? null,
        sectionLeft: sectionRect.left,
        sectionRight: sectionRect.right,
        canvasLeft: canvasRect.left,
        canvasRight: canvasRect.right,
        gridBottom: gridRect.bottom,
        addCardInsideGrid: addCardButton ? cardGrid.contains(addCardButton) : false,
      };
    });
    const settleLayout = () => page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await settleLayout();
    const view = await Promise.all(['Tech', 'Patio'].map(geometry));

    await enterDashboardEdit(page);
    await expect(section('Tech').getByRole('button', { name: /Drag to reorder|Arrastrar para reordenar/i })).toBeVisible();
    await settleLayout();
    const edit = await Promise.all(['Tech', 'Patio'].map(geometry));

    await expect(page.getByRole('button', { name: /^(Add title|Añadir título)$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Add section|Añadir sección)$/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /^(Add title|Añadir título|Add section|Añadir sección)$/i })).toHaveCount(0);

    const expectSameWidth = (before: number, after: number, label: string) => {
      expect(Math.abs(after - before), `${viewport.name}: ${label}`).toBeLessThanOrEqual(2);
    };
    for (let index = 0; index < view.length; index += 1) {
      const before = view[index]!;
      const after = edit[index]!;
      expect(before.sectionHeight).toBeGreaterThan(0);
      expect(after.sectionHeight).toBeGreaterThan(0);
      expect(before.sectionHeight).toBeGreaterThanOrEqual(before.cardGridHeight);
      expect(after.sectionHeight).toBeGreaterThanOrEqual(after.cardGridHeight);
      // The edit-only placeholder follows the real card grid, so the section
      // may grow, but existing cards retain their view-mode geometry.
      expect(after.sectionHeight).toBeGreaterThan(before.sectionHeight);
      expect(Math.abs(after.titleTop - before.titleTop)).toBeLessThanOrEqual(2);
      expect(Math.abs(after.titleToCards - before.titleToCards)).toBeLessThanOrEqual(2);
      expect(before.titleTop).toBeGreaterThanOrEqual(8);
      expect(before.sectionBackground).not.toBe('rgba(0, 0, 0, 0)');
      expect(after.sectionBackground).toBe(before.sectionBackground);
      expect(before.rowGap).toBe('8px');
      expect(after.rowGap).toBe('8px');
      expect(after.cardTopOffsets).toHaveLength(before.cardTopOffsets.length);
      before.cardTopOffsets.forEach((top, card) => {
        expect(Math.abs(after.cardTopOffsets[card]! - top), `${viewport.name}: card ${card + 1} vertical position`).toBeLessThanOrEqual(2);
      });
      expect(after.transitionProperty).not.toContain('all');
      expect(after.transitionProperty).not.toContain('outline');
      expect(after.transitionProperty).toContain('transform');
      expect(after.transitionProperty).toContain('box-shadow');
      expect(after.transitionProperty).toContain('background-color');
      expect(after.transitionProperty).toContain('border-color');
      // CSS defaults transition-property to "all" even when duration is 0s.
      // An effective zero duration means the canvas cannot animate its outline.
      expect(
        after.canvasTransitionDuration.split(',').every((duration) => Number.parseFloat(duration.trim()) === 0),
        `${viewport.name}: canvas transition-property ${after.canvasTransitionProperty} must have zero duration`,
      ).toBe(true);
      expectSameWidth(before.sectionWidth, after.sectionWidth, `section ${index + 1}`);
      expectSameWidth(before.contentWidth, after.contentWidth, `section content ${index + 1}`);
      expectSameWidth(before.cardGridWidth, after.cardGridWidth, `card grid ${index + 1}`);
      expectSameWidth(before.canvasWidth, after.canvasWidth, 'canvas');
      expect(after.canvasTracks).toHaveLength(before.canvasTracks.length);
      expect(after.cardTracks).toHaveLength(before.cardTracks.length);
      before.canvasTracks.forEach((width, track) => expectSameWidth(width, after.canvasTracks[track]!, `canvas track ${track + 1}`));
      before.cardTracks.forEach((width, track) => expectSameWidth(width, after.cardTracks[track]!, `card track ${track + 1}`));
      expect(after.outlineStyle).toBe('dashed');
      expect(Number.parseFloat(after.outlineOffset)).toBeLessThanOrEqual(-2);
      expect(after.sectionLeft).toBeGreaterThanOrEqual(after.canvasLeft - 1);
      expect(after.sectionRight).toBeLessThanOrEqual(after.canvasRight + 1);
      expect(after.toolbarPosition).toBe('absolute');
      expect(after.addCardInsideGrid).toBe(false);
      if (after.addCardLeft === null || after.addCardRight === null || after.addCardTop === null || after.toolbarLeft === null) {
        throw new Error(`${viewport.name}: edit controls are missing`);
      }
      expect(after.addCardLeft).toBeGreaterThanOrEqual(after.sectionLeft);
      expect(after.addCardRight).toBeLessThanOrEqual(after.sectionRight);
      expect(after.addCardTop).toBeGreaterThanOrEqual(after.gridBottom);
    }
  });
}

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

  await enterDashboardEdit(page);
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

test('Feature: Section appearance — Scenario: An owner can select and clear an optional section icon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  const dashboard = {
    ...responsiveDashboard,
    tabs: [{
      ...responsiveDashboard.tabs[0]!,
      widgets: [responsiveDashboard.tabs[0]!.widgets[0]!, section, {
        ...section,
        id: 'section-with-icon',
        config: {
          ...section.config,
          layout: { ...section.config.layout, y: 5 },
          binding: { ...section.config.binding, entityId: 'section-with-icon' },
          appearance: { ...section.config.appearance, title: 'Con icono', icon: 'mdi:home' },
          extra: { cards: [] },
        },
      }],
    }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  let savedDashboard = dashboard;
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const changes = route.request().postDataJSON() as Partial<typeof dashboard>;
    savedDashboard = { ...savedDashboard, ...changes };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(savedDashboard) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');

  const sectionWithoutIcon = page.locator('.homepilot-dashboard-widget').filter({ has: page.getByRole('heading', { name: 'Lecturas del hogar', exact: true }) });
  const sectionWithIcon = page.locator('.homepilot-dashboard-widget').filter({ has: page.getByRole('heading', { name: 'Con icono', exact: true }) });
  await expect(sectionWithoutIcon.locator('.homepilot-dashboard-section-heading svg')).toHaveCount(0);
  await expect(sectionWithIcon.locator('.homepilot-dashboard-section-heading svg')).toHaveCount(1);
  const sectionPadding = await sectionWithoutIcon.locator('section').evaluate((element) => ({
    left: getComputedStyle(element).paddingLeft,
    right: getComputedStyle(element).paddingRight,
  }));
  expect(sectionPadding).toEqual({ left: '20px', right: '20px' });

  await enterDashboardEdit(page);
  await sectionWithoutIcon.getByRole('button', { name: /^(Edit section|Editar sección)$/i }).click();
  const editor = page.getByRole('dialog', { name: /^(Edit section|Editar sección)$/i });
  const preview = editor.getByRole('group', { name: /^(Section preview|Vista previa de la sección)$/i });
  await expect(preview.locator('svg')).toHaveCount(0);
  await editor.getByRole('button', { name: /^(Icon|Icono)$/i }).click();
  const iconPicker = page.getByRole('dialog', { name: /^(Icon|Icono)$/i });
  const iconSearch = iconPicker.getByRole('searchbox');
  await expect(iconSearch).toBeFocused();
  await iconSearch.fill('home');
  await expect(iconSearch).toHaveValue('home');
  await expect(editor.getByRole('textbox', { name: /^(Section title|Título de sección)$/i })).toHaveValue('Lecturas del hogar');
  await iconPicker.getByRole('listbox', { name: /^(Icon|Icono)$/i }).getByRole('option', { name: 'home', exact: true }).click();
  await expect(preview.locator('svg')).toHaveCount(1);
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect(sectionWithoutIcon.locator('.homepilot-dashboard-section-heading svg')).toHaveCount(1);
  expect(savedDashboard.tabs[0]?.widgets.find((widget) => widget.id === 'responsive-section')?.config.appearance).toHaveProperty('icon', 'mdi:home');

  await sectionWithoutIcon.getByRole('button', { name: /^(Edit section|Editar sección)$/i }).click();
  await editor.getByRole('button', { name: /^(Remove icon|Quitar icono)$/i }).click();
  await expect(preview.locator('svg')).toHaveCount(0);
  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  await expect(sectionWithoutIcon.locator('.homepilot-dashboard-section-heading svg')).toHaveCount(0);
  await expect(sectionWithIcon.locator('.homepilot-dashboard-section-heading svg')).toHaveCount(1);
  expect(savedDashboard.tabs[0]?.widgets.find((widget) => widget.id === 'responsive-section')?.config.appearance).not.toHaveProperty('icon');
});

test.describe('Icon picker on touch tablets', () => {
  test.use({ hasTouch: true });

  for (const viewport of [
    { name: 'portrait', width: 820, height: 1180, keyboardHeight: 520 },
    { name: 'landscape', width: 1180, height: 820, keyboardHeight: 400 },
  ]) {
    test(`opens the icon grid before the keyboard and keeps results visible in tablet ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareAuthenticatedDashboard(page);
      await page.goto('/dashboards/responsive-dashboard/responsive-tab');
      await enterDashboardEdit(page, true);
      const section = page.locator('.homepilot-dashboard-widget').filter({ has: page.getByRole('heading', { name: 'Lecturas del hogar', exact: true }) });
      await section.getByRole('button', { name: /^(Edit section|Editar sección)$/i }).tap();
      const editor = page.getByRole('dialog', { name: /^(Edit section|Editar sección)$/i });
      await editor.getByRole('button', { name: /^(Icon|Icono)$/i }).tap();
      const picker = page.getByRole('dialog', { name: /^(Icon|Icono)$/i });
      const search = picker.getByRole('searchbox');
      await expect(picker).toBeFocused();
      await expect(search).not.toBeFocused();
      await expect(picker.getByRole('option').first()).toBeVisible();

      await search.tap();
      await expect(search).toBeFocused();
      await search.fill('home');
      await page.setViewportSize({ width: viewport.width, height: viewport.keyboardHeight });
      const option = picker.getByRole('listbox').getByRole('option', { name: 'home', exact: true });
      await expect(option).toBeVisible();
      const optionBounds = await option.boundingBox();
      expect(optionBounds).toBeTruthy();
      expect(optionBounds!.y + optionBounds!.height).toBeLessThanOrEqual(viewport.keyboardHeight);
      await option.tap();
      await expect(picker).toHaveCount(0);
    });
  }
});

test('Feature: Button cards — Scenario: Light and scene-action buttons share a 24px surface in active and inactive states', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  const buttonCards = [
    { id: 'light-on-card', kind: 'light', title: 'Luz activa', entityId: 'light-on', span: 'small' },
    { id: 'light-off-card', kind: 'light', title: 'Luz inactiva', entityId: 'light-off', span: 'small' },
    { id: 'scene-action-card', kind: 'action', title: 'Escena', entityId: 'scene-1', span: 'small' },
  ];
  const dashboard = {
    ...responsiveDashboard,
    tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [responsiveDashboard.tabs[0]!.widgets[0]!, {
      ...section,
      config: { ...section.config, extra: { cards: buttonCards } },
    }] }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([
      { id: 'light-on', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Luz activa', type: 'light', semanticType: 'light', status: 'ASSIGNED', lastKnownState: { state: 'on' } },
      { id: 'light-off', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Luz inactiva', type: 'light', semanticType: 'light', status: 'ASSIGNED', lastKnownState: { state: 'off' } },
    ]) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');

  const geometry = async (id: string) => page.locator(`[data-dashboard-card-id="${id}"] > :first-child`).evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return { radius: style.borderRadius, width: bounds.width, height: bounds.height, padding: style.padding };
  });
  await expect(page.locator('[data-dashboard-card-id="light-on-card"]')).toBeVisible();
  await expect(page.locator('[data-dashboard-card-id="light-off-card"]')).toBeVisible();
  await expect(page.locator('[data-dashboard-card-id="scene-action-card"]')).toBeVisible();
  const active = await geometry('light-on-card');
  const inactive = await geometry('light-off-card');
  const action = await geometry('scene-action-card');
  expect(active.radius).toBe('24px');
  expect(inactive).toEqual(active);
  expect(action.radius).toBe('24px');
  expect(action.padding).toBe(inactive.padding);

  const inactiveSurface = async (id: string) => page.locator(`[data-dashboard-card-id="${id}"] > :first-child`).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderWidth: style.borderWidth,
      borderStyle: style.borderStyle,
      boxSizing: style.boxSizing,
      backgroundColor: style.backgroundColor,
    };
  });
  expect(await inactiveSurface('scene-action-card')).toEqual(await inactiveSurface('light-off-card'));
});

test('Feature: Clock editing — Scenario: A fixed section clock can be moved, removed and added without an editor', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  if (!('extra' in section.config)) throw new Error('Responsive fixture has no section cards');
  const dashboard = {
    ...responsiveDashboard,
    tabs: [{
      ...responsiveDashboard.tabs[0]!,
      widgets: [responsiveDashboard.tabs[0]!.widgets[0]!, {
        ...section,
        config: {
          ...section.config,
          extra: { ...section.config.extra, cards: [
            section.config.extra.cards[4]!,
            { ...section.config.extra.cards[0]!, span: 'full' },
          ] },
        },
      }],
    }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  let savedDashboard = dashboard;
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const changes = route.request().postDataJSON() as Partial<typeof dashboard>;
    savedDashboard = { ...savedDashboard, ...changes };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(savedDashboard) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);

  const clock = page.locator('[data-dashboard-card-id="responsive-weather"]');
  const sensor = page.locator('[data-dashboard-card-id="responsive-sensor"]');
  const cardActions = /^(Card actions|Acciones de tarjeta)$/i;
  const edit = /^(Edit|Editar)$/i;
  await expect(clock.getByRole('button', { name: edit })).toHaveCount(0);
  await clock.hover();
  const clockActionsButton = clock.getByRole('button', { name: cardActions });
  await clockActionsButton.click();
  const clockMenu = page.getByRole('menu', { name: cardActions });
  await expect(clockMenu.getByRole('menuitem', { name: edit })).toHaveCount(0);
  await expect(clockMenu.getByRole('menuitem', { name: /^(Delete|Eliminar)$/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(clockMenu).not.toBeVisible();
  await expect(clockActionsButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('heading', { name: edit })).toHaveCount(0);

  await expect(sensor.getByRole('button', { name: edit })).toHaveCount(1);
  await sensor.hover();
  await sensor.getByRole('button', { name: cardActions }).click();
  await page.getByRole('menu', { name: cardActions }).getByRole('menuitem', { name: edit }).click();
  await expect(page.getByRole('heading', { name: edit })).toBeVisible();
  await page.getByRole('button', { name: /^(Close|Cerrar)$/i }).click();

  await clock.dragTo(sensor, { steps: 10 });
  await expect.poll(() => {
    const savedSection = savedDashboard.tabs[0]?.widgets.find((widget) => widget.id === 'responsive-section');
    if (!savedSection || !('extra' in savedSection.config)) return [];
    return savedSection.config.extra.cards.map((card) => card.id);
  }).toEqual(['responsive-sensor', 'responsive-weather']);

  await clock.hover();
  await clock.getByRole('button', { name: cardActions }).click();
  await page.getByRole('menu', { name: cardActions }).getByRole('menuitem', { name: /^(Delete|Eliminar)$/i }).click();
  await expect(clock).toHaveCount(0);

  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  const cardCatalog = page.locator('.max-h-section-modal').filter({
    has: page.getByRole('heading', { name: /^(Add card to section|Añadir tarjeta a la sección)$/i }),
  });
  await cardCatalog.getByRole('button', { name: /^(Clock|Reloj)$/i })
    .and(cardCatalog.locator('.max-h-section-editor > div > div > button[type="button"]'))
    .click();
  await expect(page.getByRole('heading', { name: /^(Add card to section|Añadir tarjeta a la sección)$/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: edit })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /^(Name|Nombre)$/i })).toHaveCount(0);
  await expect(page.locator('[data-homepilot-clock]')).toHaveCount(1);
});

test('Feature: Clock editing — Scenario: A standalone clock has no Configure action but retains layout controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const dashboard = {
    ...responsiveDashboard,
    tabs: [{
      ...responsiveDashboard.tabs[0]!,
      widgets: [responsiveDashboard.tabs[0]!.widgets[0]!, {
        id: 'standalone-clock',
        type: 'clock_display',
        config: {
          layout: { x: 0, y: 1, w: 3, h: 4, span: 3 },
          binding: { entityId: 'standalone-clock', entityType: 'system', entityName: 'Reloj' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: { title: 'Reloj', showTitle: true },
        },
      }],
    }],
  };
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await enterDashboardEdit(page);

  const clock = page.locator('.homepilot-dashboard-widget').filter({ has: page.locator('[data-homepilot-clock]') });
  await expect(clock).toHaveCount(1);
  await expect(clock.getByRole('button', { name: /^(Configure|Configurar)$/i })).toHaveCount(0);
  await expect(clock.getByRole('button', { name: /^(Drag to reorder|Arrastrar para reordenar)$/i })).toBeVisible();
  await expect(clock.getByRole('button', { name: /^(Delete|Eliminar)$/i })).toBeVisible();
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
  await enterDashboardEdit(page);
  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  await page.getByRole('button', { name: /^(Reproductor|Media player)$/i }).click();

  const editorHeading = page.getByRole('heading', { name: /^(Edit|Editar)$/i });
  await expect(editorHeading).toBeVisible();
  const editor = editorHeading.locator('..').locator('..').locator('..');
  const editorPreview = editor.locator('.custom-scrollbar > .grid');
  await expect(editor.getByRole('button', { name: /^(Premium)$/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(editorPreview.locator('[data-media-player="homepilot-premium"]')).toBeVisible();
  await expect(editor.getByText(/^(Card width|Ancho de tarjeta)$/i)).toHaveCount(0);
  await page.getByRole('button', { name: /^(Save|Guardar)$/i }).click();

  const mediaCard = page.locator('[class*="group/card"]').filter({ hasText: /Reproductor|Media player/i });
  await expect(mediaCard.locator('[data-media-player="homepilot-premium"]')).toBeVisible();
  await expect(mediaCard).toHaveClass(/col-span-full/);
  await expect(mediaCard.getByRole('slider', { name: /resize card|redimensionar tarjeta/i })).toHaveCount(0);
  await expect.poll(() => {
    const section = savedDashboard.tabs[0]?.widgets.find((widget) => widget.id === 'responsive-section');
    if (!section || !('extra' in section.config)) return undefined;
    const mediaCard = (section.config.extra.cards as Array<{ kind: string; mediaVariant?: string }>).find((card) => card.kind === 'media');
    return mediaCard?.mediaVariant;
  }).toBe('premium');
});

test('Feature: Media Player design — Scenario: Classic preview and persisted design retain the same player controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  const dashboard = {
    ...responsiveDashboard,
    tabs: [{ ...responsiveDashboard.tabs[0]!, widgets: [{
      ...section,
      config: { ...section.config, extra: { cards: [{ id: 'media-design', kind: 'media', title: 'Sala', entityId: 'player-1', span: 'full' }] } },
    }] }],
  };
  let savedDashboard: object = dashboard;
  const player = {
    id: 'player-1', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Sala', type: 'media_player', status: 'ASSIGNED',
    profile: { supportedCommands: ['media_play', 'media_pause', 'volume_set'] },
    lastKnownState: { state: 'paused', attributes: { media_title: 'Canción', media_artist: 'Artista', volume_level: 0.4 } },
  };
  const commands: unknown[] = [];
  await prepareAuthenticatedDashboard(page, dashboard);
  await page.route('**/api/v1/dashboards', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([savedDashboard]) });
  });
  await page.route('**/api/v1/dashboards/responsive-dashboard', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    savedDashboard = { ...savedDashboard, ...(route.request().postDataJSON() as object) };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(savedDashboard) });
  });
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([player]) });
  });
  await page.route('**/api/v1/devices/player-1/command', async (route) => {
    commands.push(route.request().postDataJSON());
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(player) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');

  const card = page.locator('[data-dashboard-card-id="media-design"]');
  await expect(card.locator('[data-media-player="homepilot-premium"]')).toBeVisible();
  await expect(card.getByText('Canción')).toBeVisible();
  await card.getByRole('button', { name: /^(Play|Reproducir)$/i }).click();
  await expect.poll(() => commands.length).toBe(1);

  await enterDashboardEdit(page);
  await card.hover();
  const cardActions = /^(Card actions|Acciones de tarjeta)$/i;
  await card.getByRole('button', { name: cardActions }).click();
  await page.getByRole('menu', { name: cardActions }).getByRole('menuitem', { name: /^(Edit|Editar)$/i }).click();
  await expect(page.getByRole('button', { name: /^(Premium)$/i })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^(Classic|Clásico)$/i }).click();
  await expect(page.getByRole('button', { name: /^(Classic|Clásico)$/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-media-player="homepilot-classic"]')).toBeVisible();
  await page.getByRole('button', { name: /^(Save|Guardar)$/i }).click();

  const persistedMedia = () => {
    const stored = savedDashboard as { tabs: Array<{ widgets: Array<{ id: string; config: { extra?: { cards?: Array<{ id: string; entityId?: string; mediaVariant?: string }> } } }> }> };
    return stored.tabs[0]?.widgets.find((widget) => widget.id === 'responsive-section')?.config.extra?.cards?.find((item) => item.id === 'media-design');
  };
  await expect.poll(() => persistedMedia()?.mediaVariant).toBe('classic');
  expect(persistedMedia()?.entityId).toBe('player-1');
  await page.reload();
  await expect(card.locator('[data-media-player="homepilot-classic"]')).toBeVisible();
  await expect(card.getByText('Canción')).toBeVisible();
  await card.getByRole('button', { name: /^(Play|Reproducir)$/i }).click();
  await expect.poll(() => commands.length).toBe(2);
  expect(commands[1]).toEqual(commands[0]);
});

for (const mediaVariant of ['premium', 'classic'] as const) {
test(`Feature: Media player idle — Scenario: ${mediaVariant} reports no playback without stale metadata or changing its controls`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = responsiveDashboard.tabs[0]!.widgets[1]!;
  const mediaDashboard = {
    ...responsiveDashboard,
    tabs: [{
      ...responsiveDashboard.tabs[0]!,
      widgets: [{
        ...section,
        config: {
          ...section.config,
          extra: { cards: [{ id: 'media-idle', kind: 'media', mediaVariant, title: 'Sala', entityId: 'player-1', span: 'full' }] },
        },
      }],
    }],
  };
  await prepareAuthenticatedDashboard(page, mediaDashboard);
  let mediaState = 'idle';
  await page.route('**/api/v1/devices', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{
      id: 'player-1', homeId: 'responsive-home', roomId: 'responsive-room', name: 'Sala',
      type: 'media_player', status: 'ASSIGNED',
      profile: { supportedCommands: ['media_play', 'media_pause', 'volume_set'] },
      lastKnownState: mediaState === 'idle'
        ? { state: 'idle', attributes: { media_title: 'Previous session', media_artist: 'Previous artist', entity_picture: '/old-cover.png', volume_level: 0.4 } }
        : { state: 'playing', attributes: { media_title: 'Canción actual', media_artist: 'Artista actual', volume_level: 0.4, ...(mediaVariant === 'classic' ? { media_duration: 180, media_position: 42 } : {}) } },
    }]) });
  });

  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  const card = page.locator('[data-dashboard-card-id="media-idle"]');
  await expect(card).toBeVisible();
  await expect(card.getByText(/^(Sin reproducción|Nothing playing)$/)).toBeVisible();
  await expect(card).toContainText('Sala');
  await expect(card).not.toContainText('Previous session');
  await expect(card).not.toContainText('Previous artist');
  await expect(card.locator('img')).toHaveCount(0);
  await expect(card.getByRole('button', { name: /^(Reproducir|Play)$/i })).toBeVisible();
  await expect(card.getByRole('button', { name: /^(Reproducir|Play)$/i })).toBeEnabled();
  const idleHeight = await card.evaluate((element) => element.getBoundingClientRect().height);
  const idlePlay = (await card.getByRole('button', { name: /^(Play|Reproducir)$/i }).boundingBox())!;
  const idleControls = await card.locator('button').count();

  mediaState = 'playing';
  await page.reload();
  await expect(card.getByText('Canción actual')).toBeVisible();
  await expect(card.getByText('Artista actual')).toBeVisible();
  await expect(card.getByText(/^(Sin reproducción|Nothing playing)$/)).toHaveCount(0);
  expect(await card.locator('button').count()).toBe(idleControls);
  expect(Math.abs((await card.evaluate((element) => element.getBoundingClientRect().height)) - idleHeight)).toBeLessThanOrEqual(2);
  if (mediaVariant === 'classic') {
    const playingPause = (await card.getByRole('button', { name: /^(Pause|Pausar)$/i }).boundingBox())!;
    expect(playingPause.y).toBeCloseTo(idlePlay.y, 1);
    await expect(card.locator('[data-media-progress-slot]')).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1441);

  await enterDashboardEdit(page);
  await expect(card.locator('[data-media-player] > div').first().locator('p').first().locator('..').locator('svg')).toHaveCount(0);
  await card.hover();
  const cardActions = card.getByRole('button', { name: /^(Card actions|Acciones de tarjeta)$/i });
  await cardActions.click();
  await expect(page.getByRole('menu', { name: /^(Card actions|Acciones de tarjeta)$/i })).toBeVisible();
});
}

test('Feature: Button card default — Scenario: A new button persists the first width and previews an inactive compact tile', async ({ page }) => {
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
  await enterDashboardEdit(page);
  await page.getByRole('button', { name: /^(Add card|Añadir tarjeta)$/i }).click();
  const catalogButton = page.getByRole('button', { name: /^(Button|Botón)$/i });
  const catalogCard = catalogButton.locator('..');
  const catalogSpacing = await catalogCard.evaluate((element) => {
    const lastLabel = element.querySelector(':scope > div:nth-child(2) > span:last-child');
    return lastLabel ? element.getBoundingClientRect().bottom - lastLabel.getBoundingClientRect().bottom : Number.POSITIVE_INFINITY;
  });
  expect(catalogSpacing).toBeLessThanOrEqual(24);
  await catalogButton.click();

  const editor = page.locator('[class*="max-w-xl"]').filter({ has: page.getByRole('heading', { name: /^(Edit|Editar)$/i }) });
  const preview = editor.locator('[class*="h-device-card-compact"]').first();
  await expect(preview).toBeVisible();
  await expect(preview).not.toHaveClass(/homepilot-section-light-tile-active/);
  await expect(preview.getByText(/^(Button|Botón)$/i)).toBeVisible();
  await expect(editor.getByText(/^(Small · 4 per row|Pequeña · 4 por fila)$/i)).toBeVisible();
  const previewBox = await preview.boundingBox();
  expect(previewBox?.height).toBeLessThanOrEqual(98);
  expect(await preview.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);

  await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
  const buttonCard = page.locator('[data-card-id]').filter({ hasText: /^(Button|Botón)$/i }).last();
  await expect(buttonCard).toHaveClass(/col-span-1/);
  await expect.poll(() => JSON.stringify(savedDashboard)).toMatch(/"kind":"light"[^}]*"span":"small"/);
});

test('Feature: Dashboard import — Scenario: Pending bindings and local backgrounds are reported without exposing source IDs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/dashboards/responsive-dashboard/tabs/import', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ...responsiveDashboard,
        tabs: [...responsiveDashboard.tabs, { ...responsiveDashboard.tabs[0], id: 'imported-tab', isDefault: false }],
        importReport: {
          unresolvedBindings: [{ tabTitle: 'Principal', widgetId: 'imported-widget', cardId: 'card-1', title: 'Luz', targetType: 'device' }],
          nonPortableBackgrounds: 1,
        },
      }),
    });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  await page.locator('.homepilot-dashboard-titlebar input[type="file"]').setInputFiles({
    name: 'dashboard.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'homepilot-dashboard-tab', version: 1, tab: { id: 'portable-tab', title: 'Principal', widgets: [] } })),
  });

  await expect(page.getByText(/Pestaña importada con asignaciones pendientes|Tab imported with pending assignments/i)).toBeVisible();
  await expect(page.getByText(/Asignaciones sin resolver: 1|Unresolved assignments: 1/i)).toBeVisible();
  await page.getByText(/Ver asignaciones pendientes|Show pending assignments/i).click();
  await expect(page.getByText(/Luz · Sin asignar|Luz · Unassigned/i)).toBeVisible();
  await expect(page.locator('details').filter({ hasText: /Luz · (Sin asignar|Unassigned)/i })).toContainText('Principal');
  await expect(page.getByText('imported-widget')).toHaveCount(0);
  await expect(page.getByText('card-1')).toHaveCount(0);
});

for (const viewport of [...viewports, { name: 'portrait kiosk', ...portraitKioskViewport }]) {
  test(`Feature: Dashboard tablet UX — Scenario: Toolbar, sensor and clock fit ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.goto('/dashboards/responsive-dashboard/responsive-tab');

    const titlebar = page.locator('.homepilot-dashboard-titlebar');
    const more = titlebar.locator('details > summary');
    await expect(titlebar.getByRole('button', { name: /new panel|nuevo panel|delete panel|eliminar panel/i })).toHaveCount(0);
    await expect(more).toBeVisible();
    await more.click();
    await expect(titlebar.getByRole('menuitem', { name: /dashboard history|historial del tablero/i })).toBeVisible();
    await expect(titlebar.getByRole('menuitem', { name: /export tab|exportar pestaña/i })).toBeVisible();
    await expect(titlebar.getByRole('menuitem', { name: /import tab|importar pestaña/i })).toBeVisible();
    await expect(titlebar.getByRole('menuitem', { name: /^(Edit|Editar)$/i })).toHaveCount(1);
    await expect(titlebar.getByRole('button', { name: /^(Edit|Editar|Rename|Renombrar)$/i })).toHaveCount(0);
    await more.click();
    await expect(page.locator('.sensor-metric-card').first()).not.toContainText('LISTO');
    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      sensors: [...document.querySelectorAll<HTMLElement>('.sensor-metric-card')].map((card) => ({
        scrollWidth: card.scrollWidth, clientWidth: card.clientWidth,
      })),
      clocks: [...document.querySelectorAll<HTMLElement>('.min-h-clock-card')].map((card) => ({
        scrollWidth: card.scrollWidth, clientWidth: card.clientWidth,
      })),
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    geometry.sensors.forEach((card) => expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth));
    geometry.clocks.forEach((card) => expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth));
    if (viewport.width < 640) {
      await enterDashboardEdit(page);
      await expect(titlebar.getByRole('textbox', { name: /^(Rename|Renombrar)$/i })).toBeVisible();
      await expect(more).toBeVisible();
      const titlebarWidth = await titlebar.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
      expect(titlebarWidth.scroll).toBeLessThanOrEqual(titlebarWidth.client);
    }
  });
}

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
  await enterDashboardEdit(page);
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
  await expect(sceneButton.locator('svg').first()).toHaveClass(/text-primary/);
  await expect(sceneTile.locator('svg.lucide-loader-circle')).toHaveCount(0);
  finishSceneExecution?.();
  await expect(sceneButton).toHaveAttribute('data-action-state', 'success');
  await expect(sceneTile).toHaveClass(/homepilot-section-light-tile-active/);
  await expect(sceneButton.locator('svg').first()).toHaveClass(/text-primary/);
  await expect(sceneButton.locator('svg.lucide-check')).toHaveCount(0);
  await expect(sceneButton.getByText(/^(Done|Listo)$/i)).toHaveCount(0);
  await expect(sceneButton).toHaveAttribute('data-action-state', 'idle', { timeout: 4000 });
  await expect(sceneTile).not.toHaveClass(/homepilot-section-light-tile-active/);
  await expect(sceneButton.locator('svg').first()).toHaveClass(/text-foreground\/80/);
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
  await enterDashboardEdit(page);
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
  await enterDashboardEdit(page);

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
    await expect(page.locator('.homepilot-dashboard-titlebar')).toBeVisible();
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

    for (const title of ['Temperatura de sala', 'GUS-RAM', 'iPad Guest Level']) {
      await expect(page.locator('.sensor-metric-card').getByText(title, { exact: true })).toHaveCount(1);
    }
    const sensorSurface = page.locator('[data-dashboard-card-id="responsive-battery"] .sensor-metric-card');
    const sensorGeometry = () => sensorSurface.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        width: rect.width,
        height: rect.height,
        padding: style.padding,
        borderRadius: style.borderRadius,
        borderWidth: style.borderWidth,
        backgroundColor: style.backgroundColor,
      };
    });
    const darkSensor = await sensorGeometry();
    await expect(page.getByText('Cortina de sala').first()).toBeVisible();
    await expect(page.locator('.min-h-clock-card').first()).toBeVisible();

    await page.evaluate(() => document.documentElement.classList.add('light'));
    const lightSensor = await sensorGeometry();
    expect({ ...lightSensor, backgroundColor: darkSensor.backgroundColor }).toEqual(darkSensor);
    expect(lightSensor.backgroundColor).not.toBe(darkSensor.backgroundColor);
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

  test(`keeps the home flip clock and context chips responsive on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);

    await page.goto('/');
    const climateSummary = page.getByLabel(/contexto local del hogar|local home context/i);
    await expect(climateSummary).toBeVisible();
    await expect(climateSummary.getByText('Cuenca')).toHaveCount(1);
    await expect(climateSummary.locator('time')).toBeVisible();
    await expect(climateSummary.getByText(/°C|clima no disponible|weather unavailable|cargando clima|loading weather/i)).toBeVisible();
    await expect(climateSummary.locator('.homepilot-home-chip')).toHaveCount(3);
    await expect(climateSummary.getByText(/^(Ubicación|Location)$/)).toHaveCount(0);
    await expect(climateSummary.getByRole('button')).toHaveCount(1);
    const ownDashboard = climateSummary.getByRole('button', { name: /abrir la pestaña Principal de mi tablero|open.*Principal.*dashboard/i });
    await expect(ownDashboard).toBeVisible();
    const ambientImage = page.locator('img[src="/home-dashboard-ambient.png"]');
    await expect(ambientImage).toBeVisible();
    await expect(ambientImage).toHaveAttribute('alt', '');

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    await ownDashboard.click();
    await expect(page).toHaveURL(/\/dashboards\/responsive-dashboard\/responsive-tab$/);
  });

  test(`keeps dashboard history accessible on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);

    await page.goto('/dashboards/responsive-dashboard/responsive-tab');
    const titlebar = page.locator('.homepilot-dashboard-titlebar');
    await titlebar.getByLabel(/^(More|Más)$/i).click();
    await titlebar.getByRole('menuitem', { name: /dashboard history|historial del tablero/i }).click();

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
      body: JSON.stringify([{ id: 'light-1', name: 'Living Room Light', type: 'light', status: 'ASSIGNED' }]),
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

  const deviceSelector = dialog.getByRole('button', { name: /select device|seleccionar dispositivo/i });
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
  await page.locator('.homepilot-dashboard-titlebar').getByLabel(/^(More|Más)$/i).click();
  await expect(page.getByRole('menuitem', { name: /dashboard history|historial del tablero/i })).toBeVisible();

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
