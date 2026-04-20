import { create } from 'zustand';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';

const API_URL = `${API_BASE_URL}/api/v1`;

export interface EnergyEntity {
  entity_id: string;
  name: string;
  state: number;
  unit: 'W' | 'kWh';
  device_class?: string;
  area?: string;
}

interface EnergyState {
  entities: EnergyEntity[];
  isLoading: boolean;
  lastUpdated: string | null;
  refreshEnergy: () => Promise<void>;
  computeTotalPower: () => number;
  computeTotalEnergy: () => number;
}

interface RawHaEntity {
  entityId: string;
  state: string;
  friendlyName: string;
  domain: string;
  invertState: number;
  attributes?: {
    unit_of_measurement?: string;
    device_class?: string;
    [key: string]: unknown;
  };
}

export const useEnergyStore = create<EnergyState>((set, get) => ({
  entities: [],
  isLoading: true,
  lastUpdated: null,

  computeTotalPower: () => {
    return get()
      .entities.filter((e) => e.unit === 'W')
      .reduce((sum, e) => sum + e.state, 0);
  },

  computeTotalEnergy: () => {
    return get()
      .entities.filter((e) => e.unit === 'kWh')
      .reduce((sum, e) => sum + e.state, 0);
  },

  refreshEnergy: async () => {
    const isFirstLoad = get().entities.length === 0;
    if (isFirstLoad) {
      set({ isLoading: true });
    }

    try {
      const res = await apiFetch(`${API_URL}/ha/entities?mode=all`);

      if (!res.ok) {
        throw new Error('ENERGY_REFRESH_ERROR');
      }

      const rawEntities = await res.json() as RawHaEntity[];

      const filteredEntities: EnergyEntity[] = [];

      for (const item of rawEntities) {
        // filter out invalid states
        if (
          item.state === 'unavailable' ||
          item.state === 'unknown' ||
          item.state === '' ||
          item.state === null
        ) {
          continue;
        }

        const unit = item.attributes?.unit_of_measurement;
        if (unit === 'W' || unit === 'kWh') {
          const numericState = parseFloat(item.state);
          if (!isNaN(numericState)) {
            filteredEntities.push({
              entity_id: item.entityId,
              name: item.friendlyName,
              state: numericState,
              unit,
              device_class: item.attributes?.device_class,
              // HA entities might not always have native area easily exposed without the device registry,
              // but we add the placeholder as asked by requested type format.
            });
          }
        }
      }

      set({
        entities: filteredEntities,
        isLoading: false,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[useEnergyStore] failed to fetch energy entities:', error);
      // Even on failure, stop loading smoothly if we hit an error
      set({ isLoading: false });
    }
  },
}));
