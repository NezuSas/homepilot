/**
 * buildAuthModule.ts
 *
 * Assembler: Construcción de los servicios de Auth, Sesión, Setup del sistema y control de acceso.
 * Gestiona el provisionamiento inicial seguro de la cuenta admin (DEV vs PROD).
 */
import { SqliteUserRepository } from '../../packages/auth/infrastructure/SqliteUserRepository';
import { SqliteSessionRepository } from '../../packages/auth/infrastructure/SqliteSessionRepository';
import { CryptoService } from '../../packages/auth/infrastructure/CryptoService';
import { AuthService } from '../../packages/auth/application/AuthService';
import { AuthGuard } from '../../packages/auth/infrastructure/AuthGuard';
import { SqliteSystemSetupRepository } from '../../packages/system-setup/infrastructure/SqliteSystemSetupRepository';
import { SystemSetupService } from '../../packages/system-setup/application/SystemSetupService';
import { UserManagementService } from '../../packages/auth/application/UserManagementService';

import type { SqliteDatabaseManager } from '../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import type { SQLiteHomeRepository } from '../../packages/topology/infrastructure/repositories/SQLiteHomeRepository';
import type { SQLiteSettingsRepository } from '../../packages/integrations/home-assistant/infrastructure/SQLiteSettingsRepository';
import type { HomeAssistantSettingsService } from '../../packages/integrations/home-assistant/application/HomeAssistantSettingsService';
import type { SQLiteActivityLogRepository } from '../../packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';

export interface AuthModuleAssembly {
  userRepository: SqliteUserRepository;
  sessionRepository: SqliteSessionRepository;
  systemSetupRepository: SqliteSystemSetupRepository;
  authService: AuthService;
  authGuard: AuthGuard;
  systemSetupService: SystemSetupService;
  userManagementService: UserManagementService;
}

export interface AuthModuleDeps {
  db: ReturnType<typeof SqliteDatabaseManager.getInstance>;
  dbPath: string;
  homeRepository: SQLiteHomeRepository;
  settingsRepository: SQLiteSettingsRepository;
  settingsService: HomeAssistantSettingsService;
  activityLogRepository: SQLiteActivityLogRepository;
}

export async function buildAuthModule(deps: AuthModuleDeps): Promise<AuthModuleAssembly> {
  const { db, dbPath, homeRepository, settingsRepository, settingsService, activityLogRepository } = deps;

  // -- INIT AUTH V1 --
  const userRepository = new SqliteUserRepository(db);
  const sessionRepository = new SqliteSessionRepository(db);
  const cryptoService = new CryptoService();
  const authService = new AuthService(userRepository, sessionRepository, cryptoService);
  const authGuard = new AuthGuard(authService);

  if (process.env.NODE_ENV === 'test') {
    authGuard.setRoleChecker(() => true);
  }

  const isDevBootstrap = process.env.HOMEPILOT_DEV_BOOTSTRAP === 'true';

  if (isDevBootstrap) {
    console.warn('[Bootstrap] ⚠️  [DEV BOOTSTRAP ENABLED] admin/admin will be used — NOT safe for production.');
  } else {
    console.log('[Bootstrap] [PRODUCTION BOOTSTRAP] Secure random password will be generated if DB is empty.');
  }

  const adminHook = await authService.getBootstrapAdmin(isDevBootstrap);

  if (adminHook) {
    if (adminHook.generatedPlaintext) {
      console.log('\n===============================================================');
      console.log(' [SECURITY] FIRST BOOT: DEFAULT SYSTEM ADMINISTRATOR GENERATED');
      console.log(` -> Username: ${adminHook.admin.username}`);
      console.log(` -> Password: ${adminHook.generatedPlaintext}`);
      console.log(' => PLEASE COPY AND SAFEGUARD THIS PASSWORD.');
      console.log(' => IT WILL NEVER BE DISPLAYED AGAIN.');
      console.log('===============================================================\n');
    } else {
      console.log(`[Auth] Bootstrap: Admin user created with development credentials (admin/admin).`);
    }
  }

  // -- INIT SYSTEM SETUP V1 --
  const systemSetupRepository = new SqliteSystemSetupRepository(dbPath);
  const systemSetupService = new SystemSetupService(
    systemSetupRepository,
    userRepository,
    homeRepository,
    settingsRepository,
    settingsService,
    activityLogRepository
  );

  // -- INIT USER MANAGEMENT V2 --
  const userManagementService = new UserManagementService(
    userRepository,
    sessionRepository,
    activityLogRepository,
    cryptoService
  );

  return {
    userRepository,
    sessionRepository,
    systemSetupRepository,
    authService,
    authGuard,
    systemSetupService,
    userManagementService
  };
}
