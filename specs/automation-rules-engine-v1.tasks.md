# Tareas Técnicas: Motor de Reglas de Automatización V1 (Automation Rules Engine V1)

Este documento detalla el desglose de tareas para implementar la funcionalidad de automatización básica en HomePilot, siguiendo la arquitectura modular y los principios de diseño establecidos.

## Fase 1: Capa de Dominio (Domain)

### Entidades y Repositorios
- [ ] **T01: Definir `AutomationRule` en `domain/automation/types.ts`**
  - Implementar la interfaz con: `id`, `homeId`, `userId`, `name`, `enabled`, `trigger` (`deviceId`, `stateKey`, `expectedValue`), `action` (`targetDeviceId`, `command`).
- [ ] **T02: Definir `AutomationRuleRepository` en `domain/repositories/`**
  - Interfaz contractual con métodos: `save`, `findById`, `findByTriggerDevice`, `findByHomeId`, `delete`.
- [ ] **T03: Definir nuevos errores de negocio en `domain/errors.ts`**
  - Sugeridos: `AutomationLoopError`, `CrossHomeAutomationError`, `AutomationRuleNotFoundError`.

### Lógica Pura
- [ ] **T04: Factoría de Reglas con Validación en `domain/automation/AutomationRule.ts`**
  - Implementar validación de auto-bucle (mismo `deviceId` y `stateKey` en trigger y action).
  - Asegurar que el `expectedValue` sea estrictamente `string | number | boolean`.

---

## Fase 2: Capa de Infraestructura (Infrastructure)

- [ ] **T05: Implementar `InMemoryAutomationRuleRepository`**
  - Ubicación: `infrastructure/repositories/InMemoryAutomationRuleRepository.ts`.
  - Debe soportar el filtrado por `triggerDeviceId` eficientemente.

---

## Fase 3: Capa de Aplicación (Application)

### Gestión (CRUD)
- [ ] **T06: Implementar `CreateAutomationRuleUseCase`**
  - Validar existencia de ambos dispositivos (`trigger` y `target`) en el mismo `homeId`.
  - Validar Ownership del `homeId` para el `userId` solicitante.
  - Almacenar el `userId` en la regla para uso futuro en ejecuciones automáticas.
- [ ] **T07: Implementar `ListAutomationRulesUseCase`**
  - Filtrar por `homeId` y validar ownership.
- [ ] **T08: Implementar `DeleteAutomationRuleUseCase`**
  - Validar ownership antes de eliminar.

### Motor de Evaluación (Engine)
- [ ] **T09: Implementar `AutomationEngine` (Suscriptor de Eventos)**
  - Ubicación: `application/automation/AutomationEngine.ts`.
  - Debe suscribirse a `DeviceStateUpdatedEvent` (vía `EventPublisher` o `EventBus` existente).
  - Al recibir un evento:
    1. Buscar reglas activas para el `deviceId` del evento.
    2. Evaluar si el nuevo estado coincide con `trigger.stateKey` y `trigger.expectedValue`.
    3. Si coincide, invocar `executeDeviceCommandUseCase`.
- [ ] **T10: Integrar Contexto de Seguridad e Identidad**
  - Asegurar que `AutomationEngine` recupere el `userId` de la regla para el chequeo de ownership en la ejecución.
- [ ] **T11: Implementar Logging de Auditoría Especial con Prefijos**
  - Modificar localmente (o pasar parámetros a) `executeDeviceCommandUseCase` para soportar la descripción: `Triggered by Automation: [Rule Name]`.
  - Capturar fallos de ejecución automática y registrar `AUTOMATION_FAILED` en el `ActivityLogRepository`.

---

## Fase 4: Capa API

- [ ] **T12: Crear `AutomationController`**
  - Ubicación: `api/controllers/AutomationController.ts`.
  - Handlers: `createRule`, `listRules`, `deleteRule`.
- [ ] **T13: Mapear errores en `api/core/errorHandler.ts`**
  - `CrossHomeAutomationError` -> 400 Bad Request.
  - `AutomationLoopError` -> 400 Bad Request.
  - `AutomationRuleNotFoundError` -> 404 Not Found.

---

## Fase 5: Capa de Pruebas (Testing)

### Unitarias & Integración
- [ ] **T14: Pruebas de Dominio (`automation_domain.test.ts`)**
  - Validar prevención de bucles y tipos de datos del trigger.
- [ ] **T15: Pruebas de Casos de Uso CRUD (`automation_crud.test.ts`)**
  - Validar AC1 y AC4 (Zero-Trust).
- [ ] **T16: Pruebas del Motor (`automation_engine.test.ts`)**
  - Simular `DeviceStateUpdatedEvent`.
  - Verificar AC2 (ejecución correcta) y AC3 (registro de fallo ante incompatibilidad).

### End-to-End (E2E)
- [ ] **T17: Escenarios E2E en `automation_e2e.test.ts`**
  - Flujo completo: Discovery -> Assign -> Create Rule -> Sync State -> Verify Action Log.
  - Verificar AC5 (rechazo de reglas recursivas).

---

## Orden de Ejecución Sugerido
1. Fase 1 (Dominio) -> Establece el contrato.
2. Fase 2 (Infra) -> Soporte de datos para tests.
3. T06-T08 (CRUD) -> Permite configurar el sistema.
4. T09-T11 (Engine) -> Núcleo de la funcionalidad.
5. Fase 4 (API) -> Punto de entrada.
6. Fase 5 (Tests) -> Validar conforme se desarrolla (TDD recomendado).

## Criterios de Aceptación (Vinculantes)
- [ ] **AC1**: Creación válida persiste la regla vinculando dispositivos del mismo hogar.
- [ ] **AC2**: Se dispara el comando automáticamente al detectar el cambio de estado disparador.
- [ ] **AC3**: Fallos por capacidades (incompatibilidad) quedan registrados como `AUTOMATION_FAILED`.
- [ ] **AC4**: Intentar gestionar o ejecutar reglas de hogares ajenos resulta en `403 Forbidden`.
- [ ] **AC5**: No se permiten reglas donde el trigger y el target sean el mismo dispositivo y propiedad.
