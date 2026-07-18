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

function isAssistantSummary(value: unknown): value is AssistantSummary {
  const candidate = value as Record<string, unknown>;

  return (
    typeof value === 'object' &&
    value !== null &&
    'totalOpen' in value &&
    typeof candidate.totalOpen === 'number'
  );
}

interface AppShellState {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  assistantSummary: AssistantSummary | null;
  isAllSynced: boolean;
  isRealtimeConnected: boolean;
  lastRealtimeEvent: RealtimeEventMessage | null;
  recentRealtimeEvents: RealtimeEventMessage[];
  sessionToken: string | null;
  setAssistantSummary: (assistantSummary: AssistantSummary | null) => void;
  refreshAssistantSummary: () => Promise<void>;
  setRealtimeConnected: (isRealtimeConnected: boolean) => void;
  setSessionToken: (token: string | null) => void;
  ingestRealtimeEvent: (event: RealtimeEventMessage) => void;
  pulseSyncStatus: () => void;
  resetAppShellState: () => void;
}

const SYNC_STATUS_RESET_DELAY_MS = 1500;
const MAX_RECENT_REALTIME_EVENTS = 20;

let syncStatusResetTimer: ReturnType<typeof window.setTimeout> | null = null;

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('__homepilot_theme');
    if (saved === 'light' || saved === 'dark') return saved;
  }
  return 'dark';
};

const initialState = {
  theme: getInitialTheme(),
  assistantSummary: null,
  isAllSynced: true,
  isRealtimeConnected: false,
  lastRealtimeEvent: null,
  recentRealtimeEvents: [],
  sessionToken: typeof window !== 'undefined' ? localStorage.getItem('hp_session_token') : null,
};

export const useAppShellStore = create<AppShellState>((set) => ({
  ...initialState,

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('__homepilot_theme', theme);
      if (theme === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    }
    set({ theme });
  },

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

      const rawSummary: unknown = await response.json();
      
      if (isAssistantSummary(rawSummary)) {
        set({ assistantSummary: rawSummary });
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

  setSessionToken: (token) => {
    set({ sessionToken: token });
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
