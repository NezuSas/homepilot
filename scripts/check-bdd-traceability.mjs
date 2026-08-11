import { existsSync, readFileSync } from 'node:fs';

const traceabilityFile = 'docs/quality/sdd-tdd-bdd-traceability.md';
const criticalSuites = [
  'apps/api/__tests__/AuthRoutes.security.test.ts',
  'apps/api/__tests__/AdminRoutes.test.ts',
  'packages/devices/__tests__/command_api.test.ts',
  'apps/api/__tests__/DeviceRoutes.state-sync.test.ts',
  'packages/integrations/home-assistant/__tests__/HomeAssistantWebSocketClient.test.ts',
  'packages/devices/__tests__/HomeAssistantImportService.test.ts',
  'packages/devices/__tests__/automation/automation_engine.test.ts',
  'packages/integrations/sonoff/__tests__/SonoffDeviceDriver.test.ts',
  'packages/devices/__tests__/CommandCapabilityValidator.test.ts',
  'packages/devices/__tests__/SceneExecutionService.test.ts',
  'packages/assistant/__tests__/assistant_execution.test.ts',
  'apps/operator-console/src/lib/__tests__/assistantApi.test.ts',
  'apps/operator-console/src/config/__tests__/appDemoSteps.test.ts',
  'apps/operator-console/src/views/dashboards/widgets/__tests__/sectionCardCatalog.test.ts',
];

const failures = [];
if (!existsSync(traceabilityFile)) failures.push(`Missing ${traceabilityFile}`);

for (const suite of criticalSuites) {
  if (!existsSync(suite)) {
    failures.push(`Missing BDD suite ${suite}`);
    continue;
  }

  const suiteContent = readFileSync(suite, 'utf8');
  if (!/describe\(['"]Feature: /u.test(suiteContent)) {
    failures.push(`BDD feature declaration missing in ${suite}`);
  }
  if (!/it\(['"]Scenario: Given .+ When .+ Then /u.test(suiteContent)) {
    failures.push(`BDD Given/When/Then scenario missing in ${suite}`);
  }
}

if (failures.length > 0) {
  console.error('BDD traceability check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`BDD traceability passed for ${criticalSuites.length} critical flows.`);