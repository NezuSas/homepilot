import { AssistantMultiCommandParser } from '../application/AssistantMultiCommandParser';
import {
  createMockDeviceRepository,
  createMockRoomRepository,
  createMockHomeRepository,
  createTestDevice,
  createTestRoom,
  createTestHome
} from './test_helpers';
import { AssistantMultiCommandResult } from '../application/ports/IntentInterpreterPort';

/**
 * Covers the generalization requested after the two literal user-reported phrases
 * ("Apaga todas las luces menos dicroicos y gata", "Apaga dicroicos de la zona tech"):
 * multiple exclusion terms, free (non-hardcoded) category words, room/zone-scoped
 * categories, typo tolerance, and home isolation — not just the two exact sentences.
 */
describe('AssistantMultiCommandParser - exclusions & zone/category generalization', () => {
  let deviceRepo: any;
  let roomRepo: any;
  let homeRepo: any;

  beforeEach(() => {
    deviceRepo = createMockDeviceRepository();
    roomRepo = createMockRoomRepository();
    homeRepo = createMockHomeRepository();
  });

  function buildParser() {
    // No homeRepository wired by default: these tests exercise exclusion/category
    // parsing logic, not home-scoping, so they use the legacy findAll() fallback.
    // The dedicated home-isolation test below wires homeRepo explicitly.
    return new AssistantMultiCommandParser(deviceRepo, roomRepo);
  }

  function expectSuccessDeviceIds(result: AssistantMultiCommandResult | null): string[] {
    expect(result?.type).toBe('success');
    const success = result as Extract<AssistantMultiCommandResult, { type: 'success' }>;
    return success.intent.actions.map(a => a.deviceId).sort();
  }

  it('"Apaga todas las luces menos dicroicos y gata" — multiple exclusions, no hardcoded category list', async () => {
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Dicroico Sala', type: 'light' }),
      createTestDevice({ id: 'd2', name: 'Dicroico Cocina', type: 'light' }),
      createTestDevice({ id: 'd3', name: 'Gata', type: 'light' }),
      createTestDevice({ id: 'd4', name: 'Luz Principal', type: 'light' }),
      createTestDevice({ id: 'd5', name: 'Sensor Movimiento', type: 'binary_sensor' })
    ]);
    roomRepo.findAll.mockResolvedValue([]);

    const parser = buildParser();
    const result = await parser.parse('Apaga todas las luces menos dicroicos y gata', 'u1');

    expect(expectSuccessDeviceIds(result)).toEqual(['d4']);
    if (result?.type === 'success') {
      expect(result.intent.actions[0].command).toBe('turn_off');
    }
  });

  it('"Apagada todas las luces menos dicroicos y gata" (passive form) resolves identically', async () => {
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Dicroico Sala', type: 'light' }),
      createTestDevice({ id: 'd3', name: 'Gata', type: 'light' }),
      createTestDevice({ id: 'd4', name: 'Luz Principal', type: 'light' })
    ]);
    roomRepo.findAll.mockResolvedValue([]);

    const parser = buildParser();
    const result = await parser.parse('Apagada todas las luces menos dicroicos y gata', 'u1');

    expect(expectSuccessDeviceIds(result)).toEqual(['d4']);
  });

  it('supports comma-separated exclusions mixed with "y": "apaga todo, excepto la cocina, el bano y gata"', async () => {
    roomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cocina' }), createTestRoom({ id: 'r2', name: 'Baño' })]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Cocina', type: 'light', roomId: 'r1' }),
      createTestDevice({ id: 'd2', name: 'Luz Baño', type: 'light', roomId: 'r2' }),
      createTestDevice({ id: 'd3', name: 'Gata', type: 'light', roomId: 'r3' }),
      createTestDevice({ id: 'd4', name: 'Luz Pasillo', type: 'light', roomId: 'r3' })
    ]);

    const parser = buildParser();
    const result = await parser.parse('apaga todo, excepto la cocina, el bano y gata', 'u1');

    expect(expectSuccessDeviceIds(result)).toEqual(['d4']);
  });

  it('excludes a room by name and tolerates a typo in the exception term ("cosina")', async () => {
    roomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cocina' })]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light', roomId: 'r2' }),
      createTestDevice({ id: 'd2', name: 'Luz Cocina', type: 'light', roomId: 'r1' })
    ]);

    const parser = buildParser();
    const result = await parser.parse('apaga todo menos la cosina', 'u1');

    expect(expectSuccessDeviceIds(result)).toEqual(['d1']);
  });

  it('generic (non-hardcoded) category word "ventiladores" scoped to base action, excluding one by name', async () => {
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Ventilador Sala', type: 'switch' }),
      createTestDevice({ id: 'd2', name: 'Ventilador Cocina', type: 'switch' }),
      createTestDevice({ id: 'd3', name: 'Luz Sala', type: 'light' })
    ]);
    roomRepo.findAll.mockResolvedValue([]);

    const parser = buildParser();
    const result = await parser.parse('enciende ventiladores menos el de cocina'.replace('el de cocina', 'ventilador cocina'), 'u1');

    // The base category "ventiladores" should only ever match devices whose name
    // contains "ventilador"/"ventiladores" — never a hardcoded keyword list.
    expect(expectSuccessDeviceIds(result)).toEqual(['d1']);
    if (result?.type === 'success') {
      expect(result.intent.actions[0].command).toBe('turn_on');
    }
  });

  it('"Apaga dicroicos de la zona tech" — free category scoped to a room used as a "zone"', async () => {
    roomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r-tech', name: 'Tech' }), createTestRoom({ id: 'r-other', name: 'Sala' })]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Dicroico 1', type: 'light', roomId: 'r-tech' }),
      createTestDevice({ id: 'd2', name: 'Dicroico 2', type: 'light', roomId: 'r-tech' }),
      createTestDevice({ id: 'd3', name: 'Luz Sala', type: 'light', roomId: 'r-other' }),
      createTestDevice({ id: 'd4', name: 'Enchufe Tech', type: 'outlet', roomId: 'r-tech' })
    ]);

    const parser = buildParser();
    const result = await parser.parse('Apaga dicroicos de la zona tech', 'u1');

    expect(expectSuccessDeviceIds(result)).toEqual(['d1', 'd2']);
  });

  it('"apaga dicroicos en tech" (no "zona" keyword, English-order-free phrasing) resolves the same way', async () => {
    roomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r-tech', name: 'Tech' })]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Dicroico 1', type: 'light', roomId: 'r-tech' })
    ]);

    const parser = buildParser();
    const result = await parser.parse('apaga dicroicos en tech', 'u1');

    expect(expectSuccessDeviceIds(result)).toEqual(['d1']);
  });

  it('zone/category command with an unresolvable room returns a clean failure, not a crash', async () => {
    roomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cocina' })]);
    deviceRepo.findAll.mockResolvedValue([]);

    const parser = buildParser();
    const result = await parser.parse('apaga dicroicos de la zona sotano', 'u1');

    expect(result).toBeNull();
  });

  it('an exclusion term that cannot be resolved fails the whole command instead of silently ignoring it', async () => {
    roomRepo.findAll.mockResolvedValue([]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light' })
    ]);

    const parser = buildParser();
    const result = await parser.parse('apaga todo menos el garaje', 'u1');

    expect(result?.type).toBe('failure');
  });

  it('never leaks devices from another home into the base scope or the exclusion vocabulary', async () => {
    const homeA = createTestHome({ id: 'home-a', ownerId: 'u1' });
    homeRepo.findHomesByUserId.mockResolvedValue([homeA]);

    deviceRepo.findAllByHomeId.mockImplementation((homeId: string) => {
      if (homeId === 'home-a') {
        return Promise.resolve([
          createTestDevice({ id: 'd1', name: 'Dicroico Sala', homeId: 'home-a', type: 'light' }),
          createTestDevice({ id: 'd2', name: 'Luz Principal', homeId: 'home-a', type: 'light' })
        ]);
      }
      return Promise.resolve([]);
    });
    // findAll() would return devices from every home, including one the user does not own —
    // this must never surface in the resolved scope.
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Dicroico Sala', homeId: 'home-a', type: 'light' }),
      createTestDevice({ id: 'd2', name: 'Luz Principal', homeId: 'home-a', type: 'light' }),
      createTestDevice({ id: 'd-foreign', name: 'Dicroico Ajeno', homeId: 'home-b', type: 'light' })
    ]);
    roomRepo.findAll.mockResolvedValue([]);
    roomRepo.findRoomsByHomeId.mockResolvedValue([]);

    const parser = new AssistantMultiCommandParser(deviceRepo, roomRepo, homeRepo);
    const result = await parser.parse('apaga todas las luces menos dicroicos', 'u1');

    expect(expectSuccessDeviceIds(result)).toEqual(['d2']);
    expect(deviceRepo.findAllByHomeId).toHaveBeenCalledWith('home-a');
  });

  it('falls back to the unrestricted list when no homeRepository is configured (legacy/test setups)', async () => {
    const legacyParser = new AssistantMultiCommandParser(deviceRepo, roomRepo);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light' }),
      createTestDevice({ id: 'd2', name: 'Luz Cocina', type: 'light' })
    ]);
    roomRepo.findAll.mockResolvedValue([]);

    const result = await legacyParser.parse('apaga todo menos la luz de cocina', 'u1');

    expect(expectSuccessDeviceIds(result)).toEqual(['d1']);
  });
});
