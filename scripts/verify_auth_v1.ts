import * as crypto from 'crypto';
import * as assert from 'assert';
import Database from 'better-sqlite3';

import { SqliteUserRepository } from '../packages/auth/infrastructure/SqliteUserRepository';
import { SqliteSessionRepository } from '../packages/auth/infrastructure/SqliteSessionRepository';
import { CryptoService } from '../packages/auth/infrastructure/CryptoService';
import { AuthService } from '../packages/auth/application/AuthService';
import { AuthGuard } from '../packages/auth/infrastructure/AuthGuard';
import { User } from '../packages/auth/domain/User';

async function runTests() {
  console.log('\n=== Verificación Auth & RBAC V1 ===\n');

  // In-memory sqlite for fast testing
  const db = new Database(':memory:');
  
  db.exec(`
    CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
  `);

  const userRepository = new SqliteUserRepository(db);
  const sessionRepository = new SqliteSessionRepository(db);
  const cryptoService = new CryptoService();
  const authService = new AuthService(userRepository, sessionRepository, cryptoService);

  // === Test 1: Bootstrap ===
  const initialHook = await authService.getBootstrapAdmin();
  assert.ok(initialHook !== null, 'Should return hook initially');
  assert.equal(initialHook?.admin.username, 'admin', 'Default admin username should be admin');
  
  const count = await userRepository.count();
  assert.equal(count, 1, 'Should have 1 user inserted');
  
  const secondHook = await authService.getBootstrapAdmin();
  assert.equal(secondHook, null, 'Should not bootstrap again if user exists');
  console.log('  ✅ Bootstrap first admin works');

  // === Test 2: Successful Login ===
  const loginRes = await authService.login('admin', initialHook!.generatedPlaintext);
  assert.ok(loginRes !== null, 'Login with correct credentials should succeed');
  assert.ok(loginRes!.token, 'Should generate a session token');
  console.log('  ✅ Login con credenciales válidas');

  // === Test 3: Failed Login ===
  const badLogin = await authService.login('admin', 'wrong_password_123');
  assert.equal(badLogin, null, 'Login with bad password should fail');
  console.log('  ✅ Rechazo por contraseña inválida');

  // === Test 4: Token Verification (Valid) ===
  const verification = await authService.verifyToken(loginRes!.token);
  assert.equal(verification.isValid, true, 'Token generated should be perfectly valid');
  assert.equal(verification.user?.username, 'admin', 'Token should resolve the admin context');
  console.log('  ✅ Verificación JWT / Opaque session');

  // === Test 5: Token Expiration Flow ===
  const fakeTokenSession = {
    id: 'fake', token: 'fake-token-expired', userId: initialHook!.admin.id,
    expiresAt: new Date(Date.now() - 10000).toISOString(), // Expired
    createdAt: new Date().toISOString()
  };
  await sessionRepository.createSession(fakeTokenSession);
  
  const verifyExpired = await authService.verifyToken('fake-token-expired');
  assert.equal(verifyExpired.isValid, false, 'Expired token should fail validation');
  assert.equal(verifyExpired.reason, 'expired', 'Reason should be explicitly: expired');
  console.log('  ✅ Expiración estricta rechazada 401');

  // === Test 6: Inactive User Flow ===
  const opPass = await cryptoService.hashPassword('operator_pass');
  const inactiveOperator: User = {
    id: 'op-2', username: 'inactive_op', role: 'operator', passwordHash: opPass,
    isActive: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  await userRepository.seedInitialAdmin(inactiveOperator); // acts as insert

  const inactiveLogin = await authService.login('inactive_op', 'operator_pass');
  assert.equal(inactiveLogin, null, 'Login for inactive user should inherently fail inside AuthService');
  console.log('  ✅ Bloqueo de usuarios inactivos / eliminados');

  // === Test 7: RBAC Rule Verification (AuthGuard) ===
  const authGuard = new AuthGuard(authService);
  
  const dummyRes: any = { writeHead: () => ({ end: () => {} }) };
  
  // 7.1 Operator trying to access Admin route
  const opReq: any = { user: { role: 'operator' } };
  const allowedForOperator = authGuard.requireRole(opReq, dummyRes, 'admin');
  assert.equal(allowedForOperator, false, 'Operator should NOT be allowed on admin route');

  // 7.2 Admin trying to access Operator route
  const adminReq: any = { user: { role: 'admin' } };
  const allowedForAdmin = authGuard.requireRole(adminReq, dummyRes, 'operator');
  assert.equal(allowedForAdmin, true, 'Admin should be allowed ANYWHERE');
  console.log('  ✅ RBAC Matrix y Roles Enforcements');

  // === Test 8: Logout and Revocation ===
  await authService.logout(loginRes!.token);
  const verifyRevoked = await authService.verifyToken(loginRes!.token);
  assert.equal(verifyRevoked.isValid, false, 'Revoked token should fail instantly');
  console.log('  ✅ Instant Session Revocation');

  // === Test 9: Change Password Flows ===
  const newLogin = await authService.login('admin', initialHook!.generatedPlaintext);
  const changeRes = await authService.changePassword(initialHook!.admin.id, initialHook!.generatedPlaintext, 'MySuperNewPassword123');
  assert.equal(changeRes.success, true, 'Password change with correct old password should pass');
  
  const checkOldPass = await authService.login('admin', initialHook!.generatedPlaintext);
  assert.equal(checkOldPass, null, 'Old password should now explicitly fail');

  const checkNewPass = await authService.login('admin', 'MySuperNewPassword123');
  assert.ok(checkNewPass !== null, 'New password must function properly');

  const checkOldSession = await authService.verifyToken(newLogin!.token);
  assert.equal(checkOldSession.isValid, false, 'Password change must revoke all prior sessions instantly');
  console.log('  ✅ Cambio de contraseña blindado y sesiones limpiadas');

  console.log('\n=== Completado: 9/9 tests ejecutados y correctos ===\n');
}

runTests().catch(e => {
  console.error('Test falló dramáticamente:', e);
  process.exit(1);
});
