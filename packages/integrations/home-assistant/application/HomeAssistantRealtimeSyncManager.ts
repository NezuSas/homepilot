import { HomeAssistantWebSocketClient } from './HomeAssistantWebSocketClient';
import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository } from '../../../devices/domain/repositories/ActivityLogRepository';
import { HomeAssistantSettingsService } from './HomeAssistantSettingsService';

export class HomeAssistantRealtimeSyncManager {
  private client: HomeAssistantWebSocketClient | null = null;
  private currentUrl: string | null = null;
  private currentToken: string | null = null;

  constructor(
    private readonly settingsService: HomeAssistantSettingsService,
    private readonly deviceRepository: DeviceRepository,
    private readonly activityLogRepository: ActivityLogRepository
  ) {}

  public reconnect(baseUrl: string, token: string): void {
    if (this.currentUrl === baseUrl && this.currentToken === token && this.client) {
      return; // Skip si no hubo cambios
    }

    this.stop();

    if (!baseUrl || !token) {
      return;
    }

    this.currentUrl = baseUrl;
    this.currentToken = token;

    this.client = new HomeAssistantWebSocketClient(baseUrl, token);

    // Mapeo seguro de eventos hacia el Settings Service
    this.client.on('error', (type: 'auth_error' | 'unreachable', err: Error) => {
      console.log(`[HA-Sync] WS Error (${type}):`, err.message);
      this.settingsService.updateStatusFromOperation(type);
    });

    this.client.on('close', () => {
      console.log(`[HA-Sync] WS Closed.`);
      this.settingsService.updateStatusFromOperation('unreachable');
    });

    this.client.on('ready', () => {
      console.log(`[HA-Sync] WS Ready & Subscribed.`);
      this.settingsService.updateStatusFromOperation('reachable');
    });

    this.client.on('event', async (data: any) => {
      // Actuar como latido de comprobación: si se reciben eventos la red de HA está OK.
      this.settingsService.updateStatusFromOperation('reachable');
      await this.processEvent(data);
    });

    this.client.connect().catch((err: Error) => {
      console.log(`[HA-Sync] Connect reject:`, err.message);
      // El error ya fue emitido y hookeado por client.on('error'), no hace falta re-hacer.
    });
  }

  public stop(): void {
    if (this.client) {
      this.client.forceClose();
      this.client = null;
    }
    this.currentUrl = null;
    this.currentToken = null;
  }

  private async processEvent(data: any): Promise<void> {
    // 1. Validar que new_state exista antes de acceder
    if (!data || !data.entity_id || !data.new_state) {
      return; 
    }

    try {
      const entityId = data.entity_id as string;
      const externalId = `ha:${entityId}`;
      const newState = data.new_state.state;
      const attributes = data.new_state.attributes || {};

      // 2. Búsqueda en DeviceRepository
      const device = await this.deviceRepository.findByExternalId(externalId);

      // Si no existe, se ignora silenciosamente. (Unlinked Device)
      if (!device) {
        return;
      }

      // 3. Update agnóstico preservando metadata, tal cual exige el Spec V1
      const updatedDevice = {
        ...device,
        lastKnownState: {
          state: String(newState), // Casting fuerte para futuros enum (climate, boolean, numeric_sensor)
          attributes: attributes
        },
        updatedAt: new Date().toISOString()
      };

      // 4. Delegamos inserción de estado y log a los repos
      await this.deviceRepository.saveDevice(updatedDevice);

      try {
        await this.activityLogRepository.saveActivity({
          timestamp: new Date().toISOString(),
          deviceId: device.id,
          type: 'STATE_CHANGED',
          description: `Device sync from HA WebSocket`,
          data: {
            new_state: String(newState),
            attributes: attributes
          }
        });
      } catch (logErr: any) {
         console.error(`[HA-Sync] No se pudo guardar el activity log:`, logErr.message);
      }

    } catch (e: any) {
      console.error(`[HA-Sync] Exception procesando el evento WS:`, e.message);
    }
  }
}
