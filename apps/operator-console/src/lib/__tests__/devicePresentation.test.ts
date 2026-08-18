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
  it.each<[Partial<SnapshotDevice>, ReturnType<typeof resolveManagedDeviceKind>]>([
    [{ capabilities: [{ type: 'camera', name: 'Camera' }] }, 'camera'],
    [{ type: 'camera' }, 'camera'],
    [{ semanticType: 'camera' }, 'camera'],
    [{ profile: { ...device.profile!, domain: 'camera' } }, 'camera'],
    [{ externalId: 'ha:camera.front_door' }, 'camera'],
    [{ integrationSource: 'native-camera' }, 'camera'],
    [{ capabilities: [{ type: 'cover', name: 'Cover' }] }, 'cover'],
    [{ semanticType: 'cover' }, 'cover'],
    [{ type: 'cover' }, 'cover'],
    [{ profile: { ...device.profile!, domain: 'cover' } }, 'cover'],
    [{ capabilities: [{ type: 'light', name: 'Light' }] }, 'light'],
    [{ semanticType: 'light' }, 'light'],
    [{ type: 'light' }, 'light'],
    [{ capabilities: [{ type: 'switch', name: 'Switch' }] }, 'switch'],
    [{ semanticType: 'switch' }, 'switch'],
    [{ semanticType: 'outlet' }, 'switch'],
    [{ type: 'switch' }, 'switch'],
    [{ type: 'outlet' }, 'switch'],
    [{ capabilities: [{ type: 'sensor', name: 'Sensor' }] }, 'sensor'],
    [{ capabilities: [{ type: 'binary_sensor', name: 'Binary sensor' }] }, 'sensor'],
    [{ semanticType: 'sensor' }, 'sensor'],
    [{ type: 'sensor' }, 'sensor'],
    [{ type: 'binary_sensor' }, 'sensor'],
  ])('Scenario: Given device metadata %p When classified Then the managed kind is %s', (metadata, expected) => {
    const unclassified: SnapshotDevice = { ...device, type: 'unknown', semanticType: null, profile: undefined };

    expect(resolveManagedDeviceKind({ ...unclassified, ...metadata })).toBe(expected);
  });

  it('Scenario: Given no recognized metadata When classified Then it remains other', () => {
    expect(resolveManagedDeviceKind({ ...device, type: 'unknown', semanticType: null, profile: undefined })).toBe('other');
  });
});
