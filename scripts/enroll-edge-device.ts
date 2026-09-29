import 'dotenv/config';
import { buildDatabase } from '../infrastructure/assemblers/buildDatabase';
import { getDatabasePath } from '../packages/shared/config/getDatabasePath';
import { EdgeDeviceIdentityService } from '../packages/cloud-gateway/application/EdgeDeviceIdentityService';
import { SqliteDeviceBindingRepository } from '../packages/cloud-gateway/infrastructure/SqliteDeviceBindingRepository';
import { createDeviceIdentityProvider } from '../packages/cloud-gateway/infrastructure/createDeviceIdentityProvider';
import { readCloudEdgeConfig } from '../packages/cloud-gateway/infrastructure/CloudEdgeConfigProvider';

/** Explicit provisioning command; never part of the API startup path. */
async function enroll(): Promise<void> {
  const { db, dbPath } = buildDatabase({ rawDbPath: getDatabasePath(), verbose: false });
  const service = new EdgeDeviceIdentityService(new SqliteDeviceBindingRepository(db),
    createDeviceIdentityProvider(dbPath), readCloudEdgeConfig);
  const binding = await service.enroll();
  console.log(`Edge device identity bound: ${binding.edgeId} (${binding.keyId}).`);
}

void enroll().catch((error: unknown) => {
  const code = error instanceof Error && [
    'DEVICE_ALREADY_BOUND', 'EDGE_NOT_PAIRED', 'DEVICE_ENROLLMENT_UNAVAILABLE',
    'DEVICE_ENROLLMENT_REJECTED', 'DEVICE_ENROLLMENT_RESPONSE_INVALID', 'DEVICE_IDENTITY_INVALID',
  ].includes(error.message) ? error.message : 'DEVICE_ENROLLMENT_FAILED';
  console.error(code);
  process.exitCode = 1;
});
