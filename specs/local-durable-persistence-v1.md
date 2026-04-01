# SPEC: Persistencia Durable Local V1 (Local Durable Persistence V1)

**Estado:** Borrador  
**Autor:** Antigravity (IA Architect)  
**Fecha:** 2026-03-31

## 1. Declaración del Problema (Problem Statement)

HomePilot opera actualmente utilizando repositorios `In-Memory`. Si bien esto ha permitido una velocidad de desarrollo y testeo alta para las reglas de negocio, no es viable para un producto real que se despliega en una miniPC (Edge). Cualquier reinicio del sistema, corte de energía o actualización del servicio resulta en la pérdida total de la configuración del hogar, los dispositivos descubiertos, las reglas de automatización y el historial de eventos. Para garantizar la confiabilidad en un entorno doméstico, HomePilot requiere una capa de persistencia duradera, local y ligera basada en SQLite.

## 2. Alcance (Scope)

*   **Persistencia de Topología**: Guardado durable e independiente de `Homes` y `Rooms`, respetando la separación de puertos actual.
*   **Persistencia de Dispositivos**: Almacenamiento de dispositivos en el `Inbox` y dispositivos asignados.
*   **Persistencia de Estado**: El `lastKnownState` de cada dispositivo debe sobrevivir a reinicios.
*   **Persistencia de Automatización**: Las reglas de automatización y su estado (`enabled`/`disabled`).
*   **Historial de Actividad**: El `ActivityLog` debe ser persistente y consultable tras reinicios.
*   **Motor de Base de Datos**: Uso exclusivo de **SQLite** para esta V1 local.
*   **Migraciones de Esquema**: Sistema básico para crear y evolucionar las tablas en el arranque.

## 3. Fuera de Alcance (Out of Scope)

*   Sincronización con la nube (Cloud Sync).
*   Multi-tenancy centralizado (un SQLite por instalación/miniPC es el foco).
*   Alta disponibilidad o replicación.
*   Cifrado de base de datos en reposo.
*   Motores externos como PostgreSQL o MongoDB en esta fase.
*   Backups automáticos a almacenamiento externo (Cloud backup).

## 4. Requisitos Funcionales (Functional Requirements)

### Durabilidad de Core
*   **REQ-01: Persistencia de Topología**: Al crear un hogar o habitación, los datos deben escribirse inmediatamente en disco. Al reiniciar, el sistema debe cargar la estructura jerárquica existente.
*   **REQ-02: Inventario de Dispositivos**: Los dispositivos descubiertos (Inbox) y los asignados no deben desaparecer tras un reboot. Sus metadatos (tipo, nombre, roomId) deben ser restaurados.
*   **REQ-03: Continuidad de Estado**: El sistema debe arrancar con el último `lastKnownState` persistido para cada dispositivo, permitiendo al motor de automatización tener contexto inmediato tras el reinicio.
*   **REQ-04: Persistencia de Automatizaciones**: Todas las reglas creadas, incluyendo su configuración de `enabled/disabled`, deben ser cargadas al iniciar el servicio.

### Trazabilidad y Operación
*   **REQ-05: Historial Durable**: El `ActivityLog` debe permitir auditoría histórica persistente, incluyendo los payloads estructurados de los eventos.
*   **REQ-06: Semántica Upsert vs Append**:
    *   **Upsert**: Los repositorios de `Home`, `Room`, `Device` y `AutomationRule` usan el método `save()` con semántica de **upsert** (reemplazar si el ID ya existe).
    *   **Append-only**: El repositorio de `ActivityLog` es estrictamente de **sólo-inserción** (append-only); los registros no se modifican ni se reemplazan.
*   **REQ-07: Inicialización Automática**: El sistema debe crear el archivo de base de datos y las tablas necesarias automáticamente si no existen durante el proceso de arranque (Bootstrapping).

## 5. Requisitos No Funcionales (Non-Functional Requirements)

*   **NFR-01: Local-First**: La base de datos reside físicamente en el almacenamiento de la miniPC local.
*   **NFR-02: Zero-Dependency**: No se requiere de un servidor de base de datos externo instalado en el SO (SQLite es embebido en el binario/proceso).
*   **NFR-03: Performance Realista**: La latencia para operaciones de escritura atómicas debe ser inferior a **5ms (p95)** en hardware típico de miniPC local (ej. Raspberry Pi 4/5 o similar), asegurando que el sistema se sienta "instántaneo" para el usuario final.
*   **NFR-04: Integridad Arquitectónica**: La persistencia debe implementarse como adaptadores (`SQLite...Repository`) de los puertos definidos en el dominio, sin contaminar las capas de aplicación o dominio.

