import { randomUUID } from 'node:crypto';
import type { HomeRepository } from '../../packages/topology/domain/repositories/HomeRepository';
import { ModbusService } from '../../packages/integrations/modbus/application/ModbusService';
import { SQLiteModbusRepository } from '../../packages/integrations/modbus/infrastructure/SQLiteModbusRepository';
import { ModbusTcpClient } from '../../packages/integrations/modbus/infrastructure/ModbusTcpClient';
import { DefaultPlcTransportRegistry } from '../../packages/integrations/modbus/infrastructure/DefaultPlcTransportRegistry';
import { syncDeviceStateUseCase, type SyncDeviceStateDependencies } from '../../packages/devices/application/syncDeviceStateUseCase';

export function buildModbusModule(dbPath: string, homes: HomeRepository, sync: Omit<SyncDeviceStateDependencies, 'idGenerator' | 'clock'>): ModbusService {
  return new ModbusService(new SQLiteModbusRepository(dbPath), new DefaultPlcTransportRegistry().register('modbus-tcp', new ModbusTcpClient()), sync.deviceRepository, homes,
    (deviceId, state) => syncDeviceStateUseCase(deviceId, state, `modbus:${deviceId}`, {
      ...sync, idGenerator: { generate: randomUUID }, clock: { now: () => new Date().toISOString() },
    }));
}
