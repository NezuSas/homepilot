import {
  createHome,
  createRoom,
  InvalidHomeNameError,
  InvalidUserIdError,
  InvalidRoomNameError,
  InvalidHomeIdError,
  renameRoom
} from '../domain';

const mockDeps = {
  idGenerator: { generate: () => 'mocked-id' },
  clock: { now: () => '2026-03-28T00:00:00Z' }
};

describe('Topology Domain Layer', () => {
  describe('createHome', () => {
    it('debe crear un Home inmutable válido', () => {
      const home = createHome('Mi Casa', 'user-123', mockDeps);
      expect(home.id).toBe('mocked-id');
      expect(home.name).toBe('Mi Casa');
      expect(home.ownerId).toBe('user-123');
      expect(home.entityVersion).toBe(1);
    });

    it('debe fallar la pureza si el nombre es vacío', () => {
      expect(() => createHome('', 'user-1', mockDeps)).toThrow(InvalidHomeNameError);
    });

    it('debe abortar instanciación si el userId es vacío', () => {
      expect(() => createHome('Casa', '', mockDeps)).toThrow(InvalidUserIdError);
    });
  });

  describe('createRoom', () => {
    it('debe crear un Room asignado lógicamente válido', () => {
      const room = createRoom('Dormitorio Principal', 'home-abc', mockDeps);
      expect(room.id).toBe('mocked-id');
      expect(room.homeId).toBe('home-abc');
      expect(room.name).toBe('Dormitorio Principal');
    });

    it('debe rebotar en pre-vuelo ante nombre vacío de Room', () => {
      expect(() => createRoom('', 'h1', mockDeps)).toThrow(InvalidRoomNameError);
    });

    it('debe colapsar obligatoriamente sin homeId asignado', () => {
      expect(() => createRoom('Sala', '', mockDeps)).toThrow(InvalidHomeIdError);
    });
  });
  describe('renameRoom', () => {
    it('normalizes the name, advances the version, and preserves the original room', () => {
      const original = createRoom('Sala', 'home-abc', mockDeps);
      const renamed = renameRoom(original, '  Sala principal  ', mockDeps.clock);

      expect(renamed).toEqual(expect.objectContaining({ name: 'Sala principal', entityVersion: 2, updatedAt: mockDeps.clock.now() }));
      expect(original.name).toBe('Sala');
      expect(Object.isFrozen(renamed)).toBe(true);
    });

    it('rejects a whitespace-only room name', () => {
      const room = createRoom('Sala', 'home-abc', mockDeps);
      expect(() => renameRoom(room, '   ', mockDeps.clock)).toThrow(InvalidRoomNameError);
    });
  });
});
