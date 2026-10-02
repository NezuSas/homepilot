import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import type { Device } from '../../../devices/domain/types';
import type { ModbusRepository } from '../application/ModbusPorts';
import { validateConnection, validateVariable, type ModbusConnection, type ModbusVariable } from '../domain/Modbus';
export class SQLiteModbusRepository implements ModbusRepository {
  constructor(private readonly dbPath: string) {}
  private get db() { return SqliteDatabaseManager.getInstance(this.dbPath); }
  connections(homeId?: string): ModbusConnection[] {
    const rows = (homeId === undefined ? this.db.prepare('SELECT * FROM modbus_connections ORDER BY id').all() : this.db.prepare('SELECT * FROM modbus_connections WHERE home_id=? ORDER BY id').all(homeId)) as { id: string; home_id: string; config: string }[];
    return rows.map(row => ({ ...validateConnection(JSON.parse(row.config)), id: row.id, homeId: row.home_id }));
  }
  connection(id: string): ModbusConnection | null { return this.connections().find(c => c.id === id) ?? null; }
  variables(connectionId: string): ModbusVariable[] {
    const rows = this.db.prepare('SELECT * FROM modbus_variables WHERE connection_id=? ORDER BY device_id').all(connectionId) as { device_id: string; connection_id: string; config: string }[];
    return rows.map(row => ({ ...validateVariable(JSON.parse(row.config)), deviceId: row.device_id, connectionId: row.connection_id }));
  }
  variable(deviceId: string): ModbusVariable | null {
    const row = this.db.prepare('SELECT connection_id FROM modbus_variables WHERE device_id=?').get(deviceId) as { connection_id: string } | undefined;
    return row ? this.variables(row.connection_id).find(v => v.deviceId === deviceId) ?? null : null;
  }
  saveConnection(connection: ModbusConnection): void {
    this.db.prepare('INSERT INTO modbus_connections(id,home_id,config) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config').run(connection.id,connection.homeId,JSON.stringify(connection));
  }
  saveVariable(variable: ModbusVariable, device: Device): void {
    this.db.transaction(() => {
      this.db.prepare(`INSERT INTO devices(id,home_id,room_id,external_id,name,type,vendor,status,integration_source,invert_state,last_known_state,entity_version,created_at,updated_at,semantic_type)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,semantic_type=excluded.semantic_type,entity_version=excluded.entity_version,updated_at=excluded.updated_at`)
        .run(device.id,device.homeId,device.roomId,device.externalId,device.name,device.type,device.vendor,device.status,device.integrationSource,0,JSON.stringify(device.lastKnownState),device.entityVersion,device.createdAt,device.updatedAt,device.semanticType ?? null);
      this.db.prepare('INSERT INTO modbus_variables(device_id,connection_id,config) VALUES (?,?,?) ON CONFLICT(device_id) DO UPDATE SET config=excluded.config').run(variable.deviceId,variable.connectionId,JSON.stringify(variable));
    })();
  }
}
