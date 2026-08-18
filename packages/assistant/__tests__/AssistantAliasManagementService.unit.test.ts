import { AssistantAliasManagementService } from '../application/AssistantAliasManagementService';

describe('AssistantAliasManagementService', () => {
  const memory = {
    getAliases: jest.fn(),
    setAlias: jest.fn(),
    saveShortTermMemory: jest.fn(),
  };
  const deviceRepository = { findAll: jest.fn() };
  const roomRepository = { findAll: jest.fn() };
  const service = new AssistantAliasManagementService(memory as never, deviceRepository as never, roomRepository as never);

  beforeEach(() => {
    jest.clearAllMocks();
    memory.getAliases.mockResolvedValue({});
    deviceRepository.findAll.mockResolvedValue([]);
    roomRepository.findAll.mockResolvedValue([]);
  });

  it('recognizes supported alias-creation expressions without classifying ordinary questions as definitions', () => {
    expect(service.isAliasCreation('cuando diga oficina me refiero a cuarto')).toBe(true);
    expect(service.isAliasCreation('call lamp as desk light')).toBe(true);
    expect(service.isAliasCreation('el cuarto es oficina')).toBe(true);
    expect(service.isAliasCreation('qué es una luz')).toBe(false);
    expect(service.isAliasCreation('call me Alex')).toBe(false);
  });

  it('extracts meaning and deletion targets in Spanish and English', () => {
    expect(service.extractAliasMeaningQuery('qué significa mi oficina')).toBe('mi oficina');
    expect(service.extractAliasMeaningQuery('what does desk light refer to')).toBe('desk light');
    expect(service.extractAliasDeleteRequest('borra el alias mi oficina')).toBe('mi oficina');
    expect(service.extractAliasDeleteRequest('delete desk light alias')).toBe('desk light');
  });

  it('resolves the longest alias and reports equal-length matches as ambiguous', () => {
    const aliases = { oficina: 'room-1', 'mi oficina': 'room-2', sala: 'room-3', casa: 'room-4' };

    expect(service.findBestAliasMatch('apaga mi oficina', aliases)).toEqual({ alias: 'mi oficina', targetId: 'room-2', status: 'resolved' });
    expect(service.findBestAliasMatch('apaga sala casa', aliases)).toEqual({ alias: '', targetId: '', status: 'ambiguous', candidates: ['sala', 'casa'] });
    expect(service.findBestAliasMatch('apaga garaje', aliases)).toEqual({ alias: '', targetId: '', status: 'not_found' });
  });

  it('reports an understandable fallback when an English alias-creation request cannot be parsed', async () => {
    await expect(service.handleAliasCreation('create alias', 'user-1', 'en')).resolves.toEqual({
      type: 'answer',
      message: "I couldn't understand the alias you want to create.",
    });
  });
  it('prevents collisions and creates aliases for both rooms and devices', async () => {
    roomRepository.findAll.mockResolvedValue([{ id: 'room-1', name: 'Sala' }]);
    deviceRepository.findAll.mockResolvedValue([{ id: 'device-1', name: 'Lámpara escritorio' }]);

    await expect(service.tryCreateAlias('user-1', 'sala', 'Lámpara escritorio', 'es')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('Ya existe una estancia') }));
    await expect(service.tryCreateAlias('user-1', 'mi sala', 'Sala', 'en')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('refers to Sala') }));
    await expect(service.tryCreateAlias('user-1', 'escritorio', 'Lámpara escritorio', 'es')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('se refiere a Lámpara') }));
    expect(memory.setAlias).toHaveBeenCalledWith('user-1', 'mi sala', 'room-1');
    expect(memory.setAlias).toHaveBeenCalledWith('user-1', 'escritorio', 'device-1');
  });

  it('lists, explains, and schedules deletion confirmation for valid and invalid aliases', async () => {
    memory.getAliases.mockResolvedValue({ oficina: 'room-1', desk: 'missing-id' });
    roomRepository.findAll.mockResolvedValue([{ id: 'room-1', name: 'Oficina' }]);
    deviceRepository.findAll.mockResolvedValue([]);

    await expect(service.handleAliasList('user-1', 'es')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('oficina → Oficina') }));
    await expect(service.handleAliasMeaning('user-1', 'oficina', 'en')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('refers to Oficina') }));
    await expect(service.handleAliasMeaning('user-1', 'inexistente', 'es')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('No encontré') }));

    const confirmation = await service.handleAliasDeleteRequest('user-1', 'oficina', 'es', null);
    expect(confirmation.type).toBe('clarification');
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith('user-1', expect.objectContaining({ pendingAliasDelete: expect.objectContaining({ alias: 'oficina', targetName: 'Oficina' }) }));
  });

  it('keeps ambiguous delete requests and missing alias targets non-destructive', async () => {
    memory.getAliases.mockResolvedValue({ sala: 'room-1', casa: 'room-2' });
    await expect(service.handleAliasDeleteRequest('user-1', 'sala casa', 'en', null)).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('multiple possible aliases') }));
    memory.getAliases.mockResolvedValue({});
    await expect(service.handleAliasDeleteRequest('user-1', 'garage', 'en', null)).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining("didn't find") }));
    expect(memory.saveShortTermMemory).not.toHaveBeenCalled();
  });
  it('creates aliases from all supported Spanish and English grammar variants', async () => {
    roomRepository.findAll.mockResolvedValue([{ id: 'room-1', name: 'Office' }]);

    await expect(service.handleAliasCreation('when i say work i mean Office', 'user-1', 'en')).resolves.toEqual(
      expect.objectContaining({ message: "Perfect, now 'work' refers to Office." })
    );
    await expect(service.handleAliasCreation('llama despacho a Office', 'user-1', 'es')).resolves.toEqual(
      expect.objectContaining({ message: expect.stringContaining("'despacho' se refiere a Office") })
    );
    await expect(service.handleAliasCreation('oficina es Office', 'user-1', 'es')).resolves.toEqual(
      expect.objectContaining({ message: expect.stringContaining("'oficina' se refiere a Office") })
    );
    await expect(service.handleAliasCreation('call Office workspace', 'user-1', 'en')).resolves.toEqual(
      expect.objectContaining({ message: "Perfect, now 'workspace' refers to Office." })
    );
  });

  it('keeps ambiguous meanings and unknown targets explicit for both languages', async () => {
    memory.getAliases.mockResolvedValue({ sala: 'room-1', casa: 'room-2', legacy: 'missing' });

    await expect(service.handleAliasMeaning('user-1', 'sala casa', 'es')).resolves.toEqual(
      expect.objectContaining({ message: expect.stringContaining('Encontré varios aliases') })
    );
    await expect(service.handleAliasMeaning('user-1', 'legacy', 'es')).resolves.toEqual(
      expect.objectContaining({ message: expect.stringContaining('objetivo no encontrado') })
    );
  });
  it('keeps empty, unresolved, and removed alias targets explicit without mutating unrelated aliases', async () => {
    await expect(service.handleAliasList('user-1', 'en')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining("haven't created") }));
    await expect(service.tryCreateAlias('user-1', 'garage', 'missing target', 'en')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining("couldn't find") }));

    memory.getAliases.mockResolvedValue({ legacy: 'removed-device' });
    const meaning = await service.handleAliasMeaning('user-1', 'legacy', 'en');
    expect(meaning.message).toContain('target not found');

    const deletion = await service.handleAliasDeleteRequest('user-1', 'legacy', 'en', {
      lastQueryType: 'alias', entities: [], timestamp: '2026-08-17T00:00:00.000Z',
    });
    expect(deletion).toEqual(expect.objectContaining({ type: 'clarification', message: expect.stringContaining('Unknown') }));
    expect(memory.saveShortTermMemory).toHaveBeenCalledWith('user-1', expect.objectContaining({
      pendingAliasDelete: expect.objectContaining({ alias: 'legacy', targetName: 'Unknown' }),
    }));
  });
});