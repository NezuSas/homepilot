import { AuthService } from './packages/auth/application/AuthService';
import { SqliteUserRepository } from './packages/auth/infrastructure/SqliteUserRepository';
import { SqliteDatabaseManager } from './packages/shared/infrastructure/database/SqliteDatabaseManager';
import { CryptoService } from './packages/auth/infrastructure/CryptoService';
import * as fs from 'fs';
import * as path from 'path';

async function runTest() {
  const cryptoService = new CryptoService();

  // --- TEST 1: DEV BOOTSTRAP ---
  console.log('--- TEST 1: DEV BOOTSTRAP (HOMEPILOT_DEV_BOOTSTRAP=true) ---');
  const dbPath1 = path.join(__dirname, 'test_1.db');
  if (fs.existsSync(dbPath1)) fs.unlinkSync(dbPath1);
  
  const db1 = SqliteDatabaseManager.getInstance(dbPath1);
  db1.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, role TEXT, is_active INTEGER, created_at TEXT, updated_at TEXT)').run();
  
  const authService1 = new AuthService(new SqliteUserRepository(db1), null as any, cryptoService);
  const resultDev = await authService1.getBootstrapAdmin(true);
  
  if (resultDev && !resultDev.generatedPlaintext && resultDev.admin.username === 'admin') {
    const loginOk = await cryptoService.verifyPassword('admin', resultDev.admin.passwordHash);
    console.log(`  ✅ Dev Bootstrap OK: username=admin, password=admin (hash verified: ${loginOk})`);
  } else {
    throw new Error('Dev Bootstrap Failed');
  }

  // --- TEST 2: RESTART ---
  console.log('--- TEST 2: RESTART (Users already exist) ---');
  const resultRestart = await authService1.getBootstrapAdmin(true);
  if (resultRestart === null) {
    console.log('  ✅ Restart OK: Bootstrap ignored when users exist');
  } else {
    throw new Error('Restart Failed');
  }

  SqliteDatabaseManager.close();
  if (fs.existsSync(dbPath1)) fs.unlinkSync(dbPath1);

  // --- TEST 3: PROD BOOTSTRAP ---
  console.log('\n--- TEST 3: PROD BOOTSTRAP (HOMEPILOT_DEV_BOOTSTRAP=false) ---');
  const dbPath2 = path.join(__dirname, 'test_3.db');
  if (fs.existsSync(dbPath2)) fs.unlinkSync(dbPath2);
  
  const db2 = SqliteDatabaseManager.getInstance(dbPath2);
  db2.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, role TEXT, is_active INTEGER, created_at TEXT, updated_at TEXT)').run();
  
  const authService2 = new AuthService(new SqliteUserRepository(db2), null as any, cryptoService);
  const resultProd = await authService2.getBootstrapAdmin(false);
  
  if (resultProd && resultProd.generatedPlaintext && resultProd.generatedPlaintext.length >= 16) {
    const loginOk = await cryptoService.verifyPassword(resultProd.generatedPlaintext, resultProd.admin.passwordHash);
    console.log(`  ✅ Prod Bootstrap OK: username=admin, password=[RANDOM] (length: ${resultProd.generatedPlaintext.length}, hash verified: ${loginOk})`);
  } else {
    throw new Error('Prod Bootstrap Failed');
  }

  SqliteDatabaseManager.close();
  if (fs.existsSync(dbPath2)) fs.unlinkSync(dbPath2);
  
  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===');
}

runTest().catch(err => {
    console.error(`\n❌ TEST FAILED: ${err.message}`);
    process.exit(1);
});
