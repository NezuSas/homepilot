import { create } from 'zustand';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';

const API_URL = `${API_BASE_URL}/api/v1`;
const SNAPSHOT_FRESHNESS_MS = 15_000;

export interface SnapshotRefreshOptions {
  force?: boolean;
}

export interface SnapshotDeviceCapability {
  type: string;
  name: string;
  state?: Record<string, unknown> | null;
  commands?: Array<{
    name: string;
    params?: Array<{
      name: string;
      type: string;
      min?: number;
      max?: number;
      required?: boolean;
    }>;
  }>;
}

export interface SnapshotDeviceProfile {
  source: string;
  domain: string;
  type: string;
  semanticType?: SnapshotDevice['semanticType'];
  displayName: string;
  category: string;
  supportedCommands: string[];
  configurationSections: Array<{
    id: string;
    label: string;
    description: string;
  }>;
}

export interface SnapshotDevice {
  id: string;
  homeId: string;
  roomId: string | null;
  externalId?: string;
  name: string;
  type: string;
  semanticType?: 'light' | 'switch' | 'outlet' | 'cover' | 'camera' | 'sensor' | 'unknown' | null;
  vendor?: string;
  status: 'PENDING' | 'ASSIGNED';
  invertState?: boolean;
  lastKnownState: Record<string, unknown> | null;
  entityVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  integrationSource?: string;
  capabilities?: SnapshotDeviceCapability[];
  profile?: SnapshotDeviceProfile;
}

export interface SnapshotRoom {
  id: string;
  name: string;
  homeId: string;
}

export interface SnapshotHome {
  id: string;
  ownerId?: string;
  name?: string;
}

interface DeviceSnapshotState {
  devices: SnapshotDevice[];
  homes: SnapshotHome[];
  roomsByHome: Record<string, SnapshotRoom[]>;
  isLoading: boolean;
  lastUpdatedAt: number | null;
  refreshSnapshot: (options?: SnapshotRefreshOptions) => Promise<void>;
  upsertDevice: (device: SnapshotDevice) => void;
  resetSnapshotState: () => void;
}

const initialState = {
  devices: [],
  homes: [],
  roomsByHome: {},
  isLoading: true,
  lastUpdatedAt: null,
};

let snapshotRequest: Promise<void> | null = null;
let snapshotGeneration = 0;

export const useDeviceSnapshotStore = create<DeviceSnapshotState>((set, get) => ({
  ...initialState,
  refreshSnapshot: (options = {}) => {
    const currentState = get();
    const isFresh = currentState.lastUpdatedAt !== null
      && Date.now() - currentState.lastUpdatedAt < SNAPSHOT_FRESHNESS_MS;

    if (!options.force && isFresh) {
      return Promise.resolve();
    }

    if (snapshotRequest) {
      return snapshotRequest;
    }

    const requestGeneration = snapshotGeneration;
    const hasData = currentState.devices.length > 0;
    if (requestGeneration === snapshotGeneration) {
      set({ isLoading: !hasData });
    }

    const refreshRequest = (async () => {
      try {
        const [devicesResponse, homesResponse] = await Promise.all([
          apiFetch(`${API_URL}/devices`),
          apiFetch(`${API_URL}/homes`).catch(() => null),
        ]);

        if (requestGeneration !== snapshotGeneration) return;

      if (!devicesResponse.ok) {
        throw new Error('DEVICE_REFRESH_ERROR');
      }

      const rawDevices = await devicesResponse.json();
      const devices = Array.isArray(rawDevices) ? rawDevices as SnapshotDevice[] : null;
      
        if (!devices) {
          console.error('[DeviceSnapshotStore] Received non-array devices response:', rawDevices);
          return;
        }

        const homeIdsFromDevices = Array.from(new Set(devices.map((device) => device.homeId).filter(Boolean)));
      
        let homes = get().homes;
        if (homesResponse?.ok) {
          const rawHomes = await homesResponse.json();
          if (Array.isArray(rawHomes)) {
            homes = rawHomes as SnapshotHome[];
          } else {
            console.warn('[DeviceSnapshotStore] Received non-array homes response:', rawHomes);
          }
        }

        const homeIds = Array.from(new Set([...homeIdsFromDevices, ...homes.map((home) => home.id)]));
      
        const roomsEntries = await Promise.all(
          homeIds.map(async (homeId) => {
            try {
              const roomsResponse = await apiFetch(`${API_URL}/homes/${homeId}/rooms`);
              if (!roomsResponse.ok) return [homeId, get().roomsByHome[homeId] || []] as const;
              const rawRooms = await roomsResponse.json();
              if (!Array.isArray(rawRooms)) {
                console.warn(`[DeviceSnapshotStore] Received non-array rooms response for home ${homeId}:`, rawRooms);
                return [homeId, get().roomsByHome[homeId] || []] as const;
              }
              return [homeId, rawRooms as SnapshotRoom[]] as const;
            } catch {
              return [homeId, get().roomsByHome[homeId] || []] as const;
            }
          })
        );

        if (requestGeneration !== snapshotGeneration) return;

        set({
          devices,
          homes,
          roomsByHome: Object.fromEntries(roomsEntries),
          lastUpdatedAt: Date.now(),
        });
      } catch (error) {
        console.error('[DeviceSnapshotStore] Failed to refresh snapshot:', error);
      } finally {
        if (requestGeneration === snapshotGeneration) {
          set({ isLoading: false });
        }
      }
    })();

    snapshotRequest = refreshRequest;
    void refreshRequest.finally(() => {
      if (snapshotRequest === refreshRequest) {
        snapshotRequest = null;
      }
    });

    return refreshRequest;
  },

  upsertDevice: (device) => {
    set((state) => ({
      devices: state.devices.some((currentDevice) => currentDevice.id === device.id)
        ? state.devices.map((currentDevice) => currentDevice.id === device.id ? device : currentDevice)
        : [device, ...state.devices],
    }));
  },

  resetSnapshotState: () => {
    snapshotGeneration += 1;
    snapshotRequest = null;
    set({ ...initialState });
  },
}));
