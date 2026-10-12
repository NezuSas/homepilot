'use strict';
// Writes a compact copy of the HomePilot database and proves it holds the same data before anyone swaps it in.
// Runs inside the API image (it ships better-sqlite3). Paths come from the environment so it can be tested anywhere.
const Database = require('better-sqlite3');
const fs = require('fs');

const sourcePath = process.env.HP_DB_SOURCE || '/app/data/homepilot.db';
const targetPath = process.env.HP_DB_TARGET || '/app/data/homepilot.compact.db';

function fail(message, code) {
  console.error(message);
  process.exit(code);
}

if (!fs.existsSync(sourcePath)) fail(`No existe la base de datos: ${sourcePath}`, 2);
try { fs.unlinkSync(targetPath); } catch { /* there is nothing to replace */ }

const source = new Database(sourcePath, { readonly: true });
source.prepare('VACUUM INTO ?').run(targetPath);
const compact = new Database(targetPath, { readonly: true });

const tables = source.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
const mismatches = [];
for (const table of tables) {
  const before = source.prepare(`SELECT count(*) AS c FROM "${table}"`).get().c;
  const after = compact.prepare(`SELECT count(*) AS c FROM "${table}"`).get().c;
  console.log(`${table}: ${before} -> ${after}`);
  if (before !== after) mismatches.push(table);
}

const integrity = compact.prepare('PRAGMA integrity_check').get().integrity_check;
const indexCount = (database) => database.prepare("SELECT count(*) AS c FROM sqlite_master WHERE type = 'index'").get().c;
const indexesKept = indexCount(source) === indexCount(compact);
const megabytes = Math.round(fs.statSync(targetPath).size / 1048576);
console.log(JSON.stringify({ integrity, tablas: tables.length, indicesIguales: indexesKept, diferencias: mismatches, mb: megabytes }));

source.close();
compact.close();
if (integrity !== 'ok' || mismatches.length > 0 || !indexesKept) {
  try { fs.unlinkSync(targetPath); } catch { /* best effort */ }
  fail('VERIFICACION FALLIDA: la copia compacta no es idéntica; se descartó.', 3);
}
console.log('VERIFICADO');
