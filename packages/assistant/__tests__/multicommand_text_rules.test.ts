import {
  COMMAND_CONNECTORS,
  EXCLUSION_WORDS,
  ZONE_CATEGORY_REGEX,
  categoryMatchesDeviceName,
  extractCategoryWord,
  inferCommandFromSegment,
  normalizePrompt,
  stripArticlesAndBulkWords,
} from '../application/multicommand/textRules';
import { resolveTargets } from '../application/multicommand/targetResolution';
import type { Device } from '../../devices/domain/types';
import type { Room } from '../../topology/domain/types';

function device(id: string, name: string, roomId: string | null = null): Device {
  return { id, name, roomId, type: 'light', homeId: 'h1', lastKnownState: null } as unknown as Device;
}

describe('multicommand textRules', () => {
  it('normalizes accents and punctuation but keeps commas as separators', () => {
    expect(normalizePrompt('¿Apaga lámparas, excepto la Cocina!')).toBe('apaga lamparas , excepto la cocina');
  });

  it('exposes the connector and exclusion tables', () => {
    expect(COMMAND_CONNECTORS).toContain(' y ');
    expect(EXCLUSION_WORDS).toContain(' menos ');
  });

  it('infers commands only for unambiguous segments', () => {
    expect(inferCommandFromSegment('apaga la sala')).toBe('turn_off');
    expect(inferCommandFromSegment('prende la sala')).toBe('turn_on');
    expect(inferCommandFromSegment('apaga y prende')).toBeNull();
    expect(inferCommandFromSegment('onion')).toBeNull();
  });

  it('strips articles and bulk words and extracts the category word', () => {
    expect(stripArticlesAndBulkWords('todas las luces de la sala')).toBe('luces sala');
    expect(extractCategoryWord('apaga todo')).toBe('todo');
    expect(extractCategoryWord('apaga los dicroicos')).toBe('dicroicos');
  });

  it('matches categories with singular or plural tolerance', () => {
    expect(categoryMatchesDeviceName('dicroicos', 'Dicroico Cocina')).toBe(true);
    expect(categoryMatchesDeviceName('', 'Luz')).toBe(false);
    expect(categoryMatchesDeviceName('ventilador', 'Luz Sala')).toBe(false);
  });

  it('captures verb, category and zone in the zone/category pattern', () => {
    const match = 'apaga dicroicos en la zona patio'.match(ZONE_CATEGORY_REGEX);
    expect(match?.slice(1)).toEqual(['apaga', 'dicroicos', 'patio']);
  });
});

describe('multicommand targetResolution', () => {
  const rooms = [{ id: 'r1', name: 'Cocina' } as unknown as Room];

  it('matches an exact device name', async () => {
    const result = await resolveTargets('luz sala', [device('d1', 'Luz Sala')], []);
    expect(result).toEqual({ type: 'match', devices: [expect.objectContaining({ id: 'd1' })] });
  });

  it('requires clarification for a room without an explicit bulk keyword', async () => {
    const result = await resolveTargets('cocina', [device('d1', 'Luz', 'r1')], rooms);
    expect(result).toMatchObject({ type: 'clarificationRequired', originalSegment: 'cocina' });
  });

  it('expands a room only with an explicit bulk keyword', async () => {
    const result = await resolveTargets('todas las luces cocina', [device('d1', 'Luz', 'r1'), device('d2', 'Foco', 'r1')], rooms);
    expect(result).toMatchObject({ type: 'match' });
  });

  it('fails when nothing can be resolved', async () => {
    expect(await resolveTargets('xyz', [device('d1', 'Luz Sala')], [])).toEqual({
      type: 'failure',
      message: 'No pude encontrar qué controlar en: "xyz"',
    });
  });
});
