import * as crypto from 'crypto';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { HomeRepository } from '../../topology/domain/repositories/HomeRepository';
import { HomeAssistantConnectionProvider } from '../../integrations/home-assistant/application/HomeAssistantConnectionProvider';

export interface HomeAssistantImportServiceDependencies {
  deviceRepository: DeviceRepository;
  homeRepository: HomeRepository;
  haConnectionProvider: HomeAssistantConnectionProvider;
}

export class HomeAssistantImportService {
  constructor(private readonly deps: HomeAssistantImportServiceDependencies) {}

  public async importDevice(entityId: string, userId: string, name?: string): Promise<any> {
    const userHomes = await this.deps.homeRepository.findHomesByUserId(userId);
    const homeId = userHomes[0]?.id;

    if (!homeId) {
      throw new Error('HOME_NOT_FOUND');
    }

    const externalId = `ha:${entityId}`;
    
    // Check for duplicates
    const existing = await this.deps.deviceRepository.findByExternalIdAndHomeId(externalId, homeId);
    if (existing) throw new Error('DEVICE_ALREADY_EXISTS');

    // Fetch details from HA
    const client = this.deps.haConnectionProvider.getClient();
    const haState = await client.getEntityState(entityId);
    
    if (!haState) {
      throw new Error('HA_ENTITY_NOT_FOUND');
    }

    const domain = entityId.split('.')[0];
    const deviceId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Mapping type and semanticType
    let deviceType = 'sensor';
    let semanticType: 'light' | 'switch' | 'cover' | 'sensor' | 'unknown' | undefined = undefined;

    if (domain === 'light') {
      deviceType = 'light';
      semanticType = 'light';
    } else if (domain === 'switch') {
      deviceType = 'switch';
      // Do NOT automatically guess it's a light even if name says "luz"
      semanticType = undefined;
    } else if (domain === 'binary_sensor') {
      deviceType = 'binary_sensor';
      semanticType = 'sensor';
    } else if (domain === 'sensor') {
      deviceType = 'sensor';
      semanticType = 'sensor';
    } else if (domain === 'cover') {
      deviceType = 'cover';
      semanticType = 'cover';
    }

    /*
     * TODO: UI Implementation Plan for Semantic Classification
     * The operator-console DeviceDetail panel needs a new dropdown control:
     * "Clasificación Semántica" (semanticType)
     * Options:
     * - Automático (undefined)
     * - Luz (light)
     * - Interruptor (switch)
     * - Enchufe (outlet)
     * - Cortina/Persiana (cover)
     * - Sensor (sensor)
     * 
     * This is critical for Sonoff/HA switches that physically control lights.
     * Persistence will require updating DeviceRepository.saveDevice to store the semanticType column.
     */

    const device = {
      id: deviceId,
      homeId: homeId,
      roomId: null,
      externalId: externalId,
      name: name || (haState.attributes.friendly_name as string) || entityId,
      type: deviceType,
      semanticType,
      vendor: 'Home Assistant',
      status: 'PENDING' as const,
      integrationSource: 'ha',
      invertState: false,
      lastKnownState: { 
        on: haState.state === 'on' || haState.state === 'open',
        state: haState.state,
        current_position: haState.attributes.current_position
      },
      entityVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    await this.deps.deviceRepository.saveDevice(device);
    return device;
  }
}
