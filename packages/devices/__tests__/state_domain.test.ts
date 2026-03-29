import { isStateIdentical } from '../domain/state';
import { createDiscoveredDevice } from '../domain/createDiscoveredDevice';
import { IdGenerator, Clock } from '../../shared/domain/types';

describe('Devices: State Domain', () => {
  const mockIdGen: IdGenerator = { generate: () => 'test-id' };
  const mockClock: Clock = { now: () => '2026-03-29T12:00:00Z' };

  describe('isStateIdentical (V1: Flat Objects)', () => {
    it('debe retornar true si ambos son null', () => {
      expect(isStateIdentical(null, null)).toBe(true);
    });

    it('debe retornar false si uno es null y el otro no', () => {
      expect(isStateIdentical(null, { status: 'on' })).toBe(false);
      expect(isStateIdentical({ status: 'on' }, null)).toBe(false);
    });

    it('debe retornar true para objetos planos con los mismos valores', () => {
      const state1 = { status: 'on', battery: 85 };
      const state2 = { battery: 85, status: 'on' }; // Orden diferente de llaves
      expect(isStateIdentical(state1, state2)).toBe(true);
    });

    it('debe retornar false si un valor cambia', () => {
      const state1 = { status: 'on', battery: 85 };
      const state2 = { status: 'off', battery: 85 };
      expect(isStateIdentical(state1, state2)).toBe(false);
    });

    it('debe retornar false si cambia la cantidad de llaves', () => {
      const state1 = { status: 'on' };
      const state2 = { status: 'on', battery: 85 };
      expect(isStateIdentical(state1, state2)).toBe(false);
    });
  });

  describe('createDiscoveredDevice', () => {
    it('debe inicializar lastKnownState como null en el descubrimiento inicial', () => {
      const device = createDiscoveredDevice({
        homeId: 'home-1',
        externalId: 'ext-1',
        name: 'Light',
        type: 'switch',
        vendor: 'HomePilot'
      }, { idGenerator: mockIdGen, clock: mockClock });

      expect(device.lastKnownState).toBeNull();
    });
  });
});
