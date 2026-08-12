# Tasks: Automation Engine V2 (Sistema Event-Driven)

## 1. Ajustes Transversales de Eventos
- [x] Definir `SystemStateChangeEvent` y propagar `eventId`, origen, marca temporal, estado anterior y estado nuevo desde `HomeAssistantRealtimeSyncManager`.

## 2. Core del Motor de Automatización
- [x] Implementar `packages/automation/application/AutomationEngine.ts` con `handleSystemEvent(event)`.
- [x] Implementar deduplicación temporal de dos segundos por regla, objetivo, comando y valor esperado.
- [x] Evaluar solo reglas habilitadas del dispositivo disparador y aislar errores por regla para preservar el lote.

## 3. Datos y Registros Estructurados
- [x] Registrar `ruleId`, objetivo, comando, correlación y `eventId` en `ActivityLogRepository`.
- [x] Emitir estados `success`, `error`, `skipped_loop_prevention`, `skipped_target_state_match` y `skipped_no_match`.

## 4. Composition Root y Conectividad
- [x] Inyectar el dispatcher y repositorios requeridos desde `buildAutomationModule.ts`.
- [x] Conectar el sincronizador con `removeAllListeners('system_event')` antes de registrar el listener del motor.

## 5. Evidencia TDD/BDD
- [x] Verificar coincidencia, no coincidencia, rebote concurrente, estado objetivo ya satisfecho, atributos anidados y aislamiento de errores en `automation_engine.test.ts`, `automation_e2e.test.ts` y `automation_scene_service.test.ts`.
