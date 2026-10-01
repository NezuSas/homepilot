import {
  getSafeFindingMetadata,
  getFindingDescription,
  hasTechnicalFindingMetadata,
} from '../assistantFindingPresentation';

describe('assistant finding presentation', () => {
  const translate = (key: string, values: Record<string, unknown>) => `${key}:${values.timeWindow ?? ''}`;
  it.each([undefined, '', '24:00', 'bad'])('does not invent a midnight habit for invalid window %p', timeWindow => {
    expect(getFindingDescription({ type: 'habit_pattern_detected', metadata: { timeWindow } }, translate)).toBe('assistant.evidence.habit:' + (timeWindow ?? ''));
  });
  it('preserves valid midnight as recorded evidence, not an invented default', () => {
    expect(getFindingDescription({ type: 'habit_pattern_detected', metadata: { timeWindow: '00:00' } }, translate)).toBe('assistant.evidence.habit_window:00:00');
  });
  it('distinguishes long duration from inactivity for the same optimization type', () => {
    expect(getFindingDescription({ type: 'optimization_opportunity', metadata: { reasonKey: 'long_duration_on', hoursOn: 9 } }, translate)).toContain('assistant.evidence.long_duration');
    expect(getFindingDescription({ type: 'optimization_opportunity', metadata: { daysInactive: 21 } }, translate)).toContain('assistant.evidence.inactivity');
    expect(getFindingDescription({ type: 'optimization_opportunity', metadata: {} }, translate)).toContain('assistant.generic_finding_description');
  });
  it('hides Home Assistant entity identifiers from user-facing copy', () => {
    const metadata = {
      deviceName: 'GUUS-satellite GUUS-satellite_cargadecpu',
      roomName: 'Sala',
    };

    expect(hasTechnicalFindingMetadata(metadata)).toBe(true);
    expect(getSafeFindingMetadata(metadata)).toEqual({
      deviceName: '',
      roomName: 'Sala',
    });
  });

  it('preserves readable names', () => {
    const metadata = { deviceName: 'Luz de sala' };

    expect(hasTechnicalFindingMetadata(metadata)).toBe(false);
    expect(getSafeFindingMetadata(metadata)).toEqual(metadata);
  });
});
