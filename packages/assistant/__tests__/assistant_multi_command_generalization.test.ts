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
  it('returns a safe failure when an authenticated user has no authorized homes', async () => {
    homeRepo.findHomesByUserId.mockResolvedValue([]);
    const parser = new AssistantMultiCommandParser(deviceRepo, roomRepo, homeRepo);

    const result = await parser.parse('apaga todo menos la cocina', 'user-without-home');

    expect(result).toEqual(expect.objectContaining({ type: 'failure' }));
    expect(deviceRepo.findAllByHomeId).not.toHaveBeenCalled();
    expect(roomRepo.findRoomsByHomeId).not.toHaveBeenCalled();
  });
  it('returns null for non-command text so the normal conversational flow can handle it', async () => {
    const result = await buildParser().parse('¿Cómo está el clima hoy?', 'u1');

    expect(result).toBeNull();
  });

  it('requires clarification for a singular room reference instead of expanding it implicitly', async () => {
    roomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r-sala', name: 'Sala' })]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Sala', roomId: 'r-sala', type: 'light' }),
      createTestDevice({ id: 'd2', name: 'Foco Sala', roomId: 'r-sala', type: 'light' }),
    ]);

    const result = await buildParser().parse('apaga sala y prende luz cocina', 'u1');

    expect(result).toEqual(expect.objectContaining({
      type: 'clarificationRequired',
      originalSegment: 'apaga sala',
    }));
  });

  it('expands a room only when a segment explicitly requests all its lights', async () => {
    roomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r-sala', name: 'Sala' })]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'd1', name: 'Luz Sala', roomId: 'r-sala', type: 'light' }),
      createTestDevice({ id: 'd2', name: 'Foco Sala', roomId: 'r-sala', type: 'light' }),
      createTestDevice({ id: 'd3', name: 'Lámpara Estudio', roomId: 'r-estudio', type: 'light' }),
    ]);

    const result = await buildParser().parse('apaga todas las luces de sala y enciende lampara estudio', 'u1');

    expect(expectSuccessDeviceIds(result)).toEqual(['d1', 'd2', 'd3']);
  });

  it('rejects unavailable, sensor, and unsupported command targets before creating a command list', async () => {
    roomRepo.findAll.mockResolvedValue([]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'unavailable', name: 'Luz Exterior', type: 'light', lastKnownState: { state: 'unavailable' } }),
      createTestDevice({ id: 'sensor', name: 'Sensor Patio', type: 'sensor' }),
    ]);

    const result = await buildParser().parse('apaga luz exterior y apaga sensor patio', 'u1');

    expect(result).toEqual(expect.objectContaining({ type: 'failure' }));
  });
});
describe('AssistantMultiCommandParser - empty category scope', () => {
  it('returns a safe failure when a known room has no controllable device in the requested category', async () => {
    const deviceRepo = createMockDeviceRepository();
    const roomRepo = createMockRoomRepository();
    roomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r-tech', name: 'Tech' })]);
    deviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'sensor-1', name: 'Dicroico Sensor', type: 'sensor', roomId: 'r-tech' }),
      createTestDevice({ id: 'light-1', name: 'Luz Pasillo', type: 'light', roomId: 'r-other' }),
    ]);

    const result = await new AssistantMultiCommandParser(deviceRepo, roomRepo).parse('apaga dicroicos de la zona tech', 'u1');

    expect(result).toEqual({ type: 'failure', message: 'No encontré "dicroicos" en "Tech".' });
  });
});

