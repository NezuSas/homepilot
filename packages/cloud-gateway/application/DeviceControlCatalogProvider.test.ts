import type { Device } from '../../devices/domain/types';
import { parseBoardManifestV1 } from './BoardManifestV1';
import { DeviceControlCatalogProvider } from './DeviceControlCatalogProvider';

const deviceId = '33dfef68-0d46-4fdd-aef0-8b249a32de4e';
const installationId = 'c68ef027-a00e-4703-9338-397e96e153cd';
const now = Date.parse('2026-09-27T12:00:00.000Z');
const device: Device = {
  id: deviceId, homeId: 'home-1', roomId: 'room-1', externalId: `android-display:${deviceId}`,
  name: 'Pizarra Oficina', type: 'smart_display', semanticType: 'smart_display', vendor: 'Droidlogic',
  status: 'ASSIGNED', integrationSource: 'android-display', invertState: false,
  lastKnownState: { connectionState: 'online' }, entityVersion: 1,
  createdAt: '2026-09-27T00:00:00Z', updatedAt: '2026-09-27T00:00:00Z',
};
const base = {
  schemaVersion: 'homepilot.board-manifest.v1', revision: 'a'.repeat(64), boardId: 5,
  installationId, homePilotDeviceId: deviceId, planId: 2,
  actions: [
    { key: 'hp_navigate_home', displayName: 'Inicio', semanticAction: 'navigate_home',
      controlType: 'button', implementationType: 'homepilot', implementationConfig: {},
      visibility: 'visible', safetyLevel: 'normal', requiresConfirmation: false },
    { key: 'hp_volume_set', displayName: 'Volumen', semanticAction: 'volume_set',
      controlType: 'slider', implementationType: 'homepilot', implementationConfig: {},
      visibility: 'visible', safetyLevel: 'normal', requiresConfirmation: false },
  ],
};
const command = (key: string, implementationType: 'homepilot' | 'legacy_adb', controlType: 'button' | 'slider') => ({
  key, displayName: key, implementationType, controlType,
  visibility: 'visible', safetyLevel: 'normal', requiresConfirmation: false,
});

function provider(manifestInput: unknown, syncedAt = new Date(now).toISOString()) {
  const manifest = parseBoardManifestV1(manifestInput);
  return new DeviceControlCatalogProvider({
    cache: { getState: () => ({ installationId, lastSuccessAt: syncedAt }), getByDeviceId: () => manifest },
    devices: { findDeviceById: async () => device },
  }, () => now);
}

describe('DeviceControlCatalogProvider', () => {
  it('shows the commercial plan and all commands, but only local effective actions are executable', async () => {
    const service = provider({ ...base, entitlement: {
      plan: { id: 2, name: 'Plan Premium', type: 'PREMIUM' },
      commands: [command('hp_navigate_home', 'homepilot', 'button'),
        command('hp_volume_set', 'homepilot', 'slider'), command('legacy_camera', 'legacy_adb', 'button')],
    } });
    const catalog = await service.getForDeviceId(deviceId);
    expect(catalog?.plan).toEqual({ id: 2, name: 'Plan Premium', type: 'PREMIUM' });
    expect(catalog?.commands).toEqual([
      expect.objectContaining({ key: 'hp_navigate_home', executableInHomePilot: true, dashboardEligible: true, semanticAction: 'navigate_home' }),
      expect.objectContaining({ key: 'hp_volume_set', executableInHomePilot: true, dashboardEligible: false, semanticAction: 'volume_set' }),
      expect.objectContaining({ key: 'legacy_camera', executableInHomePilot: false, dashboardEligible: false }),
    ]);
    expect(catalog?.commands[2]).not.toHaveProperty('semanticAction');
    expect(service.listDashboardActionsForDevices([device])).toEqual([{
      deviceId, actionKey: 'hp_navigate_home', displayName: 'hp_navigate_home', deviceName: 'Pizarra Oficina',
    }]);
  });

  it('uses manifest actions as the catalog for an old manifest', () => {
    expect(provider(base).getForDevice(device)?.plan).toEqual({ id: 2, name: null, type: null });
    expect(provider(base).getForDevice(device)?.commands).toHaveLength(2);
  });

  it('keeps commercial details but offers no execution after expiry', () => {
    const expired = provider(base, new Date(now - 24 * 60 * 60_000 - 1).toISOString());
    expect(expired.getForDevice(device)?.commands.every((item) => !item.executableInHomePilot && !item.dashboardEligible)).toBe(true);
    expect(expired.listDashboardActionsForDevices([device])).toEqual([]);
  });
});
