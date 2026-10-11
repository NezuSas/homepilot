import { useEffect, useRef } from 'react';
import { isKnownModbusStateEvent, useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { useAppShellStore } from '../stores/useAppShellStore';
import { useAssistantStore } from '../stores/useAssistantStore';
import type { SessionStatus } from './useSession';
import { useRealtimeEvents } from './useRealtimeEvents';
import { REALTIME_REFRESH_DEBOUNCE_MS, REFRESH_TRIGGER_EVENTS } from './realtimeRefreshEvents';


/**
 * Keeps the snapshot and assistant findings fresh: realtime events (debounced so a
 * dispatch + state-updated burst becomes one refresh) and tab visibility/focus.
 */
export function useRealtimeRefresh(status: SessionStatus): void {
  const { lastEvent } = useRealtimeEvents(status === 'authenticated');
  const pulseSyncStatus = useAppShellStore((state) => state.pulseSyncStatus);
  const refreshAssistantFindings = useAssistantStore((state) => state.refreshFindings);
  const refreshDeviceSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const burstTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !lastEvent) return;

    pulseSyncStatus();
    if (!REFRESH_TRIGGER_EVENTS.includes(lastEvent.type)) return;

    // PLC state was applied synchronously by the websocket listener; no full snapshot is needed.
    if (isKnownModbusStateEvent(lastEvent)) return;

    // refreshAssistantFindings already refreshes the summary internally.
    if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
    burstTimerRef.current = window.setTimeout(() => {
      burstTimerRef.current = null;
      void refreshDeviceSnapshot({ force: true });
      refreshAssistantFindings();
    }, REALTIME_REFRESH_DEBOUNCE_MS);
  }, [status, lastEvent, pulseSyncStatus, refreshAssistantFindings, refreshDeviceSnapshot]);

  useEffect(() => () => {
    if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const reconcileVisibleState = () => {
      if (document.visibilityState === 'visible') void refreshDeviceSnapshot();
    };
    document.addEventListener('visibilitychange', reconcileVisibleState);
    window.addEventListener('focus', reconcileVisibleState);

    return () => {
      document.removeEventListener('visibilitychange', reconcileVisibleState);
      window.removeEventListener('focus', reconcileVisibleState);
    };
  }, [status, refreshDeviceSnapshot]);
}
