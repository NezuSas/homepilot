/**
 * verify_onboarding_v1.ts
 * 
 * Integration test covering First-Run Setup & Edge Onboarding V1 logic.
 * Ejecutar con: npx ts-node scripts/verify_onboarding_v1.ts
 */

import { SqliteDatabaseManager } from '../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteSystemSetupRepository } from '../packages/system-setup/infrastructure/SqliteSystemSetupRepository';
import { SystemSetupService } from '../packages/system-setup/application/SystemSetupService';
import { SqliteUserRepository } from '../packages/auth/infrastructure/SqliteUserRepository';
import { SQLiteActivityLogRepository } from '../packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import { HomeAssistantSettingsService } from '../packages/integrations/home-assistant/application/HomeAssistantSettingsService';
import { HomeAssistantConnectionProvider } from '../packages/integrations/home-assistant/application/HomeAssistantConnectionProvider';
import { SQLiteSettingsRepository } from '../packages/integrations/home-assistant/infrastructure/SQLiteSettingsRepository';
import { InMemoryHomeRepository } from '../packages/topology/infrastructure/repositories/InMemoryHomeRepository';

import { CryptoService } from '../packages/auth/infrastructure/CryptoService';

async function runTests() {
  console.log('=== Starting Verification: First-Run Setup & Onboarding V1 ===\n');

  // In-memory Database Setup
  const db = SqliteDatabaseManager.getInstance(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_setup (
        id TEXT PRIMARY KEY,
        is_initialized INTEGER NOT NULL DEFAULT 0,
        initialized_at TEXT,
        setup_version INTEGER NOT NULL DEFAULT 1,
        onboarding_completed_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    INSERT INTO system_setup (id, created_at, updated_at) VALUES ('local-edge', datetime('now'), datetime('now'));

    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ha_settings (
        id TEXT PRIMARY KEY,
        base_url TEXT NOT NULL,
        access_token TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS homes (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        entity_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        description TEXT NOT NULL,
        data TEXT,
        correlation_id TEXT
    );
  `);

  const systemSetupRepo = new SqliteSystemSetupRepository(':memory:');
  const userRepo = new SqliteUserRepository(db);
  const settingsRepo = new SQLiteSettingsRepository(':memory:');
  const activityLogRepo = new SQLiteActivityLogRepository(':memory:');

  const cryptoService = new CryptoService();
  const haProvider = new HomeAssistantConnectionProvider();
  
  // Create an overridable mocked HA service 
  class MockHASettingsService extends HomeAssistantSettingsService {
    public __mockIsConfigured = false;
    public __mockTestSuccess = false;

    public async getStatus(): Promise<any> {
      return {
        isConfigured: this.__mockIsConfigured,
        activeSource: this.__mockIsConfigured ? 'database' : 'none',
        hasToken: this.__mockIsConfigured,
        connectivityStatus: 'reachable'
      };
    }

    public async testConnection(baseUrl: string, token: string): Promise<any> {
      if (this.__mockTestSuccess) return { success: true, status: 'reachable' };
      return { success: false, status: 'unreachable', error: 'Mock Network Error' };
    }
  }

  const homeRepo = new InMemoryHomeRepository();
  const mockHaService = new MockHASettingsService(settingsRepo, haProvider, {});
  const setupService = new SystemSetupService(systemSetupRepo, userRepo, homeRepo, settingsRepo, mockHaService as any, activityLogRepo);

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      process.exit(1);
    }
    console.log(`✅ ${message}`);
  }

  // --- Test 1: Estado Original No Inicializado
  const status1 = await setupService.getSetupStatus();
  assert(status1.isInitialized === false, 'Initial state should be isInitialized=false');
  assert(status1.requiresOnboarding === true, 'Initial state should require onboarding');
  assert(status1.hasAdminUser === false, 'Initial state should have no admin');

  // --- Test 2: Inyectar Admin (Requisito pasivo)
  await userRepo.seedInitialAdmin({
    id: 'admin-1', username: 'admin', passwordHash: 'hash', role: 'admin', 
    isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  const status2 = await setupService.getSetupStatus();
  assert(status2.hasAdminUser === true, 'Setup status detects admin user correctly');

  // --- Test 3: Tratar de completar Onboarding SIN configuración presente
  try {
    await setupService.completeOnboarding('admin-1');
    assert(false, 'Should throw NO_CONFIG but it passed');
  } catch(e: any) {
    assert(e.message === 'NO_CONFIG', `Expected NO_CONFIG, got ${e.message}`);
  }

  // --- Test 4: Tratar de completar Onboarding CON config pero fallando test vivo
  await settingsRepo.saveSettings({ baseUrl: 'http://fake.local', accessToken: 'token123', updatedAt: new Date().toISOString() });
  mockHaService.__mockIsConfigured = true;
  mockHaService.__mockTestSuccess = false;

  try {
    await setupService.completeOnboarding('admin-1');
    assert(false, 'Should throw UNREACHABLE but it passed');
  } catch(e: any) {
    assert(e.message === 'UNREACHABLE', `Expected UNREACHABLE, got ${e.message}`);
  }

  // --- Test 5: Completar Onboarding Exitosamente
  mockHaService.__mockTestSuccess = true;
  await setupService.completeOnboarding('admin-1');
  
  const status3 = await setupService.getSetupStatus();
  assert(status3.isInitialized === true, 'State should jump to isInitialized=true');
  assert(status3.requiresOnboarding === false, 'Should no longer require onboarding');

  // --- Test 6: Idempotencia - Llamar otra vez no tira error aunque se dañe el Test
  mockHaService.__mockTestSuccess = false; // "HA crashed next day"
  try {
    await setupService.completeOnboarding('user-generic');
    assert(true, 'Idempotency held up. Calling completeOnboarding over an initialized edge returned silently.');
  } catch(e) {
    assert(false, `Idempotency broke. Expected silence, got error: ${e}`);
  }

  console.log('\n✅ All Onboarding Specs Passed Successfully!');
}

runTests().catch(console.error);
