/**
 * buildCloudGatewayModule.ts
 *
 * Assembler: identidad Edge, catálogo de manifiestos y servicios del cloud gateway.
 * Se expone en tres pasos para conservar el orden de construcción del composition root.
 */
import { DeviceControlCatalogProvider } from '../../packages/cloud-gateway/application/DeviceControlCatalogProvider';
import { EffectiveActionsProvider } from '../../packages/cloud-gateway/application/EffectiveActionsProvider';
import { InstallationVerificationBroker } from '../../packages/cloud-gateway/application/InstallationVerificationBroker';
import { ManifestSyncService } from '../../packages/cloud-gateway/application/ManifestSyncService';
import { CommandTokenCache } from '../../packages/cloud-gateway/application/CommandTokenCache';
import { IntentFlowCommandExecutionService } from '../../packages/cloud-gateway/application/IntentFlowCommandExecutionService';
import { EdgeDeviceIdentityService } from '../../packages/cloud-gateway/application/EdgeDeviceIdentityService';
import { DeviceIdentityError, type DeviceIdentityProvider } from '../../packages/cloud-gateway/application/DeviceIdentityProvider';
import { DirectoryEdgeServiceTokenClient } from '../../packages/cloud-gateway/infrastructure/DirectoryEdgeServiceTokenClient';
import { IntentFlowManifestClient } from '../../packages/cloud-gateway/infrastructure/IntentFlowManifestClient';
import { IntentFlowCommandClient } from '../../packages/cloud-gateway/infrastructure/IntentFlowCommandClient';
import { SqliteManifestCacheRepository } from '../../packages/cloud-gateway/infrastructure/SqliteManifestCacheRepository';
import { readCloudEdgeConfig } from '../../packages/cloud-gateway/infrastructure/CloudEdgeConfigProvider';
import { SqliteDeviceBindingRepository } from '../../packages/cloud-gateway/infrastructure/SqliteDeviceBindingRepository';
import { createDeviceIdentityProvider } from '../../packages/cloud-gateway/infrastructure/createDeviceIdentityProvider';
import type { SqliteDatabaseManager } from '../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import type { SQLiteDeviceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteDeviceRepository';

export interface EdgeIdentityAssembly {
  deviceBindingRepository: SqliteDeviceBindingRepository;
  edgeDeviceIdentityService: EdgeDeviceIdentityService;
}

export interface EdgeIdentityDeps {
  db: ReturnType<typeof SqliteDatabaseManager.getInstance>;
  dbPath: string;
  deviceIdentityProvider?: DeviceIdentityProvider;
}

/** Verifica la identidad del dispositivo al arrancar; lanza DeviceIdentityError si no está lista. */
export async function buildEdgeIdentity(deps: EdgeIdentityDeps): Promise<EdgeIdentityAssembly> {
  const deviceBindingRepository = new SqliteDeviceBindingRepository(deps.db);
  const edgeDeviceIdentityService = new EdgeDeviceIdentityService(
    deviceBindingRepository, deps.deviceIdentityProvider ?? createDeviceIdentityProvider(deps.dbPath), readCloudEdgeConfig,
  );
  if ((await edgeDeviceIdentityService.verifyAtStartup()).status !== 'READY') throw new DeviceIdentityError();
  return { deviceBindingRepository, edgeDeviceIdentityService };
}

export interface ManifestCatalogAssembly {
  manifestCacheRepository: SqliteManifestCacheRepository;
  deviceControlCatalogProvider: DeviceControlCatalogProvider;
}

export function buildManifestCatalog(
  dbPath: string,
  deviceRepository: SQLiteDeviceRepository
): ManifestCatalogAssembly {
  const manifestCacheRepository = new SqliteManifestCacheRepository(dbPath);
  const deviceControlCatalogProvider = new DeviceControlCatalogProvider({
    cache: manifestCacheRepository,
    devices: deviceRepository,
  });
  return { manifestCacheRepository, deviceControlCatalogProvider };
}

export interface CloudGatewayServicesAssembly {
  manifestSyncService: ManifestSyncService;
  intentFlowCommandExecutionService: IntentFlowCommandExecutionService;
  installationVerificationBroker: InstallationVerificationBroker;
  effectiveActionsProvider: EffectiveActionsProvider;
}

export interface CloudGatewayServicesDeps {
  manifestCacheRepository: SqliteManifestCacheRepository;
  deviceRepository: SQLiteDeviceRepository;
  edgeDeviceIdentityService: EdgeDeviceIdentityService;
}

export function buildCloudGatewayServices(deps: CloudGatewayServicesDeps): CloudGatewayServicesAssembly {
  const directoryTokenClient = new DirectoryEdgeServiceTokenClient(readCloudEdgeConfig, fetch, deps.edgeDeviceIdentityService);
  const manifestSyncService = new ManifestSyncService({
    directory: directoryTokenClient,
    intentFlow: new IntentFlowManifestClient(),
    cache: deps.manifestCacheRepository,
  });
  const intentFlowCommandExecutionService = new IntentFlowCommandExecutionService({
    tokens: new CommandTokenCache(directoryTokenClient), client: new IntentFlowCommandClient(),
  });
  return {
    manifestSyncService,
    intentFlowCommandExecutionService,
    installationVerificationBroker: new InstallationVerificationBroker(readCloudEdgeConfig),
    effectiveActionsProvider: new EffectiveActionsProvider({
      cache: deps.manifestCacheRepository,
      devices: deps.deviceRepository,
    }),
  };
}
