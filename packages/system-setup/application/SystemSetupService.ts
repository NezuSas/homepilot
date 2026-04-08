import { SystemSetupRepository } from '../domain/SystemSetupState';
import { HomeAssistantSettingsService } from '../../integrations/home-assistant/application/HomeAssistantSettingsService';
import { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';
import { SqliteUserRepository } from '../../auth/infrastructure/SqliteUserRepository';
import { HomeRepository } from '../../topology/domain/repositories/HomeRepository';
import { Home } from '../../topology/domain/types';

import { SettingsRepository } from '../../integrations/home-assistant/domain/SettingsRepository';

export interface SetupStatusResponse {
  isInitialized: boolean;
  requiresOnboarding: boolean;
  hasAdminUser: boolean;
  hasHAConfig: boolean;
  haConnectionValid: boolean;
}

export class SystemSetupService {
  constructor(
    private readonly systemSetupRepository: SystemSetupRepository,
    private readonly userRepository: SqliteUserRepository,
    private readonly homeRepository: HomeRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly homeAssistantSettingsService: HomeAssistantSettingsService,
    private readonly activityLogRepository: ActivityLogRepository
  ) {}

  /**
   * Obtiene el estado actual del sistema calculando de forma combinada señales auxiliares.
   */
  public async getSetupStatus(): Promise<SetupStatusResponse> {
    const state = await this.systemSetupRepository.getSetupState();
    
    const adminCount = await this.userRepository.count();
    const hasAdminUser = adminCount > 0;

    const haStatus = await this.homeAssistantSettingsService.getStatus();

    return {
      isInitialized: state.isInitialized,
      requiresOnboarding: !state.isInitialized,
      hasAdminUser,
      hasHAConfig: haStatus.activeSource === 'database' && haStatus.hasToken,
      haConnectionValid: haStatus.connectivityStatus === 'reachable'
    };
  }

  /**
   * Cierra formalmente el Setup de Primera Configuración de la caja.
   * Lanza un Throw Error mapeable si las condiciones no aplican.
   */
  public async completeOnboarding(userId: string): Promise<void> {
    const currentState = await this.systemSetupRepository.getSetupState();
    
    // Regla de Idempotencia estricta.
    if (currentState.isInitialized) {
      return; 
    }

    await this.activityLogRepository.saveActivity({
      deviceId: 'system-setup',
      type: 'ONBOARDING_STARTED' as any,
      timestamp: new Date().toISOString(),
      description: 'System Onboarding Finalization Requested',
      data: { userId }
    });

    const haSettings = await this.settingsRepository.getSettings();

    // 1. Validar HA Configuration Presente
    if (!haSettings || !haSettings.baseUrl || !haSettings.accessToken) {
      throw new Error('NO_CONFIG');
    }

    // 2. Ejecutar validación viva (LIVE VALIDATION).
    const testResult = await this.homeAssistantSettingsService.testConnection(haSettings.baseUrl, haSettings.accessToken);

    await this.activityLogRepository.saveActivity({
      deviceId: 'system-setup',
      type: 'ONBOARDING_HA_TESTED' as any,
      timestamp: new Date().toISOString(),
      description: 'System Onboarding: Home Assistant connection tested',
      data: { userId, success: testResult.success, endpoint: haSettings.baseUrl, apiStatus: testResult.status }
    });

    if (!testResult.success) {
      if (testResult.status === 'auth_error') throw new Error('AUTH_ERROR');
      else throw new Error('UNREACHABLE');
    }

    // 3. Status is fully verified. Commit local rule to DB.
    await this.systemSetupRepository.markAsInitialized(userId);

    // 4. Create default Home for this edge appliance owned by the admin
    const defaultHome: Home = {
      id: 'local-home',
      ownerId: userId,
      name: 'Mi HomePilot',
      entityVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.homeRepository.saveHome(defaultHome);

    await this.activityLogRepository.saveActivity({
      deviceId: 'system-setup',
      type: 'ONBOARDING_COMPLETED' as any,
      timestamp: new Date().toISOString(),
      description: 'System Onboarding Completed Successfully',
      data: { completedByUserId: userId, result: 'success', homeId: 'local-home' }
    });
  }
}
