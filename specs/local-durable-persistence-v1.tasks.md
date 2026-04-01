# Tareas Técnicas: Persistencia Durable Local V1 (SQLite)

Este documento detalla el desglose de tareas para implementar la persistencia durable en HomePilot v1, basado en la especificación aprobada `local-durable-persistence-v1.md`.

## Fase 1: Infraestructura de Persistencia Base (SQLite + Migrations)

Estas tareas preparan el terreno para que cualquier repositorio pueda interactuar con disco.

- [ ] **T.1.1: Instalación de dependencias de persistencia**
  - Instalar `sqlite3` y un query builder ligero (Ej. `knex` o `better-sqlite3`).
  - Justificación: Simplicidad en miniPC y soporte robusto para JSON.
- [ ] **T.1.2: Implementar el Database Manager (SQLite Connection)**
  - Crear `infrastructure/core/SqliteDatabaseManager.ts`.
  - Responsabilidad: Gestionar el singleton de conexión al archivo `.db`.
- [ ] **T.1.3: Implementar el sistema de Migraciones**
  - Crear motor de ejecución en `infrastructure/core/SqliteMigrationsRunner.ts`.
  - Debe leer de un directorio `/migrations` y gestionar la tabla `_migrations`.
- [ ] **T.1.4: Definir Esquema Inicial (001_initial_schema.sql)**
  - Crear tablas: `homes`, `rooms`, `devices`, `automation_rules`, `activity_logs`.
  - Incluir columnas de auditoría técnica (`created_at`, `updated_at`) como metadatos.

## Fase 2: Implementación de Repositorios de Topología

Sustitución de los adaptadores InMemory por adaptadores SQLite para la estructura del hogar.

- [ ] **T.2.1: Crear SQLiteHomeRepository**
  - Ubicación: `packages/topology/infrastructure/repositories/SQLiteHomeRepository.ts`.
  - Contrato: `HomeRepository`.
  - Semántica: `saveHome()` como **upsert**.
  - Incluir mapeo de `owner_id`.
- [ ] **T.2.2: Crear SQLiteRoomRepository**
  - Ubicación: `packages/topology/infrastructure/repositories/SQLiteRoomRepository.ts`.
  - Contrato: `RoomRepository`.
  - Semántica: `saveRoom()` como **upsert**.

## Fase 3: Implementación de Repositorios de Dispositivos y Logs

Gestión persistente del inventario físico y la auditoría de eventos.

- [ ] **T.3.1: Crear SQLiteDeviceRepository**
  - Ubicación: `packages/devices/infrastructure/repositories/SQLiteDeviceRepository.ts`.
  - Contrato: `DeviceRepository`.
  - Semántica: `saveDevice()` como **upsert**.
  - **Serialización JSON**: `last_known_state` se guarda/lee como objeto JSON nativo.
- [ ] **T.3.2: Crear SQLiteActivityLogRepository**
  - Ubicación: `packages/devices/infrastructure/repositories/SQLiteActivityLogRepository.ts`.
  - Contrato: `ActivityLogRepository`.
  - Semántica: `save()` como **append-only** (sólo inserción).
  - Incluir campo `data` (JSON) para el payload estructurado.

## Fase 4: Implementación de Repositorios de Automatización

Asegurar que las reglas sobrevivan a reinicios.

- [ ] **T.4.1: Crear SQLiteAutomationRuleRepository**
  - Ubicación: `packages/devices/infrastructure/repositories/SQLiteAutomationRuleRepository.ts`.
  - Contrato: `AutomationRuleRepository`.
  - **Serialización JSON**: Campos `trigger` y `action` se manejan como objetos tipados mediante serialización automática en el adaptador.
  - Semántica: `save()` como upsert.

## Fase 5: Integración en el Arranque y Bootstrap

Inyección de dependencias durables en la miniPC local.

- [ ] **T.5.1: Actualizar el punto de entrada (Main/Bootstrap)**
  - Inyectar las nuevas instancias `SQLite...Repository` en lugar de las `InMemory...`.
  - Asegurar que la ruta al archivo `.db` se lea de variables de entorno (config.dbPath).
- [ ] **T.5.2: Flujo de Inicialización (Bootstrapping Sequence)**
  - Paso 1: Conectar DB.
  - Paso 2: Ejecutar Migraciones.
  - Paso 3: Arrancar aplicación/API.

## Fase 6: Verificación y Pruebas de Durabilidad

- [ ] **T.6.1: Suite de Pruebas de Integración SQLite**
  - Verificar que los 5 repositorios cumplen con la semántica Upsert/Append-only.
- [ ] **T.6.2: Test de Reinicio (Reboot Simulation Test)**
  - Escenario: Guardar una regla compleja -> Matar proceso -> Arrancar proceso -> Verificar que la regla y el estado del dispositivo persisten.
  - Corresponde a AC1, AC2 y AC3.
- [ ] **T.6.3: Validación de Performance (MiniPC Goal)**
  - Medir latencia de escritura para asegurar cumplimiento de NFR-03 (<5ms p95).

## Dependencias Críticas
1. T.1.x (Infra base) es requisito para cualquier tarea de repositorios (T.2.x, T.3.x, T.4.x).
2. T.5.x (Integración) requiere que todos los repositorios clave estén creados.
3. T.6.x (Tests) debe correr al final para validar la solución completa.
