import { expect, test } from '@playwright/test';
import {
  enterDashboardEdit,
  dashboardUser,
  responsiveDevices,
  responsiveDashboard,
  waitForSettledLayout,
  prepareAuthenticatedDashboard,
} from './helpers/responsiveShell';

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  test(`Feature: Semantic Modbus configuration — Scenario: Guided points and historical drafts fit ${viewport.width} (AC42)`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport); await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'h', name: 'Home' }] }));
    const profileId = 'xinje-xl5e-16t-v2';
    const variables: Array<Record<string, unknown>> = [{ deviceId: 'historical-fixture', connectionId: 'fixture', name: 'Historical D110', profileId, symbolicAddress: 'D110', area: 'holding_register', address: 110, dataType: 'int16', scale: 0.1, offset: 0, unit: '°C', wordOrder: 'high_first', writable: false, plc: { role: 'measurement', mode: 'sustained', feedbackPolicy: 'none', pulseDurationMs: 500, feedbackTimeoutMs: 2000 } }];
    const connection = { id: 'fixture', homeId: 'h', name: 'Semantic fixture', host: '127.0.0.1', port: 502, unitId: 1, profileId, moduleCapacities: { CPU: { inputs: 16, outputs: 8 }, '1': { inputs: 8, outputs: 8 } }, enabled: false, timeoutMs: 2000, pollIntervalMs: 5000, variables };
    const saved: Array<Record<string, unknown>> = [], forbidden: string[] = [];
    await page.route('**/api/v1/modbus/**', route => {
      const request = route.request();
      if (request.method() === 'GET') return route.fulfill({ json: { connections: [connection] } });
      if (!request.url().includes('/variables')) { forbidden.push(request.url()); return route.fulfill({ status: 400, json: {} }); }
      const body = request.postDataJSON(); saved.push(body);
      const index = variables.findIndex(variable => request.url().endsWith(`/${variable.deviceId}`));
      const variable = { ...body, deviceId: index >= 0 ? variables[index].deviceId : `new-fixture-${saved.length}`, connectionId: 'fixture' };
      if (index >= 0) variables[index] = variable; else variables.push(variable);
      return route.fulfill({ json: { variable } });
    });
    await page.route('**/api/v1/devices/*/command', route => { forbidden.push('command'); return route.fulfill({ status: 400, json: {} }); });
    await page.goto('/system/modbus');
    await page.evaluate(language => localStorage.setItem('i18nextLng', language), viewport.width === 390 || viewport.width === 1024 ? 'en' : 'es'); await page.reload();
    await page.getByRole('button', { name: /^(View variables|Ver variables)$/i }).click();
    const editor = page.getByRole('dialog', { name: /^(Configure variable|Configurar variable)$/i });
    const add = async (name: string, role: RegExp) => {
      await page.getByRole('button', { name: /^(Add variable|Añadir variable)$/i }).click();
      await editor.getByLabel(/^(Name|Nombre)$/i).fill(name);
      await expect(editor.locator('[data-modbus-point-summary]')).toHaveCount(0);
      await expect(editor.locator('[data-modbus-editor-options]')).toHaveCount(0);
      await expect(editor.getByRole('button', { name: /^(Save|Guardar)$/i })).toBeDisabled();
      await editor.getByRole('button', { name: /^(Home Pilot usage|Uso en Home Pilot)$/i }).click(); await page.getByRole('option', { name: role, exact: true }).click();
    };
    const physicalInput = () => editor.getByRole('group', { name: /^(Physical input|Entrada física)$/i });
    const channel = (group: ReturnType<typeof physicalInput>) => group.getByLabel(/^(Channel|Canal)$/i);
    await add('Input ordinal', /^(Inputs|Entradas)$/i);
    await expect(editor.getByRole('button', { name: /^(Visualization|Visualización)$/i })).toHaveCount(0);
    await expect(editor.getByRole('button', { name: /^(Unit|Unidad)$/i, exact: true })).toHaveCount(0);
    const addressBounds = (await editor.locator('[data-modbus-editor-address]').boundingBox())!;
    const optionsBounds = (await editor.locator('[data-modbus-editor-options]').boundingBox())!;
    if (viewport.width >= 1024) {
      expect((await editor.boundingBox())!.width).toBeGreaterThan(800);
      expect(optionsBounds.x).toBeGreaterThanOrEqual(addressBounds.x + addressBounds.width);
    } else {
      expect(optionsBounds.y).toBeGreaterThanOrEqual(addressBounds.y + addressBounds.height);
    }
    // A role change must not retain D0's numeric draft; no blur or repeated entry.
    for (const [ordinal, symbol] of [[0, 'X0'], [1, 'X1'], [7, 'X7'], [8, 'X10']] as const) {
      await channel(physicalInput()).fill(String(ordinal));
      await expect(physicalInput().locator('[data-modbus-point-summary]')).toContainText(symbol);
      await expect(physicalInput().locator('[data-modbus-point-summary]')).toContainText(`PDU ${20480 + ordinal}`);
      await expect(channel(physicalInput())).toBeFocused();
    }
    await expect(physicalInput().locator('[data-modbus-point-summary]')).toContainText('PDU 20488');
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      await editor.getByLabel(/^(Name|Nombre)$/i).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`semantic-editor-${theme}.png`), animations: 'disabled' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      const bounds = (await editor.boundingBox())!; expect(bounds.width).toBeLessThanOrEqual(viewport.width); expect(bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(saved[0]).toMatchObject({ symbolicAddress: 'X10', address: 20488, plc: { role: 'input', physical: { symbolicAddress: 'X10' } } });
    expect((saved[0].plc as Record<string, unknown>).logical).toBeUndefined();
    // Declared expansion, not a guessed CPU/channel map.
    await add('Expansion input', /^(Inputs|Entradas)$/i);
    await physicalInput().getByRole('button', { name: /^(Physical module|Módulo físico)$/i }).click(); await page.getByRole('option', { name: '1', exact: true }).click();
    await expect(physicalInput().locator('[data-modbus-point-summary]')).toContainText('X10000');
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(saved[1]).toMatchObject({ symbolicAddress: 'X10000', address: 20736 });
    await add('Output fixture', /^(Outputs|Salidas)$/i);
    const physicalOutput = editor.getByRole('group', { name: /^(Physical output|Salida física)$/i });
    await channel(physicalOutput).fill('0');
    const command = editor.getByRole('group', { name: /^(PLC command|Comando PLC)$/i });
    await command.getByLabel(/^(Index|Índice)$/i).fill('200');
    await expect(physicalOutput.locator('[data-modbus-point-summary]')).toContainText('Y0');
    await expect(command.locator('[data-modbus-point-summary]')).toContainText('M200');
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(saved[2]).toMatchObject({ symbolicAddress: 'M200', plc: { physical: { symbolicAddress: 'Y0', address: 24576 }, command: { symbolicAddress: 'M200' }, feedbackPolicy: 'none' } });
    await add('Command fixture', /^(PLC commands|Comandos PLC)$/i);
    await editor.getByRole('group', { name: /^(PLC command|Comando PLC)$/i }).getByLabel(/^(Index|Índice)$/i).fill('100');
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(saved[3]).toMatchObject({ symbolicAddress: 'M100', address: 100, plc: { role: 'output_command', command: { symbolicAddress: 'M100' } } });
    expect((saved[3].plc as Record<string, unknown>).relatedPhysicalOutputs).toBeUndefined();
    await add('Measurement fixture', /^(Measurements|Mediciones)$/i);
    await editor.getByRole('group', { name: /^(Point|Punto)$/i }).getByLabel(/^(Index|Índice)$/i).fill('110');
    await expect(editor.locator('[data-modbus-point-summary]').first()).toContainText('D110');
    await expect(editor.locator('[data-modbus-point-summary]').first()).toContainText('FC03');
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(saved[4]).toMatchObject({ symbolicAddress: 'D110', address: 110, plc: { role: 'measurement' } });
    // Historical advanced view is a read-only projection until explicit edits.
    const before = JSON.stringify(variables[0]);
    await page.getByRole('button', { name: /^(Configure|Configurar) Historical D110$/i }).click();
    await expect(editor.getByLabel(/^(PLC element|Elemento PLC)$/i, { exact: true })).toHaveValue('D110');
    const advanced = editor.getByRole('switch', { name: /^(Advanced configuration|Configuración avanzada)$/i });
    await advanced.focus(); await page.keyboard.press('Space'); await expect(advanced).toHaveAttribute('aria-checked', 'false');
    await expect(editor.locator('[data-modbus-point-summary]').first()).toContainText('D110');
    await advanced.click(); await expect(editor.getByLabel(/^(PLC element|Elemento PLC)$/i, { exact: true })).toHaveValue('D110');
    await editor.getByRole('button', { name: /^(Cancel|Cancelar)$/i }).click(); expect(JSON.stringify(variables[0])).toBe(before);
    // Switching role/profile must warn BEFORE discarding relationships.
    await page.getByRole('button', { name: /^(Configure|Configurar) Output fixture$/i }).click();
    await editor.getByRole('button', { name: /^(Home Pilot usage|Uso en Home Pilot)$/i }).click(); await page.getByRole('option', { name: /^(PLC commands|Comandos PLC)$/i, exact: true }).click();
    const warning = page.getByRole('dialog', { name: /^(Review configuration change|Revisar cambio de configuración)$/i });
    await expect(warning).toBeVisible(); await warning.getByRole('button', { name: /^(Cancel|Cancelar)$/i }).click();
    await expect(editor.getByLabel(/^(Physical output|Salida física)$/i)).toHaveValue('Y0');
    await editor.getByRole('button', { name: /^(Addressing|Direccionamiento)$/i }).click(); await page.getByRole('option', { name: /v1$/i }).click();
    await expect(warning).toBeVisible(); await warning.getByRole('button', { name: /^(Confirm|Confirmar)$/i }).click();
    await expect(editor.getByLabel(/^(PLC command|Comando PLC)$/i, { exact: true })).toHaveValue('');
    await editor.getByRole('button', { name: /^(Cancel|Cancelar)$/i }).click();
    expect(saved).toHaveLength(5); expect(forbidden).toEqual([]); expect(JSON.stringify(variables[0])).toBe(before);
  });
}

