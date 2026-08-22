import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeviceWidget } from './DeviceWidget';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => options?.state ?? key,
  }),
}));

jest.mock('../../../stores/useDeviceSnapshotStore', () => ({
  useDeviceSnapshotStore: jest.fn(),
}));

jest.mock('../../../config', () => ({ API_BASE_URL: 'http://localhost:3000' }));

jest.mock('../../../lib/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../../../components/CameraDeviceTile', () => ({
  CameraDeviceTile: () => null,
}));

jest.mock('../components/IconPicker', () => {
  const { Power } = jest.requireActual<typeof import('lucide-react')>('lucide-react');
  return {
    getDashboardIconComponent: () => Power,
    needsMdiCatalog: () => false,
    useMdiCatalogLoaded: () => undefined,
  };
});

const mockSnapshotStore = useDeviceSnapshotStore as unknown as jest.Mock;

describe('DeviceWidget accessibility', () => {
  beforeEach(() => {
    mockSnapshotStore.mockImplementation((selector: (state: unknown) => unknown) => selector({
      devices: [{
        id: 'light-1',
        homeId: 'home-1',
        roomId: 'room-1',
        name: 'Sala',
        type: 'light',
        status: 'ASSIGNED',
        lastKnownState: { state: 'on' },
        capabilities: [{ type: 'light', name: 'Light', commands: [{ name: 'turn_on' }, { name: 'turn_off' }] }],
      }],
      upsertDevice: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders the complete tile as a pressed native button for an active device', () => {
    const markup = renderToStaticMarkup(
      React.createElement(DeviceWidget, {
        config: {
          layout: { x: 0, y: 0, w: 4, h: 2 },
          binding: { entityId: 'light-1', entityType: 'device', entityName: 'Sala' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: {},
        },
        isEditing: false,
      }),
    );

    expect(markup).toContain('<button');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('device-toggle-control');
  });
});