## 6. Modelo Conceptual de Datos

### Tablas Principales
*   **`homes`**: `id (PK)`, `owner_id (FK_USER)`, `name`, `created_at`, `updated_at`.
*   **`rooms`**: `id (PK)`, `home_id (FK)`, `name`, `created_at`, `updated_at`.
*   **`devices`**: `id (PK)`, `home_id (FK)`, `room_id (FK_NULL)`, `external_id`, `name`, `type`, `vendor`, `status`, `last_known_state (JSON)`, `entity_version`, `created_at`, `updated_at`.
*   **`automation_rules`**: `id (PK)`, `home_id (FK)`, `user_id`, `name`, `enabled`, `trigger (JSON)`, `action (JSON)`, `created_at`, `updated_at`.
*   **`activity_logs`**: `id (PK)`, `device_id (FK)`, `type`, `description`, `data (JSON)`, `timestamp`, `correlation_id`.

### Columnas JSON
Los campos marcados como `JSON` (`last_known_state`, `trigger`, `action`, `data`) se serializan y deserializan de forma **transparente y determinista** por los adapters SQLite. La capa de aplicación siempre recibe objetos tipados, nunca strings serializados manualmente.

### Gestión de Metadata (Auditoría Técnica)
Las columnas `created_at` y `updated_at` en las tablas persistentes son **metadatos de infraestructura** gestionados exclusivamente por los adapters SQLite. No forman parte de las entidades de dominio para evitar drifts y mantener los modelos de negocio puramente lógicos.

## 7. Semántica de Persistencia

*   **Topology/Devices/Rules**: Se persiste cada vez que ocurre un cambio (save/delete).
*   **LastKnownState**: Se persiste en cada evento `DeviceStateUpdated` para garantizar que la "foto" actual sea siempre durable.
*   **ActivityLog**: Sólo-inserción (Append-only).

## 8. Estrategia de Repositorios (Adapters)

Se implementarán los siguientes adaptadores concretos en `infrastructure/repositories/sqlite/`, cada uno respondiendo a su puerto contractual de dominio:
*   **`SQLiteHomeRepository`**: Implementa `HomeRepository`.
*   **`SQLiteRoomRepository`**: Implementa `RoomRepository`.
*   **`SQLiteDeviceRepository`**: Implementa `DeviceRepository`.
*   **`SQLiteAutomationRuleRepository`**: Implementa `AutomationRuleRepository`.
*   **`SQLiteActivityLogRepository`**: Implementa `ActivityLogRepository`.

## 9. Estrategia de Migraciones

HomePilot contará con un sistema básico de migraciones:
*   Cada cambio de esquema se define en un archivo secuencial (ej. `001_initial_schema.sql`).
*   Se utilizará una tabla `_migrations` para registrar qué scripts han sido ya ejecutados.
*   El proceso de arranque ejecutará automáticamente las migraciones pendientes antes de exponer la API.

## 10. Criterios de Aceptación (Acceptance Criteria)

*   **AC1: Persistencia con Ownership**: Crear un hogar con un `owner_id` específico, reiniciar, y verificar que los datos de propiedad persisten correctamente.
*   **AC2: Persistencia de Estado**: Dado un dispositivo con un estado específico, cuando el sistema se apaga y se enciende, el valor de `lastKnownState` debe ser recuperado íntegro de la DB local.
*   **AC3: Auditoría Expandida Post-Reinicio**: El `ActivityLog` debe mostrar registros realizados antes del reinicio, incluyendo el campo `data` JSON con el payload original.
*   **AC4: Robustez de Arranque**: El sistema debe ser capaz de crear su propia base de datos (.db) desde cero en un entorno de miniPC recién instalado.

## 11. Notas Técnicas y Arquitectura

*   **SQLite vs Postgres**: En un despliegue Edge (miniPC), SQLite ofrece la ventaja de "cero-configuración", requiere mínimos recursos y es extremadamente portátil. La arquitectura modular asegura que si el sistema escala a una versión Cloud masiva, el cambio a Postgres sea transparente para el resto del código.
*   **JSON Support**: Se utilizará el soporte nativo de JSON de SQLite para campos flexibles, simplificando el esquema inicial sin perder rigor en los tipos de dominio.

## 12. Preguntas abiertas / TODOs

*   [ ] ¿Cuál será la política de retención de logs para evitar el crecimiento excesivo en el disco de la miniPC?
*   [ ] ¿Necesitamos implementar WAL (Write-Ahead Logging) para mejorar la concurrencia en la miniPC?
*   [ ] ¿Cómo se expondrá la funcionalidad de "Exportar/Importar Base de Datos" para backups manuales del usuario?
