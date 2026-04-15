import { useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useAppShellStore } from '../stores/useAppShellStore';
import type { RealtimeEventMessage } from '../stores/useAppShellStore';

interface UseRealtimeEventsResult {
  isConnected: boolean;
  lastEvent: RealtimeEventMessage | null;
  recentEvents: RealtimeEventMessage[];
}

const RECONNECT_DELAY_MS = 3000;

function getRealtimeUrl(): string {
  const apiUrl = new URL(API_BASE_URL);
  apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  apiUrl.pathname = '/ws';
  apiUrl.search = '';
  apiUrl.hash = '';
  return apiUrl.toString();
}

function isRealtimeEventMessage(value: unknown): value is RealtimeEventMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.type === 'string'
    && typeof candidate.timestamp === 'string'
    && !!candidate.payload
    && typeof candidate.payload === 'object'
    && !Array.isArray(candidate.payload);
}

export function useRealtimeEvents(enabled: boolean): UseRealtimeEventsResult {
  const isConnected = useAppShellStore((state) => state.isRealtimeConnected);
  const lastEvent = useAppShellStore((state) => state.lastRealtimeEvent);
  const recentEvents = useAppShellStore((state) => state.recentRealtimeEvents);
  const setRealtimeConnected = useAppShellStore((state) => state.setRealtimeConnected);
  const ingestRealtimeEvent = useAppShellStore((state) => state.ingestRealtimeEvent);
  const resetAppShellState = useAppShellStore((state) => state.resetAppShellState);

  useEffect(() => {
    if (!enabled) {
      resetAppShellState();
      return;
    }

    let disposed = false;
    let reconnectTimeoutId: number | undefined;
    let socket: WebSocket | null = null;

    const connect = () => {
      if (disposed) return;

      try {
        socket = new WebSocket(getRealtimeUrl());
      } catch (error) {
        console.warn('[Realtime] Failed to initialize websocket:', error);
        reconnectTimeoutId = window.setTimeout(connect, RECONNECT_DELAY_MS);
        return;
      }

      socket.addEventListener('open', () => {
        if (disposed) return;
        setRealtimeConnected(true);
      });

      socket.addEventListener('message', (message) => {
        if (disposed || typeof message.data !== 'string') {
          return;
        }

        try {
          const parsed = JSON.parse(message.data) as unknown;
          if (!isRealtimeEventMessage(parsed)) {
            return;
          }

          console.debug('[Realtime] Event received:', parsed.type, parsed.payload);
          ingestRealtimeEvent(parsed);
        } catch (error) {
          console.warn('[Realtime] Failed to parse event message:', error);
        }
      });

      socket.addEventListener('close', () => {
        if (disposed) return;
        setRealtimeConnected(false);
        reconnectTimeoutId = window.setTimeout(connect, RECONNECT_DELAY_MS);
      });

      socket.addEventListener('error', (error) => {
        console.warn('[Realtime] WebSocket error:', error);
      });
    };

    connect();

    return () => {
      disposed = true;
      setRealtimeConnected(false);

      if (reconnectTimeoutId !== undefined) {
        window.clearTimeout(reconnectTimeoutId);
      }

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [enabled, ingestRealtimeEvent, resetAppShellState, setRealtimeConnected]);

  return { isConnected, lastEvent, recentEvents };
}
