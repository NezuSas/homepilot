import { renderToStaticMarkup } from 'react-dom/server';
import { BulkAssignBar, BulkAssignSummary } from './BulkAssignBar';
import type { SnapshotDevice as Device } from '../stores/useDeviceSnapshotStore';

jest.mock('../config', () => ({ API_BASE_URL: '' }));
jest.mock('../lib/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { count?: number }) => (options?.count === undefined ? key : `${key}:${options.count}`) }),
}));

const device = (id: string, state: string): Device => ({ id, homeId: 'h', roomId: null, name: id, type: 'switch', status: 'PENDING', lastKnownState: { state } } as Device);
const rooms = [{ id: 'office', homeId: 'h', name: 'Oficina' }];

describe('Feature: bulk assignment bar', () => {
  it('Scenario: Given available and offline devices When shown Then the button counts only the ones it can assign', () => {
    const html = renderToStaticMarkup(<BulkAssignBar devices={[device('a', 'off'), device('b', 'off'), device('c', 'unavailable')]} rooms={rooms} onUpdate={() => {}} onFinished={() => {}} />);

    expect(html).toContain('inbox.bulk.title');
    expect(html).toContain('inbox.bulk.button:2');
    expect(html).toContain('inbox.choose_room');
  });

  it('Scenario: Given no room chosen When shown Then the action is disabled', () => {
    const html = renderToStaticMarkup(<BulkAssignBar devices={[device('a', 'off'), device('b', 'off')]} rooms={rooms} onUpdate={() => {}} onFinished={() => {}} />);

    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*inbox\.bulk\.button:2/);
  });

  it('Scenario: Given only offline devices When shown Then there is nothing to assign', () => {
    const html = renderToStaticMarkup(<BulkAssignBar devices={[device('a', 'unavailable'), device('b', 'unavailable')]} rooms={rooms} onUpdate={() => {}} onFinished={() => {}} />);

    expect(html).toContain('inbox.bulk.button:0');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*inbox\.bulk\.button:0/);
  });
});

describe('Feature: result of a bulk assignment', () => {
  it('Scenario: Given a mixed result When shown Then each outcome has its own line', () => {
    const html = renderToStaticMarkup(<BulkAssignSummary outcome={{ assigned: 3, skipped: 1, failed: 2 }} onDismiss={() => {}} />);

    expect(html).toContain('inbox.bulk.done:3');
    expect(html).toContain('inbox.bulk.skipped:1');
    expect(html).toContain('inbox.bulk.failed:2');
    expect(html).toContain('role="status"');
  });

  it('Scenario: Given everything assigned When shown Then only the success line appears', () => {
    const html = renderToStaticMarkup(<BulkAssignSummary outcome={{ assigned: 5, skipped: 0, failed: 0 }} onDismiss={() => {}} />);

    expect(html).toContain('inbox.bulk.done:5');
    expect(html).not.toContain('inbox.bulk.skipped');
    expect(html).not.toContain('inbox.bulk.failed');
  });
});
