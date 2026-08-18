import { SQLiteTopologyReferenceAdapter } from '../infrastructure/adapters/SQLiteTopologyReferenceAdapter';

describe('SQLiteTopologyReferenceAdapter', () => {
  function createAdapter(home: { id: string } | null, room: { homeId: string } | null) {
    const homeRepository = { findHomeById: jest.fn().mockResolvedValue(home) };
    const roomRepository = { findRoomById: jest.fn().mockResolvedValue(room) };
    return { adapter: new SQLiteTopologyReferenceAdapter(homeRepository as never, roomRepository as never), homeRepository, roomRepository };
  }

  it('accepts an existing home for existence and ownership validation', async () => {
    const { adapter, homeRepository } = createAdapter({ id: 'home-1' }, null);
    await expect(adapter.validateHomeExists('home-1')).resolves.toBeUndefined();
    await expect(adapter.validateHomeOwnership('home-1', 'user-1')).resolves.toBeUndefined();
    expect(homeRepository.findHomeById).toHaveBeenCalledWith('home-1');
  });

  it('rejects missing homes consistently', async () => {
    const { adapter } = createAdapter(null, null);
    await expect(adapter.validateHomeExists('missing')).rejects.toThrow('HOME_NOT_FOUND');
    await expect(adapter.validateHomeOwnership('missing', 'user-1')).rejects.toThrow('HOME_NOT_FOUND');
  });

  it('accepts rooms from the expected home and rejects missing or foreign rooms', async () => {
    await expect(createAdapter({ id: 'home-1' }, { homeId: 'home-1' }).adapter.validateRoomBelongsToHome('room-1', 'home-1')).resolves.toBeUndefined();
    await expect(createAdapter({ id: 'home-1' }, null).adapter.validateRoomBelongsToHome('missing', 'home-1')).rejects.toThrow('ROOM_NOT_FOUND');
    await expect(createAdapter({ id: 'home-1' }, { homeId: 'other' }).adapter.validateRoomBelongsToHome('room-1', 'home-1')).rejects.toThrow('ROOM_HOME_MISMATCH');
  });
});