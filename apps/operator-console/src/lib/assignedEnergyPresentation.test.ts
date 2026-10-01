import { getAssignedEnergyPresentation } from './assignedEnergyPresentation';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
const rooms = [{ id: 'office', homeId: 'home', name: 'Oficina' }];
const device: SnapshotDevice = { id: 'energy', externalId: 'ha:sensor.energy', name: 'Consumo oficina', homeId: 'home', roomId: 'office', type: 'sensor', status: 'ASSIGNED', lastKnownState: null };
describe('Feature: Assigned energy readings (AC4, AC60)', () => {
  it('joins imported entities by external ID, excludes unassigned readings, and sums only displayed data', () => {
    const data = getAssignedEnergyPresentation([
      { entity_id: 'sensor.energy', name: 'Technical', state: 12, unit: 'W' },
      { entity_id: 'sensor.pending', name: 'Pending', state: 500, unit: 'W' },
      { entity_id: 'sensor.foreign', name: 'Other', state: 100, unit: 'W' },
    ], [device, { ...device, id: 'pending', externalId: 'ha:sensor.pending', roomId: null }], rooms);
    expect(data.readings.map(reading => reading.name)).toEqual(['Consumo oficina']);
    expect(data.totalPower).toBe(12);
    expect(data.totalEnergy).toBeNull();
    expect(data.groups.map(group => group.name)).toEqual(['Oficina']);
  });
  it('distinguishes a measured zero from missing data and rejects non-finite readings', () => {
    expect(getAssignedEnergyPresentation([{ entity_id: 'sensor.energy', name: '', state: 0, unit: 'W' }], [device], rooms).totalPower).toBe(0);
    expect(getAssignedEnergyPresentation([{ entity_id: 'sensor.energy', name: '', state: NaN, unit: 'W' }], [device], rooms).readings).toEqual([]);
  });
});
