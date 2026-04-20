const Database = require('better-sqlite3');
const db = new Database('homepilot.local.db'); 

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables);
  
  const logs = db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 5').all();
  console.log('Logs:', JSON.stringify(logs, null, 2));
} catch (e) {
  console.error(e.message);
} finally {
  db.close();
}
