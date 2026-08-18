import type { DashboardWidget } from './types';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import {
  clampSectionSpan,
  getAssignableDevicesForSectionCard,
  getDashboardSectionColumns,
  getDashboardSectionColumnsForViewport,
  getDashboardUserDisplayName,
  getDevicesInRoom,
  isDeviceActive,
  isPortraitKioskViewport,
  getSectionSpan,
  sanitizeWidget,
  sanitizeWidgetConfig,
} from './dashboardUtils';

function createSection(id: string, span?: number, legacyW?: number): DashboardWidget {
  return {
    id,
    type: 'section',
    config: {
      layout: { x: 0, y: 0, w: legacyW ?? 4, h: 2, span },
      binding: { entityId: '', entityType: 'system' },
      visibility: { rules: [], defaultState: 'show' },
      appearance: { title: id, showTitle: true },
      extra: {},
    },
  };
}

function createDevice(
  id: string,
  name: string,
  type: string,
  profile?: Pick<NonNullable<SnapshotDevice['profile']>, 'domain' | 'type' | 'category'>,
): SnapshotDevice {
  return {
    id,
    homeId: 'home-1',
    roomId: null,
    name,
    type,
    status: 'ASSIGNED',
    lastKnownState: null,
    ...(profile ? {
      profile: {
        source: 'home-assistant',
        domain: profile.domain,
        type: profile.type,
        displayName: name,
        category: profile.category,
        supportedCommands: [],
        configurationSections: [],
      },
    } : {}),
  };
}

describe('dashboard canvas columns', () => {
  it('flows 1 column on mobile, 2 on tablet, 3 on desktop, by container width', () => {
    expect(getDashboardSectionColumns(320)).toBe(1);
    expect(getDashboardSectionColumns(639)).toBe(1);
    expect(getDashboardSectionColumns(640)).toBe(2);
    expect(getDashboardSectionColumns(1023)).toBe(2);
    expect(getDashboardSectionColumns(1024)).toBe(3);
    expect(getDashboardSectionColumns(1440)).toBe(3);
  });

  it('uses two readable columns only on high-resolution portrait kiosks', () => {
    expect(isPortraitKioskViewport(1080, 1920)).toBe(true);
    expect(getDashboardSectionColumnsForViewport(1080, 1080, 1920)).toBe(2);
    expect(getDashboardSectionColumnsForViewport(1440, 1440, 900)).toBe(3);
    expect(getDashboardSectionColumnsForViewport(1024, 1024, 1366)).toBe(3);
    expect(getDashboardSectionColumnsForViewport(768, 768, 1024)).toBe(2);
    expect(isPortraitKioskViewport(768, 1024)).toBe(false);
  });
});

describe('dashboard user identity', () => {
  it('uses only the explicit authenticated context with a stable fallback', () => {
    expect(getDashboardUserDisplayName({ displayName: 'Gustavo', username: 'gustavo' }, 'User')).toBe('Gustavo');
    expect(getDashboardUserDisplayName({ username: 'oscar' }, 'User')).toBe('oscar');
    expect(getDashboardUserDisplayName({ displayName: '   ', username: '   ' }, 'User')).toBe('User');
    expect(getDashboardUserDisplayName('unrelated-storage-value', 'User')).toBe('User');
  });
});

describe('dashboard section span', () => {
  it('clamps a span to the number of columns available at the current breakpoint', () => {
    expect(clampSectionSpan(3, 3)).toBe(3);
    expect(clampSectionSpan(3, 2)).toBe(2);
    expect(clampSectionSpan(3, 1)).toBe(1);
    expect(clampSectionSpan(0, 3)).toBe(1);
  });

  it('reads the persisted span when present', () => {
    expect(getSectionSpan(createSection('a', 2))).toBe(2);
  });

  it('derives a span from legacy absolute-layout width when no span was ever saved', () => {
    expect(getSectionSpan(createSection('a', undefined, 12))).toBe(3);
    expect(getSectionSpan(createSection('a', undefined, 6))).toBe(2);
    expect(getSectionSpan(createSection('a', undefined, 3))).toBe(1);
  });
});

describe('sanitizeWidgetConfig', () => {
  it('clamps out-of-range legacy width/height instead of letting zones overflow the grid', () => {
    const sanitized = sanitizeWidgetConfig({ layout: { x: 0, y: -5, w: 40, h: 0 } });
    expect(sanitized.layout.w).toBe(12);
    expect(sanitized.layout.h).toBe(1);
    expect(sanitized.layout.y).toBe(0);
  });

  it('clamps a persisted span to the 1..3 column range', () => {
    expect(sanitizeWidgetConfig({ layout: { x: 0, y: 0, w: 4, h: 2, span: 9 } }).layout.span).toBe(3);
    expect(sanitizeWidgetConfig({ layout: { x: 0, y: 0, w: 4, h: 2, span: 0 } }).layout.span).toBe(1);
    expect(sanitizeWidgetConfig({ layout: { x: 0, y: 0, w: 4, h: 2 } }).layout.span).toBeUndefined();
  });
});

