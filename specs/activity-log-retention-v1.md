# SPEC: Retención y ruido del registro de actividad V1

**Estado:** Aprobado
**Fecha:** 2026-10-12
**Dependencias:** `observability-diagnostics-v1.md`

## Problema

En una instalación real de oficina (HomePilot con Home Assistant, Modbus y cámaras) la tabla `activity_logs` llegó a **18,8 millones de filas y 9,2 GB** en cuatro meses, y el disco quedó al 88 %. Tres causas, todas del producto:

1. El motor de automatizaciones guarda una fila `AUTOMATION_EXECUTED` con estado `skipped_no_match` por **cada evento que no coincide con cada regla**. Con dos reglas y miles de eventos por hora fueron 8,3 millones de filas sin información útil.
2. Cada cambio de un sensor numérico (carga de CPU, memoria, temperatura de GPU) guarda una fila `STATE_CHANGED`: 10,5 millones de filas. Ningún lector usa ese historial; el estado vigente ya vive en el dispositivo.
3. No existe retención: el registro crece sin límite. Además la tabla no tiene ningún índice (solo la clave primaria), de modo que el historial por dispositivo, el diagnóstico y cualquier limpieza recorren la tabla completa.

## Alcance

- Dejar de guardar las filas que no aportan información (no coincidencia de reglas y cambios de sensores numéricos).
- Retención automática y acotada del registro, con plazos distintos para el ruido operativo y para la auditoría.
- Índices para las consultas reales del registro.
- Sin cambios para el resto de eventos (comandos, escenas, usuarios, resiliencia) ni en la API.

Fuera de alcance: exportar el registro, compactación automática del archivo SQLite y retención configurable por la consola.

## Requisitos

- **REQ-01:** El motor de automatizaciones no guarda ninguna fila cuando un evento no coincide con una regla. Sigue guardando las ejecuciones, los fallos y las omisiones por prevención de bucles o por estado ya alcanzado.
- **REQ-02:** Un cambio de estado de un dispositivo de tipo `sensor` no se guarda en el registro de actividad, ni desde la sincronización por WebSocket de Home Assistant ni desde la sincronización de estado de la API. Los cambios de los demás tipos (incluido `binary_sensor`) se siguen guardando. El estado vigente del dispositivo se actualiza igual.
- **REQ-03:** Un servicio de retención borra, por lotes acotados y cediendo el control entre lotes, las filas más antiguas que el plazo de su clase: `STATE_CHANGED` y `AUTOMATION_EXECUTED` a 7 días (`HOMEPILOT_ACTIVITY_NOISE_RETENTION_DAYS`) y el resto a 90 días (`HOMEPILOT_ACTIVITY_RETENTION_DAYS`). Los valores no válidos usan el plazo por defecto. Se ejecuta poco después de arrancar y cada 6 horas, y un fallo no detiene la API.
- **REQ-04:** La migración `037_activity_log_indexes.sql` crea los índices `activity_logs(timestamp)`, `activity_logs(device_id, timestamp)` y `activity_logs(type, timestamp)`, sin modificar datos.
- **REQ-05:** El borrado nunca elimina filas dentro de su plazo ni de otra clase, y reporta cuántas filas borró.
- **REQ-06:** Otras tres fuentes de crecimiento sin límite quedan acotadas, sin cambiar ninguna API. (a) Cada copia de seguridad creada con éxito por `DatabaseBackupService` conserva solo las últimas `HOMEPILOT_BACKUP_KEEP` copias propias del servicio (por defecto 5, mínimo 1); nunca borra archivos que no empiecen por `homepilot-backup-` ni la copia recién creada, y un fallo al borrar se reporta sin invalidar la copia nueva. (b) Al guardar una revisión de un tablero se conservan solo las 100 revisiones más recientes de ese tablero. (c) Al iniciar una sesión se borran las sesiones que vencieron hace más de un día.

## Criterios de aceptación

- [x] **AC1:** Las pruebas del motor confirman que un evento sin coincidencia no escribe en el registro, y que ejecuciones, fallos y omisiones se siguen registrando.
- [x] **AC2:** Las pruebas de ambos caminos de sincronización confirman que un `sensor` no escribe `STATE_CHANGED` y que un `switch` o `binary_sensor` sí.
- [x] **AC3:** Las pruebas del servicio de retención cubren plazos distintos por clase, lotes, valores inválidos, repetición periódica y tolerancia a fallos.
- [x] **AC4:** Las pruebas del repositorio SQLite confirman que el borrado respeta el plazo, la clase y el límite del lote, y que la migración añade los índices sobre una base con datos.
- [x] **AC5:** Las pruebas de `DatabaseBackupService` confirman que solo se conservan las últimas copias propias, que archivos ajenos y la copia nueva nunca se borran, y que el valor por defecto es 5.
- [x] **AC6:** Las pruebas del repositorio de tableros confirman que cada tablero conserva sus 100 revisiones más recientes sin tocar las de otros tableros.
- [x] **AC7:** Las pruebas del repositorio de sesiones confirman que se borran las vencidas hace más de un día y que las vigentes y las recién vencidas se conservan.

## Procedimiento para una instalación que ya creció

Antes de actualizar una instalación con un registro enorme: liberar la caché de compilación de Docker, hacer una copia con `VACUUM INTO`, ejecutar con la API detenida un borrado único del ruido antiguo y generar el archivo compacto con `VACUUM INTO`. Después se actualiza el código; la migración de índices se aplica sobre una tabla ya pequeña.

## Estrategia de compatibilidad y reversión

La migración solo añade índices. Revertir el código deja los índices sin uso. El borrado por retención es irreversible para las filas que elimina; los plazos por defecto conservan 7 días de ruido y 90 días de auditoría.

## Evidencia

- `packages/system-observability/application/ActivityLogRetentionService.ts`, `SQLiteActivityLogRepository.ts` (`deleteOlderThan`), `AutomationActivityLogger.ts`, `StateEventProcessor.ts`, `syncDeviceStateUseCase.ts`, `packages/devices/domain/activityPolicy.ts` y `migrations/037_activity_log_indexes.sql`.
- `DatabaseBackupService.ts`, `SQLiteDashboardRepository.ts` y `SqliteSessionRepository.ts` (REQ-06), con `DatabaseBackupRetention.test.ts`, `DashboardRevisionRetention.test.ts` y `SqliteSessionRetention.test.ts`.
- Pruebas correspondientes en cada paquete.
