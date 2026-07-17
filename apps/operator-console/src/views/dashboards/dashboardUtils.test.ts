import type { DashboardWidget } from './types';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import {
  getAssignableDevicesForSectionCard,
  getDashboardCanvasColumns,
  getDashboardSectionPlaceholderY,
  getDashboardSectionStartY,
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
  it('keeps the desktop grid for a regular canvas width after sidebar space', () => {
    expect(getDashboardCanvasColumns(1024)).toBe(12);
    expect(getDashboardCanvasColumns(1180)).toBe(12);
    expect(getDashboardCanvasColumns(1023)).toBe(6);
    expect(getDashboardCanvasColumns(639)).toBe(1);
  });

  it('places the fifth section and add-section placeholder below the tallest first row', () => {
    const firstRow = Array.from({ length: 4 }, (_, index) => createSection(`section-${index}`, 3));
    const sections = [...firstRow, createSection('section-4', 0)];
    const layouts = resolveDashboardSectionLayouts(sections, true);

    expect(layouts.get('section-0')).toMatchObject({ y: 2, h: 7 });
    expect(layouts.get('section-4')).toMatchObject({ x: 0, y: 10, h: 3 });
    expect(getDashboardSectionPlaceholderY(layouts)).toBe(14);
  });

  it('reserves the full visual height of wide media cards before placing the next zone', () => {
    const section = createSection('section-media', 0);
    section.config.extra = {
      cards: [
        { id: 'light-a', kind: 'light', span: 'small' },
        { id: 'light-b', kind: 'light', span: 'small' },
        { id: 'media', kind: 'media', span: 'full' },
      ],
    };
    const nextSection = createSection('section-next', 0);
    const layouts = resolveDashboardSectionLayouts([section, nextSection], true);

    expect(layouts.get('section-media')).toMatchObject({ y: 2, h: 9 });
    expect(getDashboardSectionPlaceholderY(layouts)).toBe(12);
  });

  it('reclaims stale section height before placing the add-section placeholder', () => {
    const section = createSection('section-legacy-height', 0);
    section.config.layout.h = 18;

    const layouts = resolveDashboardSectionLayouts([section], true);

    expect(layouts.get('section-legacy-height')).toMatchObject({ y: 2, h: 3 });
    expect(getDashboardSectionPlaceholderY(layouts)).toBe(6);
  });

  it('places the first zone below a taller dashboard title', () => {
    const title: DashboardWidget = {
      id: 'title',
      type: 'dashboard_title',
      config: {
        layout: { x: 0, y: 0, w: 12, h: 4 },
        binding: { entityId: '', entityType: 'system' },
        visibility: { rules: [], defaultState: 'show' },
        appearance: { title: 'Hola', showTitle: true },
        extra: {},
      },
    };
    const section = createSection('section-after-title', 0);

    expect(getDashboardSectionStartY([title])).toBe(4);
    expect(resolveDashboardSectionLayouts([title, section], true).get(section.id)).toMatchObject({ y: 4 });
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
