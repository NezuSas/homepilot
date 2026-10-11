import { UserManagementService } from './UserManagementService';
import type {
  UserManagementCryptoService,
  UserManagementSessionRepository,
  UserManagementUserRepository,
} from './ports/UserManagementPorts';
import type { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';

function createService() {
  const seedInitialAdmin = jest.fn().mockResolvedValue(undefined);
  const findByUsername = jest.fn().mockResolvedValue(null);
  const saveActivity = jest.fn().mockResolvedValue(undefined);
  const service = new UserManagementService(
    { seedInitialAdmin, findByUsername } as unknown as UserManagementUserRepository,
    {} as unknown as UserManagementSessionRepository,
    { saveActivity } as unknown as ActivityLogRepository,
    { hashPassword: jest.fn().mockResolvedValue('hash'), generateId: jest.fn().mockReturnValue('user-9') } as unknown as UserManagementCryptoService,
  );
  return { service, seedInitialAdmin, findByUsername };
}

describe('Feature: creating a household user', () => {
  it('Scenario: Given a valid name, password and role When the admin creates the user Then it is stored and audited', async () => {
    const { service, seedInitialAdmin } = createService();

    const created = await service.createUser('admin-1', { username: ' Ana Pérez ', passwordPlain: 'longenough1', role: 'child' });

    expect(created).toMatchObject({ id: 'user-9', username: 'Ana Pérez', role: 'child', isActive: true });
    expect(seedInitialAdmin).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an empty name', '   ', 'Username cannot be empty'],
    ['a name longer than 40 characters', 'x'.repeat(41), 'at most 40 characters'],
    ['a name with a slash', 'ana/../root', 'cannot contain slashes'],
    ['a name with a backslash', 'ana\\root', 'cannot contain slashes'],
    ['a name with a control character', 'ana\u0007', 'cannot contain slashes'],
  ])('Scenario: Given %s When the admin creates the user Then it is refused before touching storage', async (_name, username, reason) => {
    const { service, seedInitialAdmin, findByUsername } = createService();

    await expect(service.createUser('admin-1', { username, passwordPlain: 'longenough1', role: 'guest' })).rejects.toThrow(reason);

    expect(findByUsername).not.toHaveBeenCalled();
    expect(seedInitialAdmin).not.toHaveBeenCalled();
  });

  it('Scenario: Given a short password or an unknown role When the admin creates the user Then it is refused', async () => {
    const { service, seedInitialAdmin } = createService();

    await expect(service.createUser('admin-1', { username: 'ana', passwordPlain: 'short', role: 'guest' })).rejects.toThrow('at least 8');
    await expect(service.createUser('admin-1', { username: 'ana', passwordPlain: 'longenough1', role: 'owner' as never })).rejects.toThrow('INVALID_ROLE');
    expect(seedInitialAdmin).not.toHaveBeenCalled();
  });

  it('Scenario: Given a name already in use When the admin creates the user Then it reports the conflict', async () => {
    const { service, findByUsername, seedInitialAdmin } = createService();
    findByUsername.mockResolvedValue({ id: 'u1' });

    await expect(service.createUser('admin-1', { username: 'ana', passwordPlain: 'longenough1', role: 'guest' })).rejects.toThrow('USERNAME_TAKEN');
    expect(seedInitialAdmin).not.toHaveBeenCalled();
  });
});
