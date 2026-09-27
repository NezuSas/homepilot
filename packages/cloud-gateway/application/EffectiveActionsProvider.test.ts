import type { Device } from '../../devices/domain/types';
import { parseBoardManifestV1 } from './BoardManifestV1';
import { EffectiveActionsProvider } from './EffectiveActionsProvider';

const deviceId = '33dfef68-0d46-4fdd-aef0-8b249a32de4e';
const installationId = 'c68ef027-a00e-4703-9338-397e96e153cd';
const now = Date.parse('2026-09-27T12:00:00.000Z');
const device: Device = {
  id: deviceId, homeId: 'home-1', roomId: 'room-1', externalId: `android-display:${deviceId}`,
  name: 'Pantalla', type: 'smart_display', semanticType: 'smart_display', vendor: 'Droidlogic',
  status: 'ASSIGNED', integrationSource: 'android-display', invertState: false,
  lastKnownState: { connectionState: 'online' }, entityVersion: 1,
  createdAt: '2026-09-27T00:00:00Z', updatedAt: '2026-09-27T00:00:00Z',
};
const manifest = parseBoardManifestV1({
  schemaVersion: 'homepilot.board-manifest.v1', revision: 'a'.repeat(64), boardId: 5,
  installationId, homePilotDeviceId: deviceId, planId: 2,
  actions: [
    { key: 'home', displayName: 'Inicio', semanticAction: 'navigate_home', controlType: 'button',
      implementationType: 'homepilot', implementationConfig: {}, visibility: 'visible',
      safetyLevel: 'normal', requiresConfirmation: false },
    { key: 'turn_on', displayName: 'No autorizado', semanticAction: 'turn_on', controlType: 'button',
      implementationType: 'homepilot', implementationConfig: {}, visibility: 'visible',
      safetyLevel: 'normal', requiresConfirmation: false },
  ],
});

function provider(lastSuccessAt: string | null, cached = true, localDevice: Device | null = device) {
  const cache = {
    getState: jest.fn(() => lastSuccessAt ? { installationId, lastSuccessAt } : null),
    getByDeviceId: jest.fn(() => cached ? manifest : null),
  };
  const devices = { findDeviceById: jest.fn().mockResolvedValue(localDevice) };
  return { service: new EffectiveActionsProvider({ cache, devices }, () => now), cache, devices };
}

describe('EffectiveActionsProvider', () => {
  it.each([0, 10 * 60_000])('uses the existing local resolver during fresh/grace at age %s', async (age) => {
    const { service } = provider(new Date(now - age).toISOString());
    expect((await service.getForDeviceId(deviceId)).map((action) => action.semanticAction)).toEqual(['navigate_home']);
  });

  it('returns no actions after expiry without reading manifest or Device', async () => {
    const { service, cache, devices } = provider(new Date(now - 24 * 60 * 60_000 - 1).toISOString());
    expect(await service.getForDeviceId(deviceId)).toEqual([]);
    expect(cache.getByDeviceId).not.toHaveBeenCalled();
    expect(devices.findDeviceById).not.toHaveBeenCalled();
  });

  it('returns no actions if manifest or local Device is absent', async () => {
    const lastSuccessAt = new Date(now).toISOString();
    expect(await provider(lastSuccessAt, false).service.getForDeviceId(deviceId)).toEqual([]);
    expect(await provider(lastSuccessAt, true, null).service.getForDeviceId(deviceId)).toEqual([]);
  });
});
