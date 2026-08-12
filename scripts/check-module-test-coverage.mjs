import { existsSync } from 'node:fs';

const maintainedModules = [
  ['assistant', 'packages/assistant/__tests__/assistant_conversation_service.test.ts'],
  ['auth', 'packages/auth/application/AuthService.bootstrapFirstAdmin.test.ts'],
  ['automation', 'packages/devices/__tests__/automation/automation_engine.test.ts'],
  ['devices', 'packages/devices/__tests__/command_api.test.ts'],
  ['integrations', 'packages/integrations/home-assistant/__tests__/HomeAssistantWebSocketClient.test.ts'],
  ['shared', 'packages/shared/infrastructure/database/__tests__/SqliteDatabaseManager.test.ts'],
  ['system-observability', 'packages/system-observability/__tests__/DiagnosticsService.test.ts'],
  ['system-setup', 'packages/system-setup/__tests__/SystemSetupService.test.ts'],
  ['system-vars', 'packages/system-vars/__tests__/SystemVariableService.test.ts'],
  ['topology', 'packages/topology/__tests__/e2e.test.ts'],
];

const missing = maintainedModules.filter(([, suite]) => !existsSync(suite));

if (missing.length > 0) {
  console.error('Module test coverage check failed:');
  missing.forEach(([moduleName, suite]) => console.error(`- ${moduleName}: missing behavioral suite ${suite}`));
  process.exit(1);
}

console.log(`Module test coverage passed for ${maintainedModules.length} maintained modules.`);