import { eventNames, matchesEventName, eventAction, localEventDate } from './eventFiltering';

describe('observable event name filters', () => {
  const devices = [{ id: 'entity-1', name: 'Gata' }];
  it('matches a partial name in nested scene/automation actions without matching IDs', () => {
    const names = eventNames({ actions: [{ deviceId: 'entity-1' }], sceneName: 'Salir' }, devices);
    expect(matchesEventName('gat', names)).toBe(true);
    expect(matchesEventName('GAT', names)).toBe(true);
    expect(matchesEventName('entity-1', names)).toBe(false);
    expect(matchesEventName('sal', names)).toBe(true);
  });
  it('handles missing/malformed data and does not fabricate entity relationships', () => {
    expect(eventNames('invalid JSON', devices)).toEqual([]);
    expect(eventNames({ deviceId: 'missing' }, devices)).toEqual([]);
    expect(matchesEventName('', [])).toBe(true);
  });
  it('classifies automation, scene and command evidence', () => {
    expect(eventAction('COMMAND_DISPATCHED', { isAutomation: true })).toBe('automation');
    expect(eventAction('COMMAND_DISPATCHED', { sceneName: 'Salir' })).toBe('scene');
    expect(eventAction('COMMAND_DISPATCHED', {})).toBe('command');
    expect(localEventDate('invalid')).toBe('');
  });
});
