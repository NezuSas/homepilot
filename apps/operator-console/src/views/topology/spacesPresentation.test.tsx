import { renderToStaticMarkup } from 'react-dom/server';
import type { TFunction } from 'i18next';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { RoomSummaryLine } from './RoomSummaryLine';
import { TopologyHomeHeader } from './TopologyHomeHeader';
import { TopologyRoomCard } from './TopologyRoomCard';
import { ROOM_DEVICE_SEARCH_THRESHOLD, TopologyRoomDetailPanel } from './TopologyRoomDetailPanel';
import { buildRoomSummary } from './roomSummaryModel';

jest.mock('../../config', () => ({ API_BASE_URL: '' }));
jest.mock('../../components/CameraMediaFrame', () => ({ CameraMediaFrame: () => null }));
jest.mock('../dashboards/components/IconPicker', () => ({ getDashboardIconComponent: () => 'svg' }));
const translate = (key: string, options?: { count?: number }) => options?.count === undefined ? key : `${key}:${options.count}`;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { count?: number }) => options?.count === undefined ? key : `${key}:${options.count}` }) }));

const device = (extra: Partial<SnapshotDevice> = {}): SnapshotDevice => ({
  id: `d-${Math.random()}`, homeId: 'h', roomId: 'r', name: 'Dispositivo', type: 'light', status: 'ASSIGNED', lastKnownState: { on: false }, ...extra,
});
const camera = (name: string) => device({ type: 'camera', name, lastKnownState: null });
const room = { id: 'r', name: 'Patio', homeId: 'h' };
const noop = () => {};

describe('Feature: the space summary line', () => {
  it('Scenario: Given a space with cameras and a switch When shown as a card Then it names only those kinds, without a total', () => {
    const html = renderToStaticMarkup(<RoomSummaryLine compact summary={buildRoomSummary([camera('a'), camera('b'), device({ type: 'switch', semanticType: 'switch' })])} />);
    expect(html).toContain('topology.summary.switch:1 · topology.summary.camera:2');
    expect(html).not.toContain('topology.room_device_count');
    expect(html).not.toContain('topology.summary.light');
  });

  it('Scenario: Given a space with nothing When shown Then it says so instead of inventing content', () => {
    expect(renderToStaticMarkup(<RoomSummaryLine summary={buildRoomSummary([])} />)).toContain('topology.summary.empty');
  });

  it('Scenario: Given devices that do not answer When shown Then the problem is named in text with an icon, not only colour', () => {
    const html = renderToStaticMarkup(<RoomSummaryLine summary={buildRoomSummary([device({ lastKnownState: { state: 'unavailable' } })])} />);
    expect(html).toContain('topology.summary.unavailable:1');
    expect(html).toContain('<svg');
  });

  it('Scenario: Given a space with no on/off devices When shown in full Then "on" is not claimed', () => {
    const html = renderToStaticMarkup(<RoomSummaryLine summary={buildRoomSummary([device({ type: 'sensor', semanticType: 'sensor', lastKnownState: { state: '21' } })])} />);
    expect(html).not.toContain('topology.active_device_count');
    expect(html).toContain('topology.room_device_count:1');
  });
});

describe('Feature: a space card shows what the space holds', () => {
  it('Scenario: Given the card When rendered Then the name leads and the summary replaces the uppercase device count', () => {
    const html = renderToStaticMarkup(<TopologyRoomCard room={room} devices={[camera('a'), camera('b')]} selected={false} onSelect={noop} />);
    expect(html).toContain('Patio');
    expect(html).toContain('topology.summary.camera:2');
    expect(html).not.toContain('uppercase');
    expect(html).toContain('aria-pressed="false"');
  });
});

describe('Feature: the home line and adding a space', () => {
  const header = (extra: Partial<Parameters<typeof TopologyHomeHeader>[0]> = {}) => renderToStaticMarkup(
    <TopologyHomeHeader home={{ id: 'h', name: 'Oficina', ownerId: 'u' }} roomCount={5} canManage editing={false} nameDraft="" isRenaming={false}
      newRoomName="" isCreatingRoom={false} onNameDraftChange={noop} onBeginRename={noop} onCancelRename={noop} onRename={noop}
      onNewRoomNameChange={noop} onAddRoom={noop} {...extra} />);

  it('Scenario: Given the owner When the header shows Then the home is a quiet line with the space count and one add action', () => {
    const html = header();
    expect(html).toContain('Oficina');
    expect(html).toContain('topology.room_count:5');
    expect(html).toContain('topology.add_room');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<h');
  });

  it('Scenario: Given the owner When the header shows Then renaming the home is in a menu, not a pencil beside the title', () => {
    const html = header();
    expect(html).toContain('topology.home_actions');
    expect(html).not.toContain('aria-label="topology.rename_home"');
  });

  it('Scenario: Given someone who cannot manage the home When the header shows Then there is no add action or menu', () => {
    const html = header({ canManage: false });
    expect(html).not.toContain('topology.add_room');
    expect(html).not.toContain('topology.home_actions');
  });
});

describe('Feature: the space detail', () => {
  const panel = (devices: SnapshotDevice[]) => renderToStaticMarkup(
    <TopologyRoomDetailPanel room={room} devices={devices} visibleDevices={devices} canManage editing={false} draft="" renameError="" isRenaming={false}
      deviceSearch="" isDeleting={false} t={translate as unknown as TFunction} onDraftChange={noop} onRename={noop} onStartRename={noop}
      onCancelRename={noop} onClose={noop} onDeviceSearchChange={noop} onDeviceCommand={async () => null} onDelete={noop} />);

  it('Scenario: Given a space When the detail opens Then there is no decorative illustration and the summary leads', () => {
    const html = panel([camera('a')]);
    expect(html).not.toContain('data-room-scene');
    expect(html).toContain('topology.room_device_count:1');
    expect(html).toContain('topology.delete_room');
  });

  it('Scenario: Given a handful of devices When the detail opens Then there is no device search', () => {
    expect(panel(Array.from({ length: ROOM_DEVICE_SEARCH_THRESHOLD - 1 }, () => device()))).not.toContain('topology.search_devices');
  });

  it('Scenario: Given many devices When the detail opens Then the device search appears', () => {
    expect(panel(Array.from({ length: ROOM_DEVICE_SEARCH_THRESHOLD }, () => device()))).toContain('topology.search_devices');
  });

  it('Scenario: Given momentary commands among lights When the detail opens Then they sit under their own Actions heading', () => {
    const action = device({ name: 'ON/OFF TV', type: 'sensor', semanticType: 'light', lastKnownState: null,
      capabilities: [{ type: 'button', name: 'Button', commands: [{ name: 'press' }] }] });
    const html = panel([device({ name: 'Lámpara' }), action]);
    expect(html).toContain('aria-label="topology.group_action"');
    expect(html.indexOf('Lámpara')).toBeLessThan(html.indexOf('topology.group_action'));
    expect(html.indexOf('topology.group_action')).toBeLessThan(html.indexOf('ON/OFF TV'));
  });

  it('Scenario: Given an empty space When the detail opens Then it explains how to fill it', () => {
    expect(panel([])).toContain('topology.no_devices_in_room');
  });
});
