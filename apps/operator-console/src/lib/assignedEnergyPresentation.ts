import type { EnergyEntity } from '../stores/useEnergyStore';
import type { SnapshotDevice, SnapshotRoom } from '../stores/useDeviceSnapshotStore';
import { isDeviceOperational } from './deviceOperationalEligibility';

export function getAssignedEnergyPresentation(entities: EnergyEntity[], devices: SnapshotDevice[], rooms: SnapshotRoom[]) {
  const readings = entities.flatMap(entity => {
    const device = devices.find(candidate => candidate.externalId?.replace(/^ha:/, '') === entity.entity_id
      && isDeviceOperational(candidate, rooms));
    const room = rooms.find(candidate => candidate.id === device?.roomId);
    return device && room && Number.isFinite(entity.state) ? [{ ...entity, name: device.name, roomId: room.id, roomName: room.name }] : [];
  });
  const sum = (unit: EnergyEntity['unit']) => {
    const matches = readings.filter(reading => reading.unit === unit);
    return matches.length ? matches.reduce((total, reading) => total + reading.state, 0) : null;
  };
  const groups = rooms.flatMap(room => {
    const entries = readings.filter(reading => reading.roomId === room.id).sort((a, b) => a.name.localeCompare(b.name));
    return entries.length ? [{ id: room.id, name: room.name, readings: entries }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { readings, groups, totalPower: sum('W'), totalEnergy: sum('kWh') };
}