describe('dashboard section devices', () => {
  it('lists only compatible local entities for each card kind', () => {
    const devices = [
      createDevice('light-1', 'Luz', 'light'),
      createDevice('media-1', 'Speaker', 'media_player', { domain: 'media_player', type: 'media_player', category: 'media' }),
      createDevice('camera-1', 'Cámara', 'camera'),
      createDevice('camera-sensor-1', 'Cámara importada', 'sensor', { domain: 'camera', type: 'camera', category: 'media' }),
    ];

    expect(getAssignableDevicesForSectionCard('light', devices).map((device) => device.id)).toEqual(['light-1']);
    expect(getAssignableDevicesForSectionCard('media', devices).map((device) => device.id)).toEqual(['media-1']);
    expect(getAssignableDevicesForSectionCard('camera', devices).map((device) => device.id)).toEqual(['camera-1']);
  });

  it('never treats a camera media feed as a media player', () => {
    const devices = [
      createDevice('speaker-1', 'Z.TECH SPEAKER', 'sensor', { domain: 'media_player', type: 'media_player', category: 'media' }),
      createDevice('camera-1', 'Cámara de Ingreso', 'sensor', { domain: 'camera', type: 'camera', category: 'media' }),
    ];

    expect(getAssignableDevicesForSectionCard('media', devices).map((device) => device.id)).toEqual(['speaker-1']);
  });
});

describe('dashboard device state and normalization', () => {
  it('recognizes active power, security, and analog states while rejecting absent or inactive state', () => {
    expect(isDeviceActive(createDevice('off', 'Off', 'light'))).toBe(false);
    expect(isDeviceActive({ ...createDevice('power', 'Power', 'light'), lastKnownState: { state: 'on' } })).toBe(true);
    expect(isDeviceActive({ ...createDevice('open', 'Open', 'cover'), lastKnownState: { open: true } })).toBe(true);
    expect(isDeviceActive({ ...createDevice('activity', 'Activity', 'sensor'), lastKnownState: { isActive: true } })).toBe(true);
    expect(isDeviceActive({ ...createDevice('brightness', 'Brightness', 'light'), lastKnownState: { brightness: 1 } })).toBe(true);
    expect(isDeviceActive({ ...createDevice('level', 'Level', 'light'), lastKnownState: { level: 50 } })).toBe(true);
    expect(isDeviceActive({ ...createDevice('zero', 'Zero', 'light'), lastKnownState: { brightness: 0, level: 0 } })).toBe(false);
  });

  it('filters devices by a selected room and returns none without a room selection', () => {
    const devices = [
      { ...createDevice('one', 'One', 'light'), roomId: 'room-1' },
      { ...createDevice('two', 'Two', 'light'), roomId: 'room-2' },
    ];

    expect(getDevicesInRoom(devices, 'room-1').map((device) => device.id)).toEqual(['one']);
    expect(getDevicesInRoom(devices, null)).toEqual([]);
  });

  it('classifies covers, sensors, switches, generic devices, and sorts assignable names', () => {
    const devices = [
      createDevice('switch', 'Zulu Switch', 'switch'),
      createDevice('outlet', 'Alpha Outlet', 'outlet'),
      createDevice('cover', 'Curtain', 'cover'),
      createDevice('sensor', 'Temperature', 'sensor'),
      createDevice('binary', 'Motion', 'binary_sensor'),
      createDevice('generic', 'Generic', 'lock'),
    ];

    expect(getAssignableDevicesForSectionCard('cover', devices).map((device) => device.id)).toEqual(['cover']);
    expect(getAssignableDevicesForSectionCard('sensor', devices).map((device) => device.id)).toEqual(['binary', 'sensor']);
    expect(getAssignableDevicesForSectionCard('light', devices).map((device) => device.id)).toEqual(['outlet', 'switch']);
    expect(getAssignableDevicesForSectionCard('device', devices).map((device) => device.id)).toEqual(['outlet', 'cover', 'generic', 'switch']);
    expect(getAssignableDevicesForSectionCard('unknown', devices)).toEqual([]);
  });

  it('creates a complete widget from partial data and preserves explicit identifiers', () => {
    const generated = sanitizeWidget({});
    expect(generated).toEqual(expect.objectContaining({ type: 'device_control', config: expect.any(Object) }));
    expect(generated.config.binding.entityId).toBe('');
    const explicit = sanitizeWidget({ id: 'widget-1', type: 'section', config: sanitizeWidgetConfig({ appearance: { title: 'Sala' } }) });
    expect(explicit).toEqual(expect.objectContaining({ id: 'widget-1', type: 'section' }));
    expect(explicit.config.appearance.title).toBe('Sala');
  });
});