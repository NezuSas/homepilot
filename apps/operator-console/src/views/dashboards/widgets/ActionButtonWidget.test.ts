import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActionButtonWidget } from './ActionButtonWidget';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => options?.name ? `${key}:${options.name}` : key,
  }),
}));

jest.mock('../../../stores/useDeviceSnapshotStore', () => ({
  useDeviceSnapshotStore: jest.fn(),
}));

jest.mock('../../../config', () => ({ API_BASE_URL: 'http://localhost:3000' }));
jest.mock('../../../lib/apiClient', () => ({ apiFetch: jest.fn() }));

const mockSnapshotStore = useDeviceSnapshotStore as unknown as jest.Mock;

describe('ActionButtonWidget accessibility', () => {
  beforeEach(() => {
    mockSnapshotStore.mockImplementation((selector: (state: unknown) => unknown) => selector({
      devices: [{
        id: 'button-1',
        homeId: 'home-1',
        roomId: 'room-1',
        name: 'Abrir portón',
        type: 'button',
        semanticType: 'button',
        status: 'ASSIGNED',
        lastKnownState: { state: '2026-08-21T12:00:00Z' },
        capabilities: [{ type: 'button', name: 'Button', commands: [{ name: 'press' }] }],
      }],
      upsertDevice: jest.fn(),
    }));
  });

  afterEach(() => jest.resetAllMocks());

  it('renders a stateless native button without an aria-pressed state', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ActionButtonWidget, {
        config: {
          layout: { x: 0, y: 0, w: 4, h: 2 },
          binding: { entityId: 'button-1', entityType: 'device', entityName: 'Abrir portón' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: {},
        },
        isEditing: false,
      }),
    );

    expect(markup).toContain('<button');
    expect(markup).toContain('dashboards.widgets.action_button.aria:Abrir portón');
    expect(markup).not.toContain('aria-pressed');
  });
});