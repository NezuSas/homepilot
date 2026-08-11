import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { resolveManagedDeviceKind } from '../devicePresentation';

const device: SnapshotDevice = {
  id: 'cover-1',
  homeId: 'home-1',
  roomId: null,
  name: 'Persiana',
  type: 'unknown',
  status: 'ASSIGNED',
  lastKnownState: null,
  profile: {
    source: 'home-assistant',
    domain: 'cover',
    type: 'cover',
    semanticType: 'cover',
    displayName: 'Persiana',
    category: 'covering',
    supportedCommands: ['open', 'close', 'stop', 'set_position'],
    configurationSections: [{ id: 'cover_behavior', label: 'Cover', description: 'Position controls' }],
  },
};

describe('Feature: presentación de dispositivos por perfil', () => {
  it('Scenario: Given metadata de perfil sin marca When la consola clasifica el dispositivo Then usa el dominio y capacidades del perfil', () => {
    expect(resolveManagedDeviceKind(device)).toBe('cover');
  });
});