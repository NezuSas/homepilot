import { create } from 'zustand';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';

const API_URL = `${API_BASE_URL}/api/v1`;

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
  semanticType?: 'light' | 'switch' | 'outlet' | 'cover' | 'sensor' | 'unknown' | null;
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
  refreshSnapshot: () => Promise<void>;
  upsertDevice: (device: SnapshotDevice) => void;
  resetSnapshotState: () => void;
}

const initialState = {
  devices: [],
  homes: [],
  roomsByHome: {},
  isLoading: true,
};

export const useDeviceSnapshotStore = create<DeviceSnapshotState>((set, get) => ({
  ...initialState,
  refreshSnapshot: async () => {
    const hasData = get().devices.length > 0;
    set({ isLoading: !hasData });

    try {
      const devicesResponse = await apiFetch(`${API_URL}/devices`);
      if (!devicesResponse.ok) {
        throw new Error('DEVICE_REFRESH_ERROR');
      }

      const rawDevices = await devicesResponse.json();
      const devices = Array.isArray(rawDevices) ? rawDevices as SnapshotDevice[] : null;
      
      if (!devices) {
        console.error('[DeviceSnapshotStore] Received non-array devices response:', rawDevices);
        set({ isLoading: false });
        return;
      }

      set({ devices, isLoading: false });

      const homeIdsFromDevices = Array.from(new Set(devices.map((device) => device.homeId).filter(Boolean)));
      
      const [homesRes] = await Promise.all([
        apiFetch(`${API_URL}/homes`),
      ]);

      let homes = get().homes;
      if (homesRes.ok) {
        const rawHomes = await homesRes.json();
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
            const rooms = rawRooms as SnapshotRoom[];
            return [homeId, rooms] as const;
          } catch {
            return [homeId, get().roomsByHome[homeId] || []] as const;
          }
        })
      );

      set({
        homes,
        roomsByHome: Object.fromEntries(roomsEntries),
      });
    } catch (error) {
      console.error('[DeviceSnapshotStore] Failed to refresh snapshot:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  upsertDevice: (device) => {
    set((state) => ({
      devices: state.devices.some((currentDevice) => currentDevice.id === device.id)
        ? state.devices.map((currentDevice) => currentDevice.id === device.id ? device : currentDevice)
        : [device, ...state.devices],
    }));
  },

  resetSnapshotState: () => {
    set({ ...initialState });
  },
}));
