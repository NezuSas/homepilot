# Tareas Técnicas: Persistencia Durable Local V1 (SQLite)

## Implementación y trazabilidad

- [x] **T.1.1–T.1.4: Infraestructura SQLite y migraciones.** etter-sqlite3, packages/shared/infrastructure/database/SqliteDatabaseManager.ts, SqliteMigrationsRunner.ts y migrations/ crean y evolucionan el esquema mediante _migrations.
- [x] **T.2.1–T.2.2: Persistencia de topología.** SQLiteHomeRepository y SQLiteRoomRepository implementan los puertos con upsert; evidencia en packages/topology/__tests__/SQLiteTopologyPersistence.test.ts.
- [x] **T.3.1–T.3.2: Inventario, estado y actividad.** SQLiteDeviceRepository y SQLiteActivityLogRepository preservan JSON y semántica append-only; evidencia en packages/devices/__tests__/SQLiteDevicesPersistence.test.ts.
- [x] **T.4.1: Persistencia de automatizaciones.** SQLiteAutomationRuleRepository serializa/deserializa trigger y action tipados; evidencia en packages/devices/__tests__/SQLiteDevicesPersistence.test.ts.
- [x] **T.5.1–T.5.2: Integración en bootstrap.** infrastructure/assemblers/buildDatabase.ts aplica migraciones antes de uildRepositories.ts; ootstrap.ts inyecta exclusivamente adaptadores SQLite.
- [x] **T.6.1–T.6.2: Integración y reinicio.** __tests__/bootstrap.test.ts verifica una base nueva y, después de cerrar conexiones, la recuperación de ownership, estado, regla y actividad con JSON tipado.
- [x] **Compatibilidad Docker Desktop.** packages/shared/infrastructure/database/__tests__/SqliteDatabaseManager.test.ts cubre HOMEPILOT_SQLITE_JOURNAL_MODE=DELETE sin sidecars WAL/SHM.
- [ ] **T.6.3: Rendimiento en miniPC.** Medir NFR-03 (<5 ms p95) en Raspberry Pi 4/5 o hardware equivalente. No es sustituible por un resultado de Windows/Docker Desktop.

## Dependencias críticas

La persistencia se ensambla en este orden: conexión SQLite, migraciones, repositorios, módulos de aplicación y API. Las pruebas de reinicio ejercen esa secuencia completa.