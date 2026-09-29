import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrap } from '../../../bootstrap';
import { buildDatabase } from '../../../infrastructure/assemblers/buildDatabase';
import { SqliteDatabaseManager } from '../../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteDeviceBindingRepository } from '../../../packages/cloud-gateway/infrastructure/SqliteDeviceBindingRepository';
import { SoftwareDeviceIdentityProvider } from '../../../packages/cloud-gateway/infrastructure/SoftwareDeviceIdentityProvider';

describe('bound MiniPC startup', () => {
  it('rejects a copied installation before constructing normal application services', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'homepilot-clone-test-'));
    const dbPath = join(directory, 'homepilot.db');
    const envNames = ['HOMEPILOT_CLOUD_GATEWAY_URL', 'HOMEPILOT_CLOUD_EDGE_TOKEN',
      'HOMEPILOT_CLOUD_HOME_ID', 'HOMEPILOT_CLOUD_EDGE_ID'] as const;
    const previous = envNames.map(name => process.env[name]);
    try {
      const { db } = buildDatabase({ rawDbPath: dbPath });
      const original = new SoftwareDeviceIdentityProvider();
      await original.ensureIdentity();
      new SqliteDeviceBindingRepository(db).bind({ bindingState: 'bound', homeId: 'home-clone', edgeId: 'edge-clone',
        keyId: await original.getKeyId(), publicKey: await original.getPublicKey(), algorithm: 'ES256',
        boundAt: '2026-09-29T00:00:00.000Z' });
      [process.env.HOMEPILOT_CLOUD_GATEWAY_URL, process.env.HOMEPILOT_CLOUD_EDGE_TOKEN,
        process.env.HOMEPILOT_CLOUD_HOME_ID, process.env.HOMEPILOT_CLOUD_EDGE_ID] =
        ['wss://accounts.example.test/gateway/edge', 'copied-edge-credential', 'home-clone', 'edge-clone'];
      await expect(bootstrap({ dbPath, deviceIdentityProvider: new SoftwareDeviceIdentityProvider() }))
        .rejects.toMatchObject({ code: 'DEVICE_IDENTITY_INVALID' });
    } finally {
      envNames.forEach((name, index) => {
        if (previous[index] === undefined) delete process.env[name];
        else process.env[name] = previous[index];
      });
      SqliteDatabaseManager.close(dbPath);
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
