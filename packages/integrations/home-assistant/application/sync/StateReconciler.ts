import { DeviceRepository } from '../../../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository } from '../../../../devices/domain/repositories/ActivityLogRepository';
import { HomeAssistantStateReader } from '../ports/HomeAssistantStateReader';
import { buildUnavailableDeviceState, trackInboxAvailability, hasExpiredInboxAvailability } from '../../../../devices/application/deviceAvailability';
import type { ExpiredInboxDeviceRemover } from '../../../../devices/application/ports/ExpiredInboxDeviceRemover';
import { logRuntimeDiagnostic } from '../../../../shared/config/runtimeEnvironment';
import { getErrorMessage } from './stateChangeMapping';

export type ReconciliationResult =
  | { status: 'aborted' }
  | { status: 'fetch_failed'; errorMessage: string }
  | { status: 'completed'; reconciledCount: number; unavailableCount: number; skippedCount: number };

/**
 * Fetch masivo de /api/states y parcheo silencioso del DeviceRepository
 * (sin emitir system_event para no activar automatizaciones).
 * El guard de solapamiento y los logs de resiliencia pertenecen al manager.
 */
export class HomeAssistantStateReconciler {
  constructor(
    private readonly haStateReader: HomeAssistantStateReader,
    private readonly deviceRepository: DeviceRepository,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly expiredInboxDeviceRemover: ExpiredInboxDeviceRemover | null,
  ) {}

  /**
   * @param getCurrentClient devuelve el socket vigente; si cambia durante la
   * reconciliación, ésta se aborta sin efectos adicionales.
   */
  public async reconcile(getCurrentClient: () => unknown): Promise<ReconciliationResult> {
    let allStates;
    const reconciliationClient = getCurrentClient();
    try {
      allStates = await this.haStateReader.getAllStates();
      if (getCurrentClient() !== reconciliationClient) return { status: 'aborted' };
    } catch (fetchError: unknown) {
      // /api/states falló: log de warning pero NO cerrar el WS.
      const errorMessage = getErrorMessage(fetchError);
      logRuntimeDiagnostic('warn', '[HA-Sync] Reconciliation: fallo al obtener /api/states. WS sigue activo.', errorMessage);
      return { status: 'fetch_failed', errorMessage };
    }

    const localHaDevices = (await this.deviceRepository.findAll())
      .filter((device) => device.integrationSource === 'ha' && device.externalId.startsWith('ha:'));
    const statesByExternalId = new Map<string, (typeof allStates)[number]>(
      allStates
        .filter((state) => state.entity_id && state.state !== null && state.state !== undefined)
        .map((state) => [`ha:${state.entity_id}`, state] as const),
    );

    let reconciledCount = 0;
    let unavailableCount = 0;
    let skippedCount = allStates.length - statesByExternalId.size;

    for (const device of localHaDevices) {
      try {
        const haState = statesByExternalId.get(device.externalId);
        if (device.status === 'PENDING' && device.roomId === null && this.expiredInboxDeviceRemover) {
          const now = Date.now();
          const nextState = haState
            ? { state: String(haState.state), attributes: haState.attributes || {} }
            : buildUnavailableDeviceState(device.lastKnownState);
          const updated = { ...device, lastKnownState: trackInboxAvailability(device.lastKnownState, nextState, now), updatedAt: new Date(now).toISOString() };
          if (getCurrentClient() !== reconciliationClient) return { status: 'aborted' };
          if (!await this.expiredInboxDeviceRemover.updatePendingState(device, updated.lastKnownState)) continue;
          if (hasExpiredInboxAvailability(updated.lastKnownState, now)) {
            const removed = await this.expiredInboxDeviceRemover.removeIfUnreferenced(updated);
            if (removed) await this.activityLogRepository.saveActivity({
              timestamp: updated.updatedAt, deviceId: null, type: 'HA_RESILIENCE',
              description: 'Expired unassigned discovery removed locally', data: { source: 'reconciliation', deviceId: device.id },
            });
          }
          reconciledCount++;
          continue;
        }
        if (!haState) {
          if (device.lastKnownState?.state === 'unavailable') {
            skippedCount++;
            continue;
          }

          await this.deviceRepository.saveDevice({
            ...device,
            lastKnownState: buildUnavailableDeviceState(device.lastKnownState),
            updatedAt: new Date().toISOString(),
          });
          unavailableCount++;
          continue;
        }

        await this.deviceRepository.saveDevice({
          ...device,
          lastKnownState: {
            state: String(haState.state),
            attributes: haState.attributes || {}
          },
          updatedAt: new Date().toISOString()
        });

        reconciledCount++;
      } catch (entityError: unknown) {
        skippedCount++;
        logRuntimeDiagnostic('warn', `[HA-Sync] Reconciliation: error parcheando ${device.externalId}:`, getErrorMessage(entityError));
      }
    }

    return { status: 'completed', reconciledCount, unavailableCount, skippedCount };
  }
}
