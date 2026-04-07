import { SqliteDatabaseManager } from '../packages/shared/infrastructure/database/SqliteDatabaseManager';
import * as crypto from 'crypto';

/**
 * Script de seeding para el entorno de desarrollo local.
 * Población mínima para validación de la Operator Console V1.
 */
export async function seed(dbPath?: string) {
  const finalDbPath = dbPath || process.env.HOMEPILOT_DB_PATH || 'homepilot.local.db';
  console.log(`[Seed] Pobloneando base de datos: ${finalDbPath}`);
  
  const db = SqliteDatabaseManager.getInstance(finalDbPath);
  const now = new Date().toISOString();

  // 1. Home (1)
  db.prepare(`
    INSERT OR IGNORE INTO homes (id, owner_id, name, entity_version, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
  `).run('home-01', 'user-01', 'Mock Home Operator', now, now);

  // 2. Room (1)
  db.prepare(`
    INSERT OR IGNORE INTO rooms (id, home_id, name, entity_version, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
  `).run('room-01', 'home-01', 'Living Room', now, now);

  // 3. Device PENDING (1)
  db.prepare(`
    INSERT OR IGNORE INTO devices (id, home_id, external_id, name, type, vendor, status, room_id, last_known_state, entity_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run('dev-pending-01', 'home-01', 'zigbee:mock:pending', 'New Smart Lamp', 'light', 'MockVendor', 'PENDING', null, null, now, now);

  // 4. Devices ASSIGNED (2)
  db.prepare(`
    INSERT OR IGNORE INTO devices (id, home_id, external_id, name, type, vendor, status, room_id, last_known_state, entity_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run('dev-light-01', 'home-01', 'zigbee:mock:light', 'Main Light', 'light', 'MockVendor', 'ASSIGNED', 'room-01', JSON.stringify({ on: false }), now, now);

  db.prepare(`
    INSERT OR IGNORE INTO devices (id, home_id, external_id, name, type, vendor, status, room_id, last_known_state, entity_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run('dev-sensor-01', 'home-01', 'zigbee:mock:sensor', 'Motion Sensor', 'sensor', 'MockVendor', 'ASSIGNED', 'room-01', JSON.stringify({ occupancy: false }), now, now);

  db.prepare(`
    INSERT OR IGNORE INTO devices (id, home_id, external_id, name, type, vendor, status, room_id, last_known_state, entity_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run('dev-ha-light-01', 'home-01', 'ha:light.kitchen', 'Kitchen HA Light', 'light', 'HomeAssistant', 'ASSIGNED', 'room-01', JSON.stringify({ on: false }), now, now);

  // 5. Automations (1 Enabled, 1 Disabled)
  db.prepare(`
    INSERT OR IGNORE INTO automation_rules (id, home_id, user_id, name, enabled, trigger, action, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'rule-01', 
    'home-01', 
    'user-01', 
    'Night Light Auto On', 
    1, 
    JSON.stringify({ deviceId: 'dev-sensor-01', stateKey: 'occupancy', expectedValue: true }), 
    JSON.stringify({ targetDeviceId: 'dev-light-01', command: 'turn_on' }),
    now, 
    now
  );

  db.prepare(`
    INSERT OR IGNORE INTO automation_rules (id, home_id, user_id, name, enabled, trigger, action, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'rule-02', 
    'home-01', 
    'user-01', 
    'Energy Saver Mock', 
    0, 
    JSON.stringify({ deviceId: 'dev-light-01', stateKey: 'on', expectedValue: true }), 
    JSON.stringify({ targetDeviceId: 'dev-light-01', command: 'turn_off' }),
    now, 
    now
  );

  console.log('[Seed] Poblado con éxito: 1 Home, 1 Room, 3 Devices, 2 Rules.');
}

if (require.main === module) {
  seed().catch(err => {
    console.error('[Seed] Error fatal:', err);
    process.exit(1);
  });
}
