import { DeviceRepository } from '../../../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository } from '../../../../devices/domain/repositories/ActivityLogRepository';
import { trackInboxAvailability } from '../../../../devices/application/deviceAvailability';
import type { ExpiredInboxDeviceRemover } from '../../../../devices/application/ports/ExpiredInboxDeviceRemover';
import { logRuntimeDiagnostic } from '../../../../shared/config/runtimeEnvironment';
import type { SystemStateChangeEvent } from './syncTypes';
import { getErrorMessage, isDuplicateRealtimeSnapshot, parseStateChangePayload } from './stateChangeMapping';

export interface StateEventProcessorHooks {
  /** Se invoca al aceptar un evento válido (antes de procesarlo). */
  onEventAccepted(): void;
  /** Publica el evento de sistema derivado del cambio de estado. */
  publish(event: SystemStateChangeEvent): void;
}

/**
 * Traduce eventos state_changed del WebSocket en persistencia de estado,
 * eventos de sistema y entradas de activity log.
 */
export class HomeAssistantStateEventProcessor {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly expiredInboxDeviceRemover: ExpiredInboxDeviceRemover | null,
    private readonly hooks: StateEventProcessorHooks,
  ) {}

  public async process(data: unknown): Promise<void> {
    const payload = parseStateChangePayload(data);
    if (!payload) return;
    this.hooks.onEventAccepted();

    try {
      const externalId = `ha:${payload.entityId}`;
      const newState = payload.newState;
      const attributes = payload.attributes;

      const device = await this.deviceRepository.findByExternalId(externalId);
      if (!device) return;

      if (isDuplicateRealtimeSnapshot(device.lastKnownState, String(newState), attributes)) return;

      const previousState = device.lastKnownState
        ? { state: device.lastKnownState.state as string, attributes: device.lastKnownState.attributes as Record<string, unknown> }
        : undefined;

      const updatedDevice = {
        ...device,
        lastKnownState: device.status === 'PENDING' && device.roomId === null
          ? trackInboxAvailability(device.lastKnownState, { state: String(newState), attributes }, Date.now()) : {
          state: String(newState),
          attributes: attributes
        },
        updatedAt: new Date().toISOString()
      };

      if (device.status === 'PENDING' && device.roomId === null && this.expiredInboxDeviceRemover) {
        if (!await this.expiredInboxDeviceRemover.updatePendingState(device, updatedDevice.lastKnownState)) return;
      } else {
        await this.deviceRepository.saveDevice(updatedDevice);
      }

      try {
        const cryptoRandom = typeof crypto !== 'undefined' ? crypto : (await import('crypto')).webcrypto;
        const systemEvent: SystemStateChangeEvent = {
          eventId: cryptoRandom.randomUUID(),
          occurredAt: new Date().toISOString(),
          source: 'home_assistant',
          deviceId: device.id,
          externalId: externalId,
          previousState,
          newState: {
            state: String(newState),
            attributes: attributes
          }
        };

        this.hooks.publish(systemEvent);

        await this.activityLogRepository.saveActivity({
          timestamp: new Date().toISOString(),
          deviceId: device.id,
          type: 'STATE_CHANGED',
          description: `Device synchronized from Home Assistant WebSocket`,
          data: { state: String(newState), attributes }
        });
      } catch (logErr: unknown) {
        logRuntimeDiagnostic('error', `[HA-Sync] No se pudo guardar el activity log:`, getErrorMessage(logErr));
      }

    } catch (error: unknown) {
      logRuntimeDiagnostic('error', `[HA-Sync] Exception procesando el evento WS:`, getErrorMessage(error));
    }
  }
}
