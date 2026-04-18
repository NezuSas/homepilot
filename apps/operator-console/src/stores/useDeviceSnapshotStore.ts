import { create } from 'zustand';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/api/v1`;

export interface SnapshotDevice {
  id: string;
  homeId: string;
  roomId: string | null;
  externalId?: string;
  name: string;
  type: string;
  vendor?: string;
  status: 'PENDING' | 'ASSIGNED';
  invertState?: boolean;
  lastKnownState: Record<string, unknown> | null;
  entityVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  integrationSource?: string;
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
    set((state) => ({ isLoading: state.devices.length === 0 && state.homes.length === 0 }));

    try {
      const devicesResponse = await fetch(`${API_URL}/devices`);
      if (!devicesResponse.ok) {
        throw new Error('DEVICE_REFRESH_ERROR');
      }

      const devices = await devicesResponse.json() as SnapshotDevice[];
      const homeIdsFromDevices = Array.from(new Set(devices.map((device) => device.homeId).filter(Boolean)));

      let homes = get().homes;
      const homesResponse = await fetch(`${API_URL}/homes`);
      if (homesResponse.ok) {
        homes = await homesResponse.json() as SnapshotHome[];
      }

      const homeIds = Array.from(new Set([...homeIdsFromDevices, ...homes.map((home) => home.id)]));
      const roomsEntries = await Promise.all(
        homeIds.map(async (homeId) => {
          const roomsResponse = await fetch(`${API_URL}/homes/${homeId}/rooms`);
          if (!roomsResponse.ok) {
            return [homeId, []] as const;
          }

          const rooms = await roomsResponse.json() as SnapshotRoom[];
          return [homeId, rooms] as const;
        })
      );

      set({
        devices,
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