for (const width of [390, 768, 1024, 1440]) {
  test(`Feature: Compact Modbus navigation — Scenario: Local filters preserve bindings at ${width} (AC40)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
    await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'h', name: 'Home' }] }));
    const variables = [10, 2, 1].map(number => ({ deviceId: `v${number}`, connectionId: 'c', name: `Input ${number}`, symbolicAddress: `M${number}`, address: number, area: 'coil', dataType: 'boolean', scale: 1, offset: 0, wordOrder: 'high_first', unit: '', writable: false, diagnostic: { status: number === 2 ? 'error' : 'online', value: false, ...(number === 2 ? { error: 'TIMEOUT' } : {}) }, plc: { role: 'input', physical: { profileId: 'xinje-xl5e-16t-v1', symbolicAddress: `X${number}`, address: 20480 + number, area: 'coil' }, mode: 'sustained', feedbackPolicy: 'none', feedbackTimeoutMs: 2000, pulseDurationMs: 500 } }));
    const output = { ...variables[0], deviceId: 'output', name: 'Output Y0', symbolicAddress: 'M200', plc: { ...variables[0].plc, role: 'output', physical: { ...variables[0].plc.physical, symbolicAddress: 'Y0', address: 24576 }, command: { ...variables[0].plc.physical, symbolicAddress: 'M200', address: 200 } } };
    const command = { ...variables[0], deviceId: 'command', name: 'Command M100', symbolicAddress: 'M100', address: 100, plc: { role: 'output_command', command: { profileId: 'xinje-xl5e-16t-v1', symbolicAddress: 'M100', area: 'coil', address: 100 }, relatedPhysicalOutputs: [output.plc.physical, { ...output.plc.physical, symbolicAddress: 'Y1', address: 24577 }], mode: 'sustained', feedbackPolicy: 'none', feedbackTimeoutMs: 2000, pulseDurationMs: 500 } };
    const measurement = { ...variables[0], deviceId: 'measurement', name: 'Temperature D110', symbolicAddress: 'D110', address: 110, area: 'holding_register', dataType: 'uint16', scale: 0.1, unit: '°C', diagnostic: { status: 'online', value: 22, raw: [220] }, plc: { role: 'measurement', feedbackPolicy: 'none', feedbackTimeoutMs: 2000, pulseDurationMs: 500 } };
    const connection = { id: 'c', homeId: 'h', name: 'PLC fixture', host: '127.0.0.1', port: 502, unitId: 1, enabled: true, timeoutMs: 2000, pollIntervalMs: 5000, diagnostic: { status: 'online' }, variables: [...variables, output, command, measurement] };
    const writes: string[] = [];
    await page.route('**/api/v1/modbus/**', route => { if (route.request().method() !== 'GET') writes.push(route.request().method()); return route.fulfill({ json: { connections: [connection] } }); });
    await page.route('**/api/v1/devices/*/command', route => { writes.push('command'); return route.fulfill({ json: {} }); });
    for (const language of ['es', 'en']) {
      await page.goto('/system/modbus');
      await page.evaluate(value => localStorage.setItem('i18nextLng', value), language); await page.reload();
      await expect(page.getByRole('button', { name: /Add connection|Añadir conexión/i })).toBeVisible();
      await page.getByRole('button', { name: /^(View variables|Ver variables)$/i }).click();
      await expect(page.getByRole('button', { name: /Add connection|Añadir conexión/i })).toHaveCount(0);
      const card = page.getByRole('region', { name: 'PLC fixture', exact: true });
      const rows = card.locator('[data-modbus-variable-group="input"] li');
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText('Input 1'); await expect(rows.nth(1)).toContainText('Input 2'); await expect(rows.nth(2)).toContainText('Input 10');
      const grid = card.locator('[data-modbus-variable-group="input"] [data-modbus-variable-grid]');
      const columns = await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
      expect(columns).toBeGreaterThanOrEqual(width >= 1024 ? 2 : 1);
      const first = rows.first();
      const compactBounds = await first.boundingBox();
      expect(compactBounds?.height).toBeLessThan(120);
      await expect(first.locator('[data-modbus-variable-diagnostic]')).toHaveCount(0);
      const technicalSwitch = card.getByRole('button', { name: /^(Technical details|Detalles técnicos)$/i });
      await expect(technicalSwitch).toHaveAttribute('aria-pressed', 'false');
      await technicalSwitch.click();
      await expect(technicalSwitch).toHaveAttribute('aria-pressed', 'true');
      const diagnostic = first.locator('[data-modbus-variable-diagnostic]');
      await expect(diagnostic).toContainText('PDU 1');
      await expect(diagnostic).toContainText('FC01');
      expect((await first.boundingBox())!.height).toBeGreaterThan(compactBounds!.height);
      await technicalSwitch.click();
      await expect(first.locator('[data-modbus-variable-diagnostic]')).toHaveCount(0);
      const configure = first.getByRole('button', { name: /Input 1/ });
      await configure.focus(); await expect(configure).toBeFocused();
      const controlBounds = await configure.boundingBox();
      expect(controlBounds!.width).toBeGreaterThanOrEqual(43.99);
      expect(controlBounds!.height).toBeGreaterThanOrEqual(43.99);
      const search = card.getByRole('searchbox');
      await search.fill('X2'); await expect(rows).toHaveCount(1);
      await search.fill('missing-point'); await expect(card.getByRole('status').filter({ hasText: /No results|No se encontraron resultados/i })).toBeVisible();
      await search.fill('');
      await card.getByRole('radio', { name: /^(Outputs|Salidas) \(1\)$/i }).click();
      await expect(rows).toHaveCount(0); await expect(card.locator('li')).toHaveCount(1);
      await card.getByRole('radio', { name: /^(All|Todo) \(6\)$/i }).click();
      await card.getByRole('button', { name: /Variables with errors|Variables con error/i }).click();
      await expect(card.locator('li')).toHaveCount(1); await expect(card.locator('li')).toContainText('Input 2');
      await card.getByRole('button', { name: /Variables with errors|Variables con error/i }).click();
      for (const theme of ['dark', 'light']) {
        await page.evaluate(value => document.documentElement.classList.toggle('light', value === 'light'), theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        await page.screenshot({ path: testInfo.outputPath(`modbus-compact-${language}-${theme}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    expect(writes).toEqual([]);
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  test(`Feature: Momentary PLC action UI — Scenario: Historical cards execute once and return ready at ${viewport.width} (AC39)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const makeDevice = (id: string, name: string, role: string, mode: string) => ({ id, name, homeId: 'responsive-home', roomId: 'room-test', status: 'ASSIGNED', type: 'switch', integrationSource: 'modbus-tcp',
      capabilities: [{ type: 'switch', name: 'PLC', commands: (mode === 'pulse' ? ['press', 'pulse'] : ['turn_on', 'turn_off', 'toggle']).map(name => ({ name })) }],
      lastKnownState: { plcRole: role, plcMode: mode, actualState: true, value: true, state: 'on', commandState: false, ...(role === 'output' ? { physicalState: true } : {}), available: true, stale: false, writable: true },
    });
    const devices = [makeDevice('pulse-section-test', 'Comando de grupo', 'output_command', 'pulse'), makeDevice('pulse-widget-test', 'Comando independiente', 'output_command', 'pulse'), makeDevice('persistent-test', 'Comando sostenido', 'output_command', 'sustained'), makeDevice('physical-test', 'Salida física Y0', 'output', 'sustained')];
    const template = responsiveDashboard.tabs[0].widgets[1];
    const fixture = { ...responsiveDashboard, tabs: [{ ...responsiveDashboard.tabs[0], widgets: [
      { ...template, config: { ...template.config, extra: { cards: [
        { id: 'pulse-historical-card', kind: 'light', title: devices[0].name, entityId: devices[0].id, span: 'small' },
        { id: 'persistent-card', kind: 'light', title: devices[2].name, entityId: devices[2].id, span: 'small' },
        { id: 'physical-card', kind: 'light', title: devices[3].name, entityId: devices[3].id, span: 'small' },
      ] } } },
      { id: 'historical-widget', type: 'device_control', config: { ...template.config, binding: { entityId: devices[1].id, entityType: 'device' }, appearance: { title: devices[1].name }, extra: {} } },
    ] }] };
    await prepareAuthenticatedDashboard(page, fixture);
    await page.route('**/api/v1/devices', route => route.fulfill({ json: devices }));
    const requests: { id: string; command: unknown }[] = [];
    let release: (() => void) | undefined;
    let fail = false;
    await page.route('**/api/v1/devices/*/command', async route => {
      const id = route.request().url().split('/').at(-2)!;
      requests.push({ id, command: route.request().postDataJSON().command });
      await new Promise<void>(resolve => { release = resolve; });
      if (fail) { await route.fulfill({ status: 400, json: { error: { code: 'RESET_FAILED' } } }); return; }
      const device = devices.find(device => device.id === id)!;
      await route.fulfill({ json: { ...device, lastKnownState: { ...device.lastKnownState, state: 'off', value: false, actualState: false, commandState: false, confirmation: 'pulse_completed' } } });
    });
    for (const language of ['es', 'en']) {
      await page.goto('/dashboards/responsive-dashboard/responsive-tab');
      await page.evaluate(language => localStorage.setItem('i18nextLng', language), language);
      await page.reload();
      const ready = language === 'es' ? 'Ejecutar' : 'Run';
      const pending = language === 'es' ? 'Ejecutando' : 'Running';
      const section = page.locator('[data-dashboard-card-id="pulse-historical-card"] [data-plc-momentary="true"]');
      const standalone = page.locator('.dashboard-action-button[data-plc-momentary="true"]');
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
        await expect(section).toContainText(ready);
        await expect(standalone).toContainText(ready);
        await expect(section).not.toHaveAttribute('aria-pressed');
        await expect(standalone).not.toHaveAttribute('aria-pressed');
        await expect(page.locator('[data-dashboard-card-id="physical-card"]')).toHaveClass(/homepilot-section-light-tile-active/);
        await expect(page.locator('[data-dashboard-card-id="persistent-card"] [data-plc-momentary]')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      }
      for (const button of [section, standalone]) {
        const before = requests.length;
        fail = false;
        await button.evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
        await expect(button).toContainText(pending);
        await expect(button).toBeDisabled();
        await expect.poll(() => requests.length).toBe(before + 1);
        expect(requests.at(-1)?.command).toBe('press');
        release!();
        await expect(button).toContainText(ready);
        await expect(button).toBeEnabled();
        await expect(button).toHaveAttribute('data-action-state', 'idle');
        fail = true;
        await button.click();
        await expect.poll(() => requests.length).toBe(before + 2);
        release!();
        await expect(button).toBeEnabled();
        await expect(button).toContainText(ready);
        await expect(button.getByRole('alert')).toBeVisible();
        await expect(button).toHaveAttribute('data-action-state', 'idle');
        await expect(button).not.toHaveAttribute('aria-pressed');
      }
      expect(requests.every(request => ['pulse-section-test', 'pulse-widget-test'].includes(request.id) && request.command === 'press')).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`plc-action-${language}.png`), animations: 'disabled' });
    }
  });
}

test('Feature: PLC dashboard realtime — Scenario: Received readings update without snapshot debounce (AC36)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await prepareAuthenticatedDashboard(page);
  let sendReading: (value: number) => void = () => { throw new Error('Authenticated realtime socket not ready'); };
  let connected = false;
  await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
    connected = true;
    let sequence = 0;
    sendReading = value => socket.send(JSON.stringify({
      type: 'DeviceStateUpdatedEvent', timestamp: new Date(Date.now() + ++sequence).toISOString(),
      payload: { deviceId: 'sensor-climate', homeId: responsiveDevices.find(device => device.id === 'sensor-climate')!.homeId, newState: { state: String(value), unit_of_measurement: '°C' } },
    }));
  });
  let snapshots = 0;
  await page.route('**/api/v1/devices', route => {
    snapshots += 1;
    return route.fulfill({ json: responsiveDevices.map(device => device.id === 'sensor-climate' ? { ...device, integrationSource: 'modbus-tcp', lastKnownState: { state: '20', unit_of_measurement: '°C' }, updatedAt: '2026-01-01T00:00:00.000Z' } : device) });
  });
  await page.goto('/dashboards/responsive-dashboard/responsive-tab');
  const reading = page.locator('[data-dashboard-card-id="responsive-sensor"] .sensor-reading-number');
  await expect(reading).toHaveText('20');
  await expect.poll(() => connected).toBe(true);
  const before = snapshots;
  sendReading(21);
  await expect(reading).toHaveText('21');
  sendReading(22);
  await expect(reading).toHaveText('22');
  // Longer than the general debounce: PLC updates must not trigger whole-device reconciliation.
  await page.waitForTimeout(1600);
  expect(snapshots).toBe(before);
});

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
    // Modal's zoom-in animation scales bounding boxes during entry. Retry the
    // real geometry without weakening AC79's 44px control-height assertion.
    await expect.poll(async () => (await id.boundingBox())?.height).toBeCloseTo(44, 1);
    await expect.poll(async () => (await area.boundingBox())?.height).toBeCloseTo(44, 1);
    if (viewport.name !== 'mobile') {
      const selectBounds = (await area.boundingBox())!;
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
  await card.getByRole('button', { name: /^(View variables|Ver variables)$/i }).click();
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
  test(`Feature: PLC declarative outputs — Scenario: Search select remove and persist fit ${viewport.name} (AC37)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport); await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'h', name: 'Home' }] }));
    const variables: Array<Record<string, unknown>> = [];
    const connection = { id: 'plc', homeId: 'h', name: 'PLC simulado', host: '192.168.1.5', port: 502, unitId: 1, enabled: false, timeoutMs: 2000, pollIntervalMs: 5000, profileId: 'xinje-xl5e-16t-v1', moduleCapacities: { CPU: { inputs: 8, outputs: 8 } }, variables };
    let commandRequests = 0;
    await page.route('**/api/v1/devices/*/command', route => { commandRequests++; return route.fulfill({ json: {} }); });
    await page.route('**/api/v1/modbus/**', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { connections: [connection] } });
      const saved = { ...route.request().postDataJSON(), deviceId: 'v', connectionId: 'plc' };
      variables.push(saved); return route.fulfill({ json: { variable: saved } });
    });
    await page.goto('/system/modbus');
    await page.evaluate(language => localStorage.setItem('i18nextLng', language), viewport.name.includes('tablet') ? 'es' : 'en'); await page.reload();
    await page.getByRole('button', { name: /^(View variables|Ver variables)$/i }).click();
    await page.getByRole('button', { name: /^(Add variable|Añadir variable)$/i }).click();
    const editor = page.getByRole('dialog', { name: /^(Configure variable|Configurar variable)$/i });
    await editor.getByLabel(/^(Name|Nombre)$/i).fill('CMDPLC 1');
    await editor.getByRole('button', { name: /^(Home Pilot usage|Uso en Home Pilot)$/i }).click();
    await page.getByRole('option', { name: /^(PLC commands|Comandos PLC)$/i, exact: true }).click();
    await editor.getByRole('switch', { name: /^(Advanced configuration|Configuración avanzada)$/i }).click();
    await editor.getByLabel(/^(PLC element|Elemento PLC)$/i, { exact: true }).fill('M100');
    for (const symbol of ['Y0', 'Y1']) {
      await editor.getByRole('button', { name: /^(Related outputs|Salidas relacionadas)$/i }).click();
      await page.getByRole('searchbox', { name: /^(Search|Buscar)$/i, exact: true }).fill(symbol);
      await page.getByRole('option', { name: symbol, exact: true }).click();
    }
    await editor.getByRole('button', { name: /^(Remove Y1|Quitar Y1)$/i }).click();
    await expect(editor.getByRole('button', { name: /^(Remove Y1|Quitar Y1)$/i })).toHaveCount(0);
    await editor.getByRole('button', { name: /^(Related outputs|Salidas relacionadas)$/i }).click();
    await page.getByRole('searchbox', { name: /^(Search|Buscar)$/i, exact: true }).fill('Y1');
    await page.getByRole('option', { name: 'Y1', exact: true }).click();
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      await editor.getByRole('button', { name: /^(Related outputs|Salidas relacionadas)$/i }).scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      const bounds = (await editor.boundingBox())!;
      expect(bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
      await page.screenshot({ path: testInfo.outputPath(`related-outputs-${theme}.png`), animations: 'disabled' });
    }
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    await expect(editor).not.toBeVisible();
    expect(variables[0]).toMatchObject({ plc: { role: 'output_command', command: { symbolicAddress: 'M100' }, relatedPhysicalOutputs: [{ symbolicAddress: 'Y0' }, { symbolicAddress: 'Y1' }], feedbackPolicy: 'none' } });
    expect((variables[0].plc as Record<string, unknown>).physical).toBeUndefined();
    await expect(page.getByText(/Salidas relacionadas: Y0 · Y1|Related outputs: Y0 · Y1/)).toBeVisible();
    await expect(page.getByText(/Estado leído del comando:|Command read state:/)).toBeVisible();
    expect(commandRequests).toBe(0);
  });
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
    await page.evaluate(async () => {
      // Load both reading fonts before taking the baseline. On Linux a font
      // first requested by a different visualizer can otherwise resize it.
      await Promise.all([
        document.fonts.load('400 16px Inter'),
        document.fonts.load('400 16px "Disket Mono"'),
      ]);
      await document.fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    await waitForSettledLayout(preview);
    const original = (await preview.boundingBox())!;
    for (const [label, style] of [[/^(Thermometer|Termómetro)$/, 'thermometer'], [/^(Level|Nivel)$/, 'level'], [/^(Battery|Batería)$/, 'battery'], [/^(Circular)$/, 'gauge']] as const) {
      await selector.click(); await page.getByRole('option', { name: label }).click();
      if (style === 'gauge') await expect(preview.locator('canvas')).toBeVisible();
      else await expect(preview.locator(`[data-sensor-visualizer="${style}"]`)).toBeVisible();
      if (style === 'level') await expect(preview.locator('[data-sensor-level-tank]')).toBeVisible();
      if (style === 'battery') await expect(preview.locator('[data-sensor-level-tank]')).toHaveCount(0);
      await expect(preview.getByRole('meter')).toHaveAttribute('aria-valuetext', '22.4567 °C');
      await expect.poll(async () => {
        const bounds = (await preview.boundingBox())!;
        return Math.max(Math.abs(bounds.width - original.width), Math.abs(bounds.height - original.height));
      }).toBeLessThan(0.05);
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
    await page.reload(); await page.getByRole('button', { name: /^(View variables|Ver variables)$/i }).click(); const card = page.getByRole('region', { name: 'PLC 192.168.1.5' }); await expect(card).toContainText('D100');
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
    await expect(dialog.getByRole('status')).toHaveText(/No test executed|Sin prueba ejecutada/i);
    expect(probeBody).toBeUndefined();
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
    await variableEditor.getByText(/^(Technical conversion|Conversión técnica)$/i, { exact: true }).click();
    await expect(variableEditor.getByRole('button', { name: /^(Data type|Tipo de dato)$/i })).toContainText('uint32');
    await variableEditor.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    expect(savedVariable).toMatchObject({ address: 100, dataType: 'uint32', scale: 0.1, offset: 2, unit: '°C', writable: false });
    await page.reload(); await page.getByRole('button', { name: /^(View variables|Ver variables)$/i }).click(); await page.getByRole('button', { name: /^(Technical details|Detalles técnicos)$/i }).click(); await expect(page.getByRole('region', { name: 'PLC 192.168.1.5' })).toContainText('uint32');
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
  test(`Feature: PLC I/O commissioning — Scenario: Explicit bindings and authorized setpoint fit ${viewport.name} (AC20/AC21/AC24/AC26)`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport); await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ id: 'h', name: 'Home' }] }));
    const variables: Array<Record<string, unknown>> = [];
    const connection = { id: 'plc', homeId: 'h', name: 'PLC simulado', host: '192.168.1.5', port: 502, unitId: 1, enabled: true, timeoutMs: 2000, pollIntervalMs: 5000, profileId: 'xinje-xl5e-16t-v2', diagnostic: { status: 'online' }, variables };
    const commands: Array<Record<string, unknown>> = [];
    const assignments = new Map<string, string>();
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: [{ id: 'access', homeId: 'h', name: 'Acceso' }] }));
    await page.route('**/api/v1/devices', route => route.fulfill({ json: variables.map(variable => ({ id: variable.deviceId, name: variable.name, homeId: 'h', roomId: assignments.get(String(variable.deviceId)) ?? null, type: variable.dataType === 'boolean' ? 'binary_sensor' : 'sensor', status: 'ASSIGNED', integrationSource: 'modbus-tcp' })) }));
    await page.route('**/api/v1/devices/*/assign', route => { const id = new URL(route.request().url()).pathname.split('/').at(-2)!; assignments.set(id, route.request().postDataJSON().roomId); return route.fulfill({ json: {} }); });
    await page.route('**/api/v1/modbus/**', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { connections: [connection] } });
      const body = route.request().postDataJSON();
      const saved = { ...body, connectionId: 'plc', deviceId: `v-${variables.length}`, diagnostic: { status: 'online', value: body.dataType === 'boolean' ? false : 22, ...(body.plc?.role === 'output' ? { commandedState: true, confirmation: 'unconfirmed' } : {}), raw: [220], latencyMs: 15, lastReadAt: '2026-10-03T12:00:00Z' } };
      if (route.request().method() === 'PUT') {
        const deviceId = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!);
        const index = variables.findIndex(variable => variable.deviceId === deviceId);
        variables[index] = { ...saved, deviceId };
        return route.fulfill({ json: { variable: variables[index] } });
      }
      variables.push(saved); return route.fulfill({ json: { variable: saved } });
    });
    await page.route('**/api/v1/devices/*/command', route => { commands.push(route.request().postDataJSON()); return route.fulfill(commands.length === 1 ? { status: 504, json: { error: 'TIMEOUT' } } : { json: {} }); });
    await page.goto('/system/modbus');
    if (viewport.name.includes('tablet')) { await page.evaluate(() => localStorage.setItem('i18nextLng', 'es')); await page.reload(); }
    const openDetail = async () => { await page.getByRole('button', { name: /^(View variables|Ver variables)$/i }).click(); };
    await expect(page.getByRole('button', { name: /^(Add variable|Añadir variable)$/i })).toHaveCount(0);
    await openDetail();
    const card = page.getByRole('region', { name: 'PLC simulado', exact: true });
    const editor = page.getByRole('dialog', { name: /^(Configure variable|Configurar variable)$/i });
    const captureDialog = async (dialog: typeof editor, subject: string) => {
      for (const theme of ['dark', 'light']) {
        await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
        const bounds = (await dialog.boundingBox())!;
        expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
        expect(bounds.width).toBeLessThanOrEqual(viewport.width);
        await page.screenshot({ path: testInfo.outputPath(`plc-${subject}-${theme}.png`), animations: 'disabled' });
      }
    };
    await card.getByRole('button', { name: /^(Add variable|Añadir variable)$/i }).click();
    await editor.getByLabel(/^(Name|Nombre)$/i).fill('Luz exterior');
    await editor.getByRole('button', { name: /^(Home Pilot usage|Uso en Home Pilot)$/i }).click();
    await page.getByRole('option', { name: /^(Outputs|Salidas)$/i, exact: true }).click();
    await editor.getByRole('switch', { name: /^(Advanced configuration|Configuración avanzada)$/i }).click();
    await editor.getByLabel(/^(PLC command|Comando PLC)$/i, { exact: true }).fill('M100');
    await editor.getByLabel(/^(Physical output|Salida física)$/i).fill('Y0');
    await expect(editor.getByLabel(/^(PLC command|Comando PLC)$/i, { exact: true })).toHaveValue('M100');
    expect(await editor.locator('input').evaluateAll(inputs => inputs.filter(input => (input as HTMLInputElement).value === 'M100').length)).toBe(1);
    await editor.getByRole('button', { name: /^(Feedback policy|Política de feedback)$/i }).click();
    await page.getByRole('option', { name: /^(Required|Obligatorio)$/i, exact: true }).click();
    await editor.getByLabel(/^(Independent feedback|Feedback independiente)$/i).fill('M200');
    const write = editor.getByRole('switch', { name: /^(Allow commands on this coil|Permitir órdenes sobre esta coil)$/i });
    await expect(write).toHaveAttribute('aria-checked', 'false'); await write.click();
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      await editor.getByLabel(/^(Name|Nombre)$/i).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`plc-binding-${theme}.png`), animations: 'disabled' });
      const bounds = (await editor.boundingBox())!;
      expect(bounds.height).toBeLessThanOrEqual(viewport.height); expect(bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).scrollIntoViewIfNeeded();
      await expect(editor.getByRole('button', { name: /^(Save|Guardar)$/i })).toBeInViewport({ ratio: 1 });
    }
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(variables[0]).toMatchObject({ writable: true, plc: { role: 'output', command: { symbolicAddress: 'M100', address: 100 }, physical: { symbolicAddress: 'Y0', address: 24576 }, feedback: { symbolicAddress: 'M200', address: 200 }, feedbackPolicy: 'required' } });
    await page.reload(); await openDetail(); await card.getByRole('button', { name: /^(Technical details|Detalles técnicos)$/i }).click(); await expect(card).toContainText('M200');
    await expect(card).toContainText(/Requested state: Active|Estado solicitado: Activo/);
      await expect(card).toContainText(/Read state: Inactive|Estado leído: Inactivo/);
    // AC34: explicit no-feedback output, command derived on save, physical edits isolated.
    await card.getByRole('button', { name: /^(Configure Luz exterior|Configurar Luz exterior)$/i }).click();
    await editor.getByLabel(/^(PLC command|Comando PLC)$/i, { exact: true }).fill('M200');
    await expect(editor.getByLabel(/^(Physical output|Salida física)$/i)).toHaveValue('Y0');
    await editor.getByRole('button', { name: /^(Feedback policy|Política de feedback)$/i }).click();
    await page.getByRole('option', { name: /^(No feedback|Sin feedback)$/i, exact: true }).click();
    await expect(editor.getByLabel(/^(Independent feedback|Feedback independiente)$/i)).toHaveCount(0);
    await expect(editor.getByRole('button', { name: /^(Command mode|Modo de comando)$/i })).toContainText(/Sustained|Sostenido/);
    await editor.getByRole('switch', { name: /^(Allow commands on this coil|Permitir órdenes sobre esta coil)$/i }).click();
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(variables[0]).toMatchObject({ symbolicAddress: 'M200', address: 200, plc: { role: 'output', command: { symbolicAddress: 'M200', address: 200 }, physical: { symbolicAddress: 'Y0', address: 24576 }, feedbackPolicy: 'none', mode: 'sustained' } });
    expect((variables[0].plc as Record<string, unknown>).feedback).toBeUndefined();
    const originalBinding = JSON.parse(JSON.stringify(variables[0].plc));
    await page.reload(); await openDetail();
    await card.getByRole('button', { name: /^(Configure Luz exterior|Configurar Luz exterior)$/i }).click();
    await expect(editor.getByLabel(/^(PLC command|Comando PLC)$/i, { exact: true })).toHaveValue('M200');
    await editor.getByLabel(/^(Physical output|Salida física)$/i).fill('Y1');
    await expect(editor.getByLabel(/^(PLC command|Comando PLC)$/i, { exact: true })).toHaveValue('M200');
    // Sequential bounding boxes must not sample different frames of the
    // modal's translate/zoom entrance animation. Keep the 4px alignment limit.
    await waitForSettledLayout(editor);
    const physicalBounds = (await editor.getByLabel(/^(Physical output|Salida física)$/i).boundingBox())!;
    const commandBounds = (await editor.getByLabel(/^(PLC command|Comando PLC)$/i, { exact: true }).boundingBox())!;
    // Compact layouts place physical and command side by side; mobile stacks them.
    if (viewport.width < 640) expect(physicalBounds.y).toBeLessThan(commandBounds.y);
    else { expect(physicalBounds.x).toBeLessThan(commandBounds.x); expect(Math.abs(physicalBounds.y - commandBounds.y)).toBeLessThan(4); }
    await captureDialog(editor, 'output-no-feedback');
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(variables[0].plc).toEqual({ ...originalBinding, physical: { profileId: connection.profileId, symbolicAddress: 'Y1', area: 'coil', address: 24577 } });
    expect(variables[0]).toMatchObject({ symbolicAddress: 'M200', address: 200, writable: true });
    await page.reload(); await openDetail();
    await card.getByRole('button', { name: /^(Add variable|Añadir variable)$/i }).click();
    await editor.getByLabel(/^(Name|Nombre)$/i).fill('Temperatura objetivo');
    await editor.getByRole('button', { name: /^(Home Pilot usage|Uso en Home Pilot)$/i }).click(); await page.getByRole('option', { name: 'Setpoints', exact: true }).click();
    await editor.getByRole('switch', { name: /^(Advanced configuration|Configuración avanzada)$/i }).click();
    await editor.getByLabel(/^(PLC element|Elemento PLC)$/i, { exact: true }).fill('D100');
    await editor.getByRole('button', { name: /^(Unit|Unidad)$/i, exact: true }).click(); await page.getByRole('option', { name: '°C', exact: true }).click();
    await editor.getByLabel(/^(Minimum|Mínimo)$/i).fill('5'); await editor.getByLabel(/^(Maximum|Máximo)$/i).fill('40');
    await editor.getByRole('switch', { name: /^(Allow setpoint writes|Permitir escritura del setpoint)$/i }).click(); await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(variables[1]).toMatchObject({ writable: true, plc: { role: 'setpoint', min: 5, max: 40 } });
    await card.getByRole('button', { name: /^(Test command for Temperatura objetivo|Probar comando de Temperatura objetivo)$/i }).click();
    const authorization = page.getByRole('dialog', { name: /^(Authorize PLC command|Autorizar comando PLC)$/i });
    const confirm = authorization.getByRole('button', { name: /^(Confirm and execute|Confirmar y ejecutar)$/i });
    expect(commands).toHaveLength(0);
    await authorization.getByLabel(/^(Target value|Valor objetivo)$/i).fill('41'); await expect(confirm).toBeDisabled();
    await authorization.getByLabel(/^(Target value|Valor objetivo)$/i).fill('5'); await expect(confirm).toBeEnabled();
    await authorization.getByLabel(/^(Target value|Valor objetivo)$/i).fill('40'); await expect(confirm).toBeEnabled();
    await authorization.getByLabel(/^(Target value|Valor objetivo)$/i).fill('22'); await confirm.click();
    await expect(authorization.getByRole('alert').filter({ hasText: /timed out|tiempo/i })).toBeVisible();
    await captureDialog(authorization, 'setpoint-error');
    await expect(authorization.getByLabel(/^(Target value|Valor objetivo)$/i)).toHaveValue('22');
    await confirm.click(); await expect(authorization).not.toBeVisible(); expect(commands).toEqual([{ command: { name: 'set_value', params: { value: 22 } } }, { command: { name: 'set_value', params: { value: 22 } } }]);
    await card.getByRole('button', { name: /^(Add variable|Añadir variable)$/i }).click();
    await editor.getByLabel(/^(Name|Nombre)$/i).fill('Nivel depósito');
    await editor.getByRole('button', { name: /^(Home Pilot usage|Uso en Home Pilot)$/i }).click(); await page.getByRole('option', { name: /^(Measurements|Mediciones)$/i, exact: true }).click();
    await editor.getByRole('switch', { name: /^(Advanced configuration|Configuración avanzada)$/i }).click();
    await editor.getByLabel(/^(PLC element|Elemento PLC)$/i, { exact: true }).fill('HD100');
    await editor.getByRole('button', { name: /^(Visualization|Visualización)$/i }).click(); await page.getByRole('option', { name: /^(Level|Nivel)$/i, exact: true }).click();
    await editor.getByRole('button', { name: /^(Unit|Unidad)$/i, exact: true }).click(); await page.getByRole('option', { name: '%', exact: true }).click();
    await editor.getByText(/^(Measurement preview|Vista previa de medición)$/i, { exact: true }).click();
    await expect(editor.locator('[data-sensor-visualizer="level"]')).toBeVisible();
    await editor.locator('.sensor-metric-card').scrollIntoViewIfNeeded(); await captureDialog(editor, 'measurement-preview');
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(variables[2]).toMatchObject({ visualStyle: 'level', writable: false, plc: { role: 'measurement' } });
    await page.reload(); await openDetail();
    const measurementRow = card.locator('[data-modbus-variable-id]').filter({ hasText: 'Nivel depósito' });
    await expect(measurementRow.locator('[data-modbus-variable-diagnostic]')).toHaveCount(0);
    await card.getByRole('button', { name: /^(Technical details|Detalles técnicos)$/i }).click();
    await expect(card.locator('[data-sensor-visualizer="level"]')).toBeVisible();
    await card.getByRole('button', { name: /^(Configure Nivel depósito|Configurar Nivel depósito)$/i }).click();
    await editor.getByRole('button', { name: /^(Visualization|Visualización)$/i }).click(); await page.getByRole('option', { name: /^(Thermometer|Termómetro)$/i, exact: true }).click();
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(variables[2]).toMatchObject({ visualStyle: 'thermometer' });
    await page.reload(); await openDetail();
    await card.getByRole('button', { name: /^(Technical details|Detalles técnicos)$/i }).click();
    await expect(card.locator('[data-sensor-visualizer="thermometer"]')).toBeVisible();
    await card.getByRole('button', { name: /^(Add variable|Añadir variable)$/i }).click();
    await editor.getByLabel(/^(Name|Nombre)$/i).fill('Entrada puerta');
    await editor.getByRole('button', { name: /^(Home Pilot usage|Uso en Home Pilot)$/i }).click(); await page.getByRole('option', { name: /^(Inputs|Entradas)$/i, exact: true }).click();
    await editor.getByRole('switch', { name: /^(Advanced configuration|Configuración avanzada)$/i }).click();
    await editor.getByLabel(/^(PLC element|Elemento PLC)$/i, { exact: true }).fill('X0');
    await editor.getByLabel(/^(Physical input|Entrada física)$/i).fill('X0');
    await editor.getByLabel(/^(Logical input \(optional\)|Entrada lógica \(opcional\))$/i).fill('M0');
    await editor.getByRole('button', { name: /^(Room|Estancia)$/i, exact: true }).click(); await page.getByRole('option', { name: 'Acceso', exact: true }).click();
    await expect(editor.getByRole('switch', { name: /^(Allow commands on this coil|Permitir órdenes sobre esta coil)$/i })).toHaveCount(0);
    await editor.getByLabel(/^(Name|Nombre)$/i).scrollIntoViewIfNeeded(); await captureDialog(editor, 'input');
    if (viewport.name.includes('tablet')) {
      await page.evaluate(() => { Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 420 }); window.visualViewport!.dispatchEvent(new Event('resize')); });
      await expect.poll(async () => (await editor.boundingBox())!.height).toBeLessThanOrEqual(420);
      await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).scrollIntoViewIfNeeded();
      const saveBounds = (await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).boundingBox())!;
      expect(saveBounds.y + saveBounds.height).toBeLessThanOrEqual(420);
      await page.evaluate(height => { Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: height }); window.visualViewport!.dispatchEvent(new Event('resize')); }, viewport.height);
    }
    await editor.getByRole('button', { name: /^(Save|Guardar)$/i }).click(); await expect(editor).not.toBeVisible();
    expect(variables[3]).toMatchObject({ writable: false, visualStyle: null, plc: { role: 'input', physical: { symbolicAddress: 'X0' }, logical: { symbolicAddress: 'M0' } } });
    await expect(card.locator('[data-modbus-variable-group="input"]')).toContainText('Entrada puerta');
    await expect(card.locator('[data-modbus-variable-group="output"]')).toContainText('Luz exterior');
    await expect(card.locator('[data-modbus-variable-group="variable"]')).not.toContainText('Entrada puerta');
    await expect(card.locator('[data-modbus-variable-group="variable"]')).not.toContainText('Luz exterior');
    expect(assignments.get('v-3')).toBe('access');
    await card.getByRole('button', { name: /^(Configure Entrada puerta|Configurar Entrada puerta)$/i }).click();
    await expect(editor.getByRole('button', { name: /^(Room|Estancia)$/i, exact: true })).toContainText('Acceso');
    await editor.getByRole('button', { name: /^(Cancel|Cancelar)$/i }).click();
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      await page.evaluate(() => { document.querySelectorAll<HTMLElement>('*').forEach(element => { if (element.scrollHeight > element.clientHeight) element.scrollTop = 0; }); window.scrollTo(0, 0); });
      await expect(page.getByRole('heading', { name: /^(Controladores PLC|PLC controllers)$/ })).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: testInfo.outputPath(`plc-io-${theme}.png`), animations: 'disabled', fullPage: true });
    }
  });
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
    await expect(page.getByRole('heading', { name: /^(Controladores PLC|PLC controllers)$/ })).toBeVisible();
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
    await page.getByRole('button', { name: /^(View variables|Ver variables)$/i }).click();
    const card = page.getByRole('region', { name: 'PLC simulado', exact: true });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /^(Add variable|Añadir variable)$/i }).click();
    const variableDialog = page.getByRole('dialog', { name: /^(Configure variable|Configurar variable)$/i });
    await variableDialog.getByLabel(/^(Name|Nombre)$/i).fill('Temperatura ambiente');
    await variableDialog.getByRole('button', { name: /^(Home Pilot usage|Uso en Home Pilot)$/i }).click();
    await page.getByRole('option', { name: /^Variables$/i, exact: true }).click();
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
    await variableDialog.getByRole('button', { name: /^(Home Pilot usage|Uso en Home Pilot)$/i }).click();
    await page.getByRole('option', { name: /^Variables$/i, exact: true }).click();
    await variableDialog.getByRole('button', { name: /^(Area|Área)$/i }).click();
    await page.getByRole('option', { name: 'Coil', exact: true }).click();
    const writePermission = variableDialog.getByRole('switch', { name: /^(Allow commands on this coil|Permitir órdenes sobre esta coil)$/i });
    await expect(writePermission).toHaveAttribute('aria-checked', 'false');
    await writePermission.click();
    await variableDialog.getByRole('button', { name: /^(Save|Guardar)$/i }).click();
    await expect(variableDialog).not.toBeVisible();
    expect(variables[1]).toMatchObject({ area: 'coil', dataType: 'boolean', writable: true });
    await page.reload(); await page.getByRole('button', { name: /^(View variables|Ver variables)$/i }).click(); await expect(page.getByRole('region', { name: 'PLC simulado' })).toContainText('Temperatura ambiente');
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`modbus-${theme}.png`), fullPage: true, animations: 'disabled' });
    }
  });
}

test('Feature: Native Modbus configuration — Scenario: Non-Admin direct navigation never requests configuration (AC2)', async ({ page }) => {
  await prepareAuthenticatedDashboard(page, responsiveDashboard, { ...dashboardUser, role: 'parent' });
  let calls = 0;
  await page.route('**/api/v1/modbus/**', route => { calls++; return route.fulfill({ json: { connections: [] } }); });
  await page.goto('/system/modbus');
  await expect(page.getByRole('button', { name: /^(Add connection|Añadir conexión)$/i })).toHaveCount(0);
  await expect(page.getByRole('navigation').getByText(/^(Controladores PLC|PLC controllers)$/)).toHaveCount(0);
  expect(calls).toBe(0);
});
