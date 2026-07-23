import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const sourceRoots = ['apps/api', 'apps/operator-console/src', 'packages'];
const sourceExtensions = new Set(['.ts', '.tsx']);
const modularComponentDocs = [
  'AlertBanner', 'AssistantCard', 'Button', 'Card', 'DeviceTileBase', 'DeviceTileShell',
  'EmptyState', 'IconButton', 'Input', 'Textarea', 'Modal', 'PageFrame', 'SearchFilterBar',
  'SectionHeader', 'SegmentedControl', 'SearchableSelectField', 'SidebarItem', 'StatusPill',
  'ConfirmModal', 'CoverPositionControl', 'AudioInputPicker', 'InlineTabCreator', 'RangeInput',
  'LoadingState',
];

const rules = [
  ['installation-profiles-v1.md', /(?:getInstallationProfile|SystemSetupService|OnboardingView)/i],
  ['media-player-local-control-v1.md', /(?:MediaPlayer|MediaRoutes|MediaService)/i],
  ['native-camera-local-integration-v1.md', /(?:NativeCamera|OnvifDiscovery)/i],
  ['home-assistant-camera-streaming-v1.md', /(?:CameraRoutes|CameraMedia|CameraViewer|CameraDevice)/i],
  ['home-assistant-settings-connection-management-v1.md', /(?:home-assistant|HomeAssistant|SettingsRoutes|HomeAssistantDiscovery)/i],
  ['sonoff-local-integration-v1.md', /Sonoff/i],
  ['energy-management-v1.md', /(?:EnergyView|EnergySnapshot|useEnergyStore)/i],
  ['dashboard-layout-and-widgets-v1.md', /(?:Dashboard|Dashboards|views\/dashboards)/i],
  ['system-variables-v1.md', /(?:system-vars|SystemVariable)/i],
  ['first-run-setup-edge-onboarding-v1.md', /(?:system-setup|SystemRoutes|FirstAdminSetup|OnboardingView)/i],
  ['observability-diagnostics-v1.md', /(?:system-observability|Diagnostics|Execution|AuditLogs|Resilience)/i],
  ['assistant-v1.md', /(?:packages\/assistant|Assistant|HomeConversation|AudioInput|GlobalWake|wakeAcknowledgement)/i],
  ['scene-lifecycle-v1.md', /(?:SceneRoutes|SceneBuilder|SceneCard|ScenesView|ScenesGroup|ScenesHeader|SceneExecution|SceneRepository|\/Scene\.|scene_)/i],
  ['automation-rules-engine-v1.md', /(?:packages\/automation|Automation)/i],
  ['auth-rbac-v1-local-edge-security.md', /(?:packages\/auth|AuthRoutes|AdminRoutes|LoginView|UsersView|User[A-Z]|useSession|ChangePassword|ResetUserPassword)/i],
  ['home-room-management.md', /(?:packages\/topology|Topology|HomeController|RoomController|HomeClimate)/i],
  ['device-command-execution.md', /(?:packages\/devices|DeviceRoutes|Device[A-Z]|Inbox|Curtain|CoverPosition|ManagedDevice|DashDevice|device[A-Z])/i],
  ['edge-platform-foundations-v1.md', /(?:apps\/api\/(?:ApiGateway|RouteHandler|OperatorConsoleServer)|apps\/api\/routes\/ApiRoutes|packages\/shared)/i],
  ['operator-console-modular-components-v1.md', /(?:apps\/operator-console\/src\/(?:components\/ui|design-system)|apps\/operator-console\/src\/components\/(?:ConfirmModal|CoverPositionControl|AudioInputPicker|InlineTabCreator)|apps\/operator-console\/src\/(?:config|i18n|types|utils)\.ts)/i],
  ['operator-console-v1.md', /(?:apps\/operator-console)/i],
];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'dist' || entry.name === 'node_modules') return [];
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

const files = sourceRoots
  .flatMap((directory) => walk(join(root, directory)))
  .filter((file) => sourceExtensions.has(file.slice(file.lastIndexOf('.'))))
  .map((file) => relative(root, file).split(sep).join('/'))
  .sort();

const coverage = new Map();
const missing = [];
const missingComponentDocs = modularComponentDocs.filter(
  (component) => !existsSync(join(root, 'docs', 'components', `${component}.md`))
);

for (const file of files) {
  const spec = rules.find(([, pattern]) => pattern.test(file))?.[0];
  if (!spec || !existsSync(join(root, 'specs', spec))) {
    missing.push(file);
    continue;
  }
  coverage.set(spec, (coverage.get(spec) ?? 0) + 1);
}

if (missing.length > 0 || missingComponentDocs.length > 0) {
  console.error(`Spec coverage failed: ${missing.length} file(s) without a valid spec mapping.`);
  for (const file of missing) console.error(`- ${file}`);
  if (missingComponentDocs.length > 0) {
    console.error(`Missing modular component documentation: ${missingComponentDocs.join(', ')}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Spec coverage passed: ${files.length} TypeScript source file(s) mapped to ${coverage.size} specs; ${modularComponentDocs.length} modular components documented individually.`);
  for (const [spec, count] of [...coverage.entries()].sort()) console.log(`- ${spec}: ${count}`);
}
