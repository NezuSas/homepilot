# Tasks: Automation Engine V2 (Sistema Event-Driven)

## 1. Ajustes Transversales de Eventos
- [ ] Incorporar la interfaz `SystemStateChangeEvent` obligatoria. Modificar a los propagadores (HomeAssistantRealtimeSyncManager) para nutrir con `eventId`, `source`, `occurredAt`, `previousState` (si factible) y los campos base.

## 2. Core del Motor de Automatización
- [ ] Programar `packages/automation/application/AutomationEngine.ts`.
- [ ] Elaborar capa de memoria de deduplicación limitada (Loop Prevention) mediante un Set cache de firmas (`ruleId:targetId:command:timestamp`) bloqueando reflejos dentro de ventana de 2 segundos.
- [ ] Centralizar interfaz con método `handleSystemEvent(event: SystemStateChangeEvent)`.
- [ ] Recabar reglas limitadas condicionales. Aislar la evaluación al `trigger.deviceId` pertinente en un try-catch envolvente sobre la iteración para prevenir apagados generales si un Dispatcher crashea.

## 3. Data y Registros Estructurados
- [ ] Garantizar recolección exhaustiva en `ActivityLogRepository` con `ruleId`, `targetDeviceId`, `command`, `eventId` adjuntados limpiamente en `.data` del `ActivityRecord`.
- [ ] Mapear los flags estandarizados de `status` (`success`, `error`, `skipped_loop_prevention`, `skipped_no_match`).

## 4. Composition Root (Bootstrap y Conectividad)
- [ ] Inicializar y pasar el Dispatcher y Repositorios al Motor.
- [ ] Enchufar usando `removeAllListeners('system_event')` precedido de un `.on('system_event', ...)`.

## 5. Testing Masivo Integral
- [ ] Códificar pruebas atadas validando el Macheo Limpio (`turn_on` a HA mock).
- [ ] Testear No Match inactivo.
- [ ] Testear Rebote/Eco Duplicado con disparadores sub 200ms validando descarte lógico.
- [ ] Testear Evento Malformado/Ausencia de Key sin romper loop de test.
- [ ] Testear rotura de Dispatch Simulada asumiendo sobrepaso controlado.
