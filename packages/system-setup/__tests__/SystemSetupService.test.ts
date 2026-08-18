import { SystemSetupService } from '../application/SystemSetupService';
import type { SystemSetupRepository, SystemSetupState } from '../domain/SystemSetupState';
import type { SystemSetupUserRepository } from '../application/ports/SystemSetupUserRepository';
import type { HomeRepository } from '../../topology/domain/repositories/HomeRepository';
import type { SettingsRepository } from '../../integrations/home-assistant/domain/SettingsRepository';
import type { HomeAssistantSettingsService } from '../../integrations/home-assistant/application/HomeAssistantSettingsService';
import type { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';

const uninitializedState: SystemSetupState = {
  id: 'local-edge',
  isInitialized: false,
  initializedAt: null,
  setupVersion: 1,
  onboardingCompletedByUserId: null,
  createdAt: '2026-08-11T00:00:00.000Z',
  updatedAt: '2026-08-11T00:00:00.000Z',
};

function createService(options: { initialized?: boolean; profile?: 'bridge_ha' | 'native_only'; reachable?: boolean; authFailure?: boolean; missingSettings?: boolean } = {}) {
  const state: SystemSetupState = { ...uninitializedState, isInitialized: options.initialized ?? false };
  const setupRepository = {
    getSetupState: jest.fn().mockResolvedValue(state),
    markAsInitialized: jest.fn().mockResolvedValue({ ...state, isInitialized: true }),
  } as unknown as jest.Mocked<SystemSetupRepository>;
  const userRepository = { count: jest.fn().mockResolvedValue(1) } as jest.Mocked<SystemSetupUserRepository>;
  const homeRepository = { saveHome: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<HomeRepository>;
  const settingsRepository = {
    getSettings: jest.fn().mockResolvedValue(options.missingSettings ? null : { baseUrl: 'http://homeassistant.local', accessToken: 'secret' }),
  } as unknown as jest.Mocked<SettingsRepository>;
  const homeAssistantSettingsService = {
    getStatus: jest.fn().mockResolvedValue({
      activeSource: 'database', hasToken: true, connectivityStatus: options.reachable === false ? 'unreachable' : 'reachable',
    }),
    testConnection: jest.fn().mockResolvedValue({ success: options.reachable !== false && !options.authFailure, status: options.authFailure ? 'auth_error' : options.reachable === false ? 'unreachable' : 'reachable' }),
  } as unknown as jest.Mocked<HomeAssistantSettingsService>;
  const activityLogRepository = { saveActivity: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<ActivityLogRepository>;
  const service = new SystemSetupService(
    setupRepository,
    userRepository,
    homeRepository,
    settingsRepository,
    homeAssistantSettingsService,
    activityLogRepository,
    options.profile ?? 'bridge_ha',
    'docker_desktop',
    'http://host.docker.internal:18123',
    'http://localhost:18123',
  );
  return { service, setupRepository, homeRepository, homeAssistantSettingsService, activityLogRepository };
}

describe('Feature: first-run setup', () => {
  it('Scenario: Given a native-only installation When setup status is read Then onboarding does not require Home Assistant or expose bridge URLs', async () => {
    const { service, homeAssistantSettingsService } = createService({ profile: 'native_only' });

    await expect(service.getSetupStatus()).resolves.toMatchObject({
      requiresOnboarding: true,
      requiresHomeAssistant: false,
      homeAssistantBridgeUrl: null,
      homeAssistantSetupUrl: null,
    });
    expect(homeAssistantSettingsService.getStatus).not.toHaveBeenCalled();
  });

  it('Scenario: Given valid Home Assistant settings When onboarding completes Then it validates live connectivity, persists setup, creates the local home and audits completion', async () => {
    const { service, setupRepository, homeRepository, homeAssistantSettingsService, activityLogRepository } = createService();

    await service.completeOnboarding('admin-1');

    expect(homeAssistantSettingsService.testConnection).toHaveBeenCalledWith('http://homeassistant.local', 'secret');
    expect(setupRepository.markAsInitialized).toHaveBeenCalledWith('admin-1');
    expect(homeRepository.saveHome).toHaveBeenCalledWith(expect.objectContaining({ id: 'local-home', ownerId: 'admin-1' }));
    expect(activityLogRepository.saveActivity).toHaveBeenCalledTimes(3);
    expect(activityLogRepository.saveActivity).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'ONBOARDING_COMPLETED' }));
  });

  it('Scenario: Given missing Home Assistant settings When onboarding completes Then it rejects before changing setup state', async () => {
    const { service, setupRepository, homeRepository, homeAssistantSettingsService } = createService({ missingSettings: true });

    await expect(service.completeOnboarding('admin-1')).rejects.toThrow('NO_CONFIG');

    expect(homeAssistantSettingsService.testConnection).not.toHaveBeenCalled();
    expect(setupRepository.markAsInitialized).not.toHaveBeenCalled();
    expect(homeRepository.saveHome).not.toHaveBeenCalled();
  });

  it('Scenario: Given invalid Home Assistant credentials When onboarding completes Then it reports authentication failure without provisioning a home', async () => {
    const { service, setupRepository, homeRepository, homeAssistantSettingsService } = createService({ authFailure: true });

    await expect(service.completeOnboarding('admin-1')).rejects.toThrow('AUTH_ERROR');

    expect(homeAssistantSettingsService.testConnection).toHaveBeenCalled();
    expect(setupRepository.markAsInitialized).not.toHaveBeenCalled();
    expect(homeRepository.saveHome).not.toHaveBeenCalled();
  });
  it('Scenario: Given an initialized appliance When onboarding completion is retried Then it is idempotent and skips external validation', async () => {
    const { service, setupRepository, homeRepository, homeAssistantSettingsService, activityLogRepository } = createService({ initialized: true });

    await expect(service.completeOnboarding('admin-1')).resolves.toBeUndefined();

    expect(homeAssistantSettingsService.testConnection).not.toHaveBeenCalled();
    expect(setupRepository.markAsInitialized).not.toHaveBeenCalled();
    expect(homeRepository.saveHome).not.toHaveBeenCalled();
    expect(activityLogRepository.saveActivity).not.toHaveBeenCalled();
  });
});