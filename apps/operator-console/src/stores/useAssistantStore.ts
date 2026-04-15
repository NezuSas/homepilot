import { create } from 'zustand';
import { API_ENDPOINTS } from '../config';
import { useAppShellStore } from './useAppShellStore';

export interface AssistantFinding {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  status: 'open' | 'dismissed' | 'resolved';
  actions: { type: string; label: string; payload?: any }[];
  metadata: Record<string, any>;
  score: number;
  explanation?: string;
}

interface AssistantStoreState {
  findings: AssistantFinding[];
  isLoading: boolean;
  isScanning: boolean;
  refreshFindings: () => Promise<void>;
  scanFindings: () => Promise<void>;
  dismissFinding: (id: string) => Promise<void>;
  resolveFinding: (id: string) => Promise<void>;
  resetAssistantState: () => void;
}

const initialState = {
  findings: [],
  isLoading: true,
  isScanning: false,
};

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type');

  if (!response.ok || !contentType || !contentType.includes('application/json')) {
    return null;
  }

  return response.json() as Promise<T>;
}

export const useAssistantStore = create<AssistantStoreState>((set, get) => ({
  ...initialState,

  refreshFindings: async () => {
    set((state) => ({ isLoading: state.findings.length === 0 }));

    try {
      const response = await fetch(API_ENDPOINTS.assistant.findings);
      const findings = await readJsonResponse<AssistantFinding[]>(response);

      if (findings) {
        set({ findings });
        await useAppShellStore.getState().refreshAssistantSummary();
      }
    } catch (error) {
      console.error('[AssistantStore] Failed to fetch findings:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  scanFindings: async () => {
    set({ isScanning: true });

    try {
      const response = await fetch(API_ENDPOINTS.assistant.scan, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`SCAN_FAILED_${response.status}`);
      }

      await get().refreshFindings();
    } catch (error) {
      console.error('[AssistantStore] Scan failed:', error);
    } finally {
      set({ isScanning: false });
    }
  },

  dismissFinding: async (id: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.assistant.dismiss(id), { method: 'POST' });
      if (!response.ok) {
        throw new Error(`DISMISS_FAILED_${response.status}`);
      }

      set((state) => ({ findings: state.findings.filter((finding) => finding.id !== id) }));
      await useAppShellStore.getState().refreshAssistantSummary();
    } catch (error) {
      console.error('[AssistantStore] Dismiss failed:', error);
    }
  },

  resolveFinding: async (id: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.assistant.resolve(id), { method: 'POST' });
      if (!response.ok) {
        throw new Error(`RESOLVE_FAILED_${response.status}`);
      }

      set((state) => ({ findings: state.findings.filter((finding) => finding.id !== id) }));
      await useAppShellStore.getState().refreshAssistantSummary();
    } catch (error) {
      console.error('[AssistantStore] Resolve failed:', error);
    }
  },

  resetAssistantState: () => {
    set({ ...initialState });
  },
}));
