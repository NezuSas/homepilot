import { create } from 'zustand';
import { API_ENDPOINTS } from '../config';
import { apiFetch } from '../lib/apiClient';

export interface AssistantSummary {
  totalOpen: number;
}

export interface RealtimeEventMessage {
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface AppShellState {
  assistantSummary: AssistantSummary | null;
  isAllSynced: boolean;
  isRealtimeConnected: boolean;
  lastRealtimeEvent: RealtimeEventMessage | null;
  recentRealtimeEvents: RealtimeEventMessage[];
  setAssistantSummary: (assistantSummary: AssistantSummary | null) => void;
  refreshAssistantSummary: () => Promise<void>;
  setRealtimeConnected: (isRealtimeConnected: boolean) => void;
  ingestRealtimeEvent: (event: RealtimeEventMessage) => void;
  pulseSyncStatus: () => void;
  resetAppShellState: () => void;
}

const SYNC_STATUS_RESET_DELAY_MS = 1500;
const MAX_RECENT_REALTIME_EVENTS = 20;

let syncStatusResetTimer: ReturnType<typeof window.setTimeout> | null = null;

const initialState = {
  assistantSummary: null,
  isAllSynced: true,
  isRealtimeConnected: false,
  lastRealtimeEvent: null,
  recentRealtimeEvents: [],
};

export const useAppShellStore = create<AppShellState>((set) => ({
  ...initialState,

  setAssistantSummary: (assistantSummary) => {
    set({ assistantSummary });
  },

  refreshAssistantSummary: async () => {
    try {
      const response = await apiFetch(API_ENDPOINTS.assistant.summary);
      const contentType = response.headers.get('content-type');

      if (!response.ok || !contentType || !contentType.includes('application/json')) {
        return;
      }

      const rawSummary = await response.json() as any;
      
      // Basic shape validation for luxury/premium robustness
      if (rawSummary && typeof rawSummary === 'object' && 'totalOpen' in rawSummary) {
        set({ assistantSummary: rawSummary as AssistantSummary });
      } else {
        console.warn('[AppShellStore] Received invalid assistant summary shape:', rawSummary);
      }
    } catch {
      // Keep current summary state if refresh fails.
    }
  },

  setRealtimeConnected: (isRealtimeConnected) => {
    set({ isRealtimeConnected });
  },

  ingestRealtimeEvent: (event) => {
    set((state) => ({
      lastRealtimeEvent: event,
      recentRealtimeEvents: [event, ...state.recentRealtimeEvents].slice(0, MAX_RECENT_REALTIME_EVENTS),
    }));
  },

  pulseSyncStatus: () => {
    if (syncStatusResetTimer !== null) {
      window.clearTimeout(syncStatusResetTimer);
    }

    set({ isAllSynced: false });

    syncStatusResetTimer = window.setTimeout(() => {
      set({ isAllSynced: true });
      syncStatusResetTimer = null;
    }, SYNC_STATUS_RESET_DELAY_MS);
  },

  resetAppShellState: () => {
    if (syncStatusResetTimer !== null) {
      window.clearTimeout(syncStatusResetTimer);
      syncStatusResetTimer = null;
    }

    set({ ...initialState });
  },
}));
