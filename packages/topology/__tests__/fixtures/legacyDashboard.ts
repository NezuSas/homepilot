import type { Dashboard, DashboardWidget } from '../../domain/Dashboard';

/** Synthetic fixture only: no appliance data or identifiers. */
export function legacySection(id = 'section-a'): DashboardWidget {
  return {
    id, type: 'section', config: {
      layout: { x: 0, y: 2, w: 4, h: 8, span: 2 },
      appearance: { title: 'Example section', icon: 'mdi:home', showTitle: true },
      visibility: { defaultState: 'show', rules: [] },
      binding: { entityType: 'room', entityId: 'example-room' },
      extra: {
        customSectionOption: { retained: true },
        cards: [
          { id: 'card-a', kind: 'light', span: 'small', order: 99, entityId: 'example-light', icon: 'mdi:lightbulb' },
          { id: 'card-b', kind: 'sensor', span: 'medium', order: -1, entityId: 'example-sensor', sensorScale: { min: -20, max: 80 }, sensorDecimals: true, visualStyle: 'level' },
          { id: 'card-c', kind: 'media', span: 'full', order: 0, entityId: 'example-player', mediaVariant: 'classic' },
        ],
      },
    },
  };
}

export function legacyDashboard(): Dashboard {
  return {
    id: 'example-dashboard', ownerId: 'example-owner', title: 'Example',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
    visibility: { roles: [], users: ['example-viewer'], homes: [] },
    tabs: [{
      id: 'example-tab', title: 'Example tab', isDefault: true, icon: 'mdi:home',
      background: '/example/background.jpg', backgroundOpacity: 0.5,
      visibility: { users: ['example-viewer'] },
      widgets: [
        { id: 'header', type: 'dashboard_title', config: { extra: { markdown: '# Example' } } },
        legacySection(),
        { id: 'standalone', type: 'selected_device', config: { binding: { entityId: 'example-device' }, layout: { span: 1 } } },
        { id: 'empty', type: 'section', config: { appearance: { showTitle: false } } },
      ],
    }],
  };
}
