import {
  getSafeFindingMetadata,
  hasTechnicalFindingMetadata,
} from '../assistantFindingPresentation';

describe('assistant finding presentation', () => {
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