describe('AssistantMultiCommandParser - deterministic parsing primitives', () => {
  function parserForPrimitives() {
    return new AssistantMultiCommandParser(createMockDeviceRepository(), createMockRoomRepository()) as unknown as {
      normalizePrompt(prompt: string): string;
      inferCommandFromSegment(segment: string): string | null;
      extractCategoryWord(segment: string): string;
      categoryMatchesDeviceName(category: string, deviceName: string): boolean;
      isControllableDevice(device: ReturnType<typeof createTestDevice>, command: string): boolean;
    };
  }

  it('normalizes accents and punctuation while preserving comma separators for exclusions', () => {
    const parser = parserForPrimitives();

    expect(parser.normalizePrompt('¿Apaga lámparas, excepto la Cocina!')).toBe('apaga lamparas , excepto la cocina');
  });

  it('recognizes command words only at valid boundaries and preserves ambiguous inputs', () => {
    const parser = parserForPrimitives();

    expect(parser.inferCommandFromSegment('turn off office light')).toBe('turn_off');
    expect(parser.inferCommandFromSegment('enciende la sala')).toBe('turn_on');
    expect(parser.inferCommandFromSegment('configuracion avanzada')).toBeNull();
    expect(parser.inferCommandFromSegment('apaga y enciende todo')).toBeNull();
  });

  it('treats short English command words as complete tokens only', () => {
    const parser = parserForPrimitives();

    expect(parser.inferCommandFromSegment('switch off the office')).toBe('turn_off');
    expect(parser.inferCommandFromSegment('turn on the office light')).toBe('turn_on');
    expect(parser.inferCommandFromSegment('onion lamp')).toBeNull();
    expect(parser.inferCommandFromSegment('power off and on')).toBeNull();
  });
  it('derives category words and tolerates Spanish singular or plural device names', () => {
    const parser = parserForPrimitives();

    expect(parser.extractCategoryWord('apaga todas las luces')).toBe('luces');
    expect(parser.extractCategoryWord('apaga todo')).toBe('todo');
    expect(parser.categoryMatchesDeviceName('dicroicos', 'Dicroico Cocina')).toBe(true);
    expect(parser.categoryMatchesDeviceName('ventilador', 'Ventiladores Sala')).toBe(true);
    expect(parser.categoryMatchesDeviceName('dicroicos', 'Luz Sala')).toBe(false);
  });

  it('rejects unavailable sensors while accepting controllable physical devices', () => {
    const parser = parserForPrimitives();

    expect(parser.isControllableDevice(createTestDevice({ type: 'light', name: 'Luz Sala' }), 'turn_on')).toBe(true);
    expect(parser.isControllableDevice(createTestDevice({ type: 'sensor', name: 'Sensor Patio' }), 'turn_on')).toBe(false);
    expect(parser.isControllableDevice(createTestDevice({ type: 'light', name: 'Luz Exterior', lastKnownState: { state: 'unavailable' } }), 'turn_off')).toBe(false);
  });
  it('keeps malformed connector input bounded instead of generating an empty command list', async () => {
    const deviceRepo = createMockDeviceRepository();
    const roomRepo = createMockRoomRepository();
    const parser = new AssistantMultiCommandParser(deviceRepo, roomRepo) as unknown as {
      parseCompound(originalPrompt: string, normalized: string, connectors: string[], userId?: string): Promise<AssistantMultiCommandResult>;
    };

    await expect(parser.parseCompound('apaga sala', 'apaga sala', [' y '], 'u1')).resolves.toEqual({
      type: 'failure',
      message: 'No se encontraron múltiples acciones claras.'
    });
  });

  it('uses legacy inventory repositories only when no home scope is configured', async () => {
    const deviceRepo = createMockDeviceRepository();
    const roomRepo = createMockRoomRepository();
    const devices = [createTestDevice({ id: 'd1', name: 'Luz Sala' })];
    const rooms = [createTestRoom({ id: 'r1', name: 'Sala' })];
    deviceRepo.findAll.mockResolvedValue(devices);
    roomRepo.findAll.mockResolvedValue(rooms);
    const parser = new AssistantMultiCommandParser(deviceRepo, roomRepo) as unknown as {
      getAuthorizedDevices(userId?: string): Promise<unknown[]>;
      getAuthorizedRooms(userId?: string): Promise<unknown[]>;
    };

    await expect(parser.getAuthorizedDevices('user-1')).resolves.toEqual(devices);
    await expect(parser.getAuthorizedRooms('user-1')).resolves.toEqual(rooms);
  });
  it('fails safely when an exclusion cannot be resolved instead of broadening the requested action', async () => {
    const deviceRepo = createMockDeviceRepository();
    const roomRepo = createMockRoomRepository();
    deviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light' })]);
    roomRepo.findAll.mockResolvedValue([]);

    const result = await new AssistantMultiCommandParser(deviceRepo, roomRepo).parse('apaga todo menos dispositivo inexistente', 'u1');

    expect(result).toEqual(expect.objectContaining({ type: 'failure', message: expect.stringContaining('dispositivo inexistente') }));
  });

  it('fails without actions when the requested category has no controllable device', async () => {
    const deviceRepo = createMockDeviceRepository();
    const roomRepo = createMockRoomRepository();
    deviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'd1', name: 'Luz Sala', type: 'light' })]);
    roomRepo.findAll.mockResolvedValue([]);

    const result = await new AssistantMultiCommandParser(deviceRepo, roomRepo).parse('apaga ventiladores menos sala', 'u1');

    expect(result).toEqual(expect.objectContaining({ type: 'failure', message: expect.stringContaining('ventiladores') }));
  });
});
describe('AssistantMultiCommandParser - direct target resolution contracts', () => {
  it('distinguishes an exact target and ambiguous candidates without broadening a command', async () => {
    const devices = [
      createTestDevice({ id: 'desk', name: 'Luz Escritorio', type: 'light' }),
      createTestDevice({ id: 'hall-a', name: 'Luz Pasillo A', type: 'light' }),
      createTestDevice({ id: 'hall-b', name: 'Luz Pasillo B', type: 'light' }),
    ];
    const parser = new AssistantMultiCommandParser(
      createMockDeviceRepository(),
      createMockRoomRepository(),
    ) as unknown as {
      resolveTargets(segment: string, devices: ReadonlyArray<ReturnType<typeof createTestDevice>>, rooms: ReturnType<typeof createTestRoom>[]): Promise<unknown>;
    };

    await expect(parser.resolveTargets('luz escritorio', devices, [])).resolves.toEqual(
      expect.objectContaining({ type: 'match', devices: [expect.objectContaining({ id: 'desk' })] }),
    );
    await expect(parser.resolveTargets('luz pasillo', devices, [])).resolves.toEqual(
      expect.objectContaining({
        type: 'clarificationRequired',
        options: expect.arrayContaining([expect.objectContaining({ id: 'hall-a' }), expect.objectContaining({ id: 'hall-b' })]),
      }),
    );
    await expect(parser.resolveTargets('luz garaje', devices, [])).resolves.toEqual(
      expect.objectContaining({
        type: 'clarificationRequired',
        originalSegment: 'luz garaje',
        options: expect.arrayContaining([expect.objectContaining({ id: 'desk' })]),
      }),
    );
  });

  it('returns a stable failure when no device token can be resolved at all', async () => {
    const parser = new AssistantMultiCommandParser(
      createMockDeviceRepository(),
      createMockRoomRepository(),
    ) as unknown as {
      resolveTargets(segment: string, devices: ReturnType<typeof createTestDevice>[], rooms: ReturnType<typeof createTestRoom>[]): Promise<unknown>;
    };

    await expect(parser.resolveTargets('garaje inexistente', [], [])).resolves.toEqual(
      expect.objectContaining({ type: 'failure', message: expect.stringContaining('garaje inexistente') }),
    );
  });
  it('rejects room references that have no devices instead of silently applying an action', async () => {
    const parser = new AssistantMultiCommandParser(
      createMockDeviceRepository(),
      createMockRoomRepository(),
    ) as unknown as {
      resolveTargets(segment: string, devices: ReturnType<typeof createTestDevice>[], rooms: ReturnType<typeof createTestRoom>[]): Promise<unknown>;
    };

    await expect(parser.resolveTargets('apaga oficina', [], [createTestRoom({ id: 'office', name: 'Oficina' })])).resolves.toEqual(
      expect.objectContaining({ type: 'failure', message: expect.stringContaining('Oficina') }),
    );
  });
});