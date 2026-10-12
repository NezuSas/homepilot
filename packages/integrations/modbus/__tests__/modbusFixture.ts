import { readFileSync, mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import { SQLiteDeviceRepository } from '../../../devices/infrastructure/repositories/SQLiteDeviceRepository';
import { SQLiteHomeRepository } from '../../../topology/infrastructure/repositories/SQLiteHomeRepository';
import { SQLiteModbusRepository } from '../infrastructure/SQLiteModbusRepository';
import { ModbusService } from '../application/ModbusService';
import type { ModbusTransport } from '../application/ModbusPorts';

/** A PLC service over a throwaway database and a mocked transport, shared by the Modbus suites. */
export function modbusFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'homepilot-modbus-'));
  const dbPath = join(directory, 'test.db');
  const db = SqliteDatabaseManager.getInstance(dbPath);
  for (const file of ['001_initial_schema.sql', '006_add_invert_state_to_devices.sql', '015_add_device_integration_source.sql', '022_add_semantic_type_to_devices.sql', '035_modbus_tcp.sql']) db.exec(readFileSync(join(process.cwd(), 'migrations', file), 'utf8'));
  db.prepare('INSERT INTO homes(id,owner_id,name) VALUES (?,?,?)').run('h', 'admin', 'Home');
  const repository = new SQLiteModbusRepository(dbPath), devices = new SQLiteDeviceRepository(dbPath), homes = new SQLiteHomeRepository(dbPath);
  const transport: jest.Mocked<ModbusTransport> = { readRange: jest.fn().mockResolvedValue([42]), read: jest.fn().mockResolvedValue(42), writeCoil: jest.fn().mockResolvedValue(undefined), writeHoldingRegisters: jest.fn().mockResolvedValue(undefined) };
  const publish = jest.fn(async (id: string, state: Record<string, unknown>) => { const device = await devices.findDeviceById(id); if (device) await devices.saveDevice({ ...device, lastKnownState: state }); });
  const service = new ModbusService(repository, { transportFor: () => transport }, devices, homes, publish);
  const cleanup = () => { SqliteDatabaseManager.close(dbPath); for (const name of readdirSync(directory)) unlinkSync(join(directory, name)); rmdirSync(directory); };
  return { db, dbPath, repository, devices, transport, publish, service, cleanup };
}
