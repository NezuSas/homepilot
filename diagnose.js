const Database = require('better-sqlite3');
const db = new Database('./homepilot.local.db');

const rows = db.prepare('SELECT id, name, actions FROM scenes WHERE name LIKE ?').all('%escritorio%');

rows.forEach(row => {
  console.log('Scene ID:', row.id);
  console.log('Scene Name:', row.name);
  console.log('Actions JSON:', row.actions);
});
