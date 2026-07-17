import type { DashboardWidget } from './types';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import {
  clampSectionSpan,
  getAssignableDevicesForSectionCard,
  getDashboardSectionColumns,
  getSectionSpan,
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

function createDevice(id: string, name: string, type: string, category?: string): SnapshotDevice {
  return {
    id,
    homeId: 'home-1',
    roomId: null,
    name,
    type,
    status: 'ASSIGNED',
    lastKnownState: null,
    ...(category ? {
      profile: {
        source: 'home-assistant',
        domain: type,
        type,
        displayName: name,
        category,
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
      createDevice('media-1', 'Speaker', 'media_player', 'media'),
      createDevice('camera-1', 'Cámara', 'camera'),
    ];

    expect(getAssignableDevicesForSectionCard('light', devices).map((device) => device.id)).toEqual(['light-1']);
    expect(getAssignableDevicesForSectionCard('media', devices).map((device) => device.id)).toEqual(['media-1']);
    expect(getAssignableDevicesForSectionCard('camera', devices).map((device) => device.id)).toEqual(['camera-1']);
  });
});
