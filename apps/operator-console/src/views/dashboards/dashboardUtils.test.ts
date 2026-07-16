import type { DashboardWidget } from './types';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import {
  getAssignableDevicesForSectionCard,
  getDashboardSectionPlaceholderY,
  resolveDashboardSectionLayouts,
} from './dashboardUtils';

function createSection(id: string, cardCount: number): DashboardWidget {
  return {
    id,
    type: 'section',
    config: {
      layout: { x: 0, y: 2, w: 3, h: 2 },
      binding: { entityId: '', entityType: 'system' },
      visibility: { rules: [], defaultState: 'show' },
      appearance: { title: id, showTitle: true },
      extra: {
        cards: Array.from({ length: cardCount }, (_, index) => ({ id: `${id}-card-${index}` })),
      },
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

describe('dashboard section layout', () => {
  it('places the fifth section and add-section placeholder below the tallest first row', () => {
    const firstRow = Array.from({ length: 4 }, (_, index) => createSection(`section-${index}`, 3));
    const sections = [...firstRow, createSection('section-4', 0)];
    const layouts = resolveDashboardSectionLayouts(sections, true);

    expect(layouts.get('section-0')).toMatchObject({ y: 2, h: 7 });
    expect(layouts.get('section-4')).toMatchObject({ x: 0, y: 10, h: 4 });
    expect(getDashboardSectionPlaceholderY(layouts)).toBe(15);
  });

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
