# Tareas Técnicas: Gestión de ciclo de vida de reglas de automatización V1 (Automation Rule Lifecycle Management V1)

> **Spec de referencia:** `automation-rule-lifecycle-v1.md`
> **Depende de:** `automation-rules-engine-v1` (completamente implementado)

---

## Orden de Implementación Recomendado

```
Fase 1 (Dominio) → Fase 2 (Infraestructura) → Fase 3 (Aplicación) → Fase 4 (API) → Fase 5 (Tests)
```

---

## Fase 1: Capa de Dominio (Domain)

### Contrato del Repositorio

- [x] **T01: Extender `AutomationRuleRepository` con el método `update`**
  - Archivo: `packages/devices/domain/repositories/AutomationRuleRepository.ts`
  - Agregar: `update(rule: AutomationRule): Promise<void>`
  - La firma debe recibir la entidad completa (inmutable por convención).
  - _Dependencias:_ Ninguna (es la primera pieza del contrato nuevas operaciones).

### Lógica Pura de Actualización

- [x] **T02: Crear función de dominio `updateAutomationRule`**
  - Archivo: `packages/devices/domain/automation/updateAutomationRule.ts`
  - Responsabilidad: aplicar un patch parcial sobre una `AutomationRule` existente.
  - Campos permitidos: `name`, `trigger`, `action`.
  - Campos inmutables: `id`, `homeId`, `userId`.
  - La función debe:
    - Aplicar trimming al `name` si se provee.
    - Rechazar con `InvalidAutomationRuleError` si el `name` resultante queda vacío.
    - Rechazar con `AutomationLoopError` si los nuevos `trigger.deviceId` y `action.targetDeviceId` resultan iguales.
    - Retornar una nueva instancia inmutable (no mutar el objeto original).
  - _Dependencias:_ T01.

---

## Fase 2: Capa de Infraestructura (Infrastructure)

- [x] **T03: Implementar `update` en `InMemoryAutomationRuleRepository`**
  - Archivo: `packages/devices/infrastructure/repositories/InMemoryAutomationRuleRepository.ts`
  - Comportamiento: reemplazar la entrada existente en el mapa interno por la nueva entidad recibida.
  - Si la regla no existe (no hay entrada para el `id`), lanzar `AutomationRuleNotFoundError`.
  - _Dependencias:_ T01.

---

## Fase 3: Capa de Aplicación (Application)

### Enable Rule

- [x] **T04: Implementar `EnableAutomationRuleUseCase`**
  - Archivo: `packages/devices/application/usecases/automation/EnableAutomationRuleUseCase.ts`
  - Pasos:
    1. Obtener la regla mediante `automationRuleRepository.findById(ruleId)`.
    2. Si no existe, lanzar `AutomationRuleNotFoundError`.
    3. Validar ownership: `topologyReferencePort.validateHomeOwnership(rule.homeId, userId)`.
    4. Persistir la regla con `enabled: true` usando `update`.
    5. Retornar la regla actualizada.
  - Si la regla ya estaba `enabled: true`, la operación es idempotente (retorna éxito sin error).
  - _Dependencias:_ T03.

### Disable Rule

- [x] **T05: Implementar `DisableAutomationRuleUseCase`**
  - Archivo: `packages/devices/application/usecases/automation/DisableAutomationRuleUseCase.ts`
  - Pasos:
    1. Obtener la regla.
    2. Si no existe, lanzar `AutomationRuleNotFoundError`.
    3. Validar ownership.
    4. Persistir la regla con `enabled: false`.
    5. Retornar la regla actualizada.
  - Si la regla ya estaba `enabled: false`, la operación es idempotente.
  - _Dependencias:_ T03.

### Update Rule

- [x] **T06: Implementar `UpdateAutomationRuleUseCase`**
  - Archivo: `packages/devices/application/usecases/automation/UpdateAutomationRuleUseCase.ts`
  - Pasos:
    1. Obtener la regla mediante `findById`.
    2. Si no existe, lanzar `AutomationRuleNotFoundError`.
    3. Validar ownership: `topologyReferencePort.validateHomeOwnership(rule.homeId, userId)`.
    4. Si el patch incluye `trigger` o `action`, revalidar dispositivos:
       - Obtener el dispositivo `trigger.deviceId` (nuevo o existente); si no existe, lanzar `DeviceNotFoundError`.
       - Obtener el dispositivo `action.targetDeviceId` (nuevo o existente); si no existe, lanzar `DeviceNotFoundError`.
       - Verificar que ambos pertenecen al mismo `homeId` de la regla; si no, lanzar `InvalidAutomationRuleError`.
    5. Invocar `updateAutomationRule(existing, patch)` del dominio para aplicar el patch y reeditar invariantes (loop prevention, name trimming).
    6. Persistir la regla actualizada usando `update`.
    7. Retornar la regla en su nuevo estado.
  - _Dependencias:_ T02, T03.

---

## Fase 4: Capa API

### Handlers

- [x] **T07: Agregar handler `enableRule` en `AutomationController`**
  - Archivo: `packages/devices/api/controllers/AutomationController.ts`
  - Ruta: `PATCH /rules/:ruleId/enable`
  - Extraer `ruleId` de `req.params` y `userId` del token autenticado.
  - Invocar `EnableAutomationRuleUseCase` y retornar la regla con `statusCode: 200`.
  - _Dependencias:_ T04.

- [x] **T08: Agregar handler `disableRule` en `AutomationController`**
  - Archivo: `packages/devices/api/controllers/AutomationController.ts`
  - Ruta: `PATCH /rules/:ruleId/disable`
  - Extraer `ruleId` de `req.params` y `userId` del token autenticado.
  - Invocar `DisableAutomationRuleUseCase` y retornar la regla con `statusCode: 200`.
  - _Dependencias:_ T05.

- [x] **T09: Agregar handler `updateRule` en `AutomationController`**
  - Archivo: `packages/devices/api/controllers/AutomationController.ts`
  - Ruta: `PATCH /rules/:ruleId`
  - Aplicar narrowing estricto del body (sin `any`):
    - `name` debe ser `string` si está presente.
    - `trigger.expectedValue` debe ser `string | number | boolean` si está presente.
    - `action.command` debe coincidir con `DeviceCommandV1` si está presente.
  - Si el body es vacío o no contiene campos reconocidos, retornar `400 Bad Request`.
  - Invocar `UpdateAutomationRuleUseCase` y retornar la regla actualizada con `statusCode: 200`.
  - _Dependencias:_ T06.

### Mapeo de Errores

- [x] **T10: Verificar mapeos en `errorHandler.ts`**
  - Archivo: `packages/devices/api/core/errorHandler.ts`
  - Los errores `AutomationRuleNotFoundError`, `InvalidAutomationRuleError` y `AutomationLoopError` ya deben estar mapeados desde la implementación V1.
  - Confirmar que no se requieren entradas nuevas. Si falta algún mapeo, añadirlo.
  - _Dependencias:_ T07, T08, T09.

---

## Fase 5: Capa de Pruebas (Testing)

### Pruebas de Dominio

- [x] **T11: Pruebas de `updateAutomationRule` en `automation_domain.test.ts`**
  - Archivo: `packages/devices/__tests__/automation/automation_domain.test.ts`
  - Casos:
    - Actualización parcial de nombre aplica trimming y preserva los demás campos.
    - Nombre vacío tras trimming lanza `InvalidAutomationRuleError`.
    - Actualización que resulta en `trigger.deviceId == action.targetDeviceId` lanza `AutomationLoopError` (vincula a **AC6**).
    - `id`, `homeId` y `userId` son inmutables (ignorados si se incluyen en el patch).
  - _Dependencias:_ T02.

### Pruebas de Aplicación

- [x] **T12: Pruebas de `EnableAutomationRuleUseCase` y `DisableAutomationRuleUseCase`**
  - Archivo: `packages/devices/__tests__/automation/automation_lifecycle.test.ts`
  - Casos para enable/disable:
    - Éxito: regla pasa de `enabled:false` a `enabled:true` y viceversa (vincula a **AC1**, **AC2**).
    - Idempotencia: habilitar una regla ya habilitada retorna éxito sin error (vincula a **AC3**).
    - Regla no encontrada lanza `AutomationRuleNotFoundError` (vincula a **AC9**).
    - Usuario sin ownership lanza `ForbiddenOwnershipError` → `403` (vincula a **AC8**).
  - _Dependencias:_ T04, T05.

- [x] **T13: Pruebas de `UpdateAutomationRuleUseCase`**
  - Archivo: `packages/devices/__tests__/automation/automation_lifecycle.test.ts`
  - Casos:
    - Actualización solo del nombre preserva `trigger` y `action` originales (vincula a **AC4**).
    - Actualización de `trigger.deviceId` a un dispositivo de otro hogar lanza `InvalidAutomationRuleError` (vincula a **AC5**).
    - Actualización que genera auto-bucle lanza `AutomationLoopError` (vincula a **AC6**).
    - Usuario sin ownership lanza `ForbiddenOwnershipError` (vincula a **AC8**).
    - Regla no encontrada lanza `AutomationRuleNotFoundError` (vincula a **AC9**).
    - Actualización de `action.targetDeviceId` a un dispositivo inexistente lanza `DeviceNotFoundError`.
  - _Dependencias:_ T06.

### Pruebas de API

- [x] **T14: Pruebas de handlers en `automation_api.test.ts`**
  - Archivo: `packages/devices/__tests__/automation/automation_api.test.ts`
  - Casos para `enableRule` / `disableRule`:
    - Retorna `200 OK` con la regla actualizada.
    - Retorna `404` si la regla no existe.
    - Retorna `403` si el usuario no es dueño.
  - Casos para `updateRule`:
    - Retorna `200 OK` con la regla modificada.
    - Retorna `400` si `expectedValue` no es un tipo primitivo válido.
    - Retorna `400` si el body está vacío o sin campos reconocidos.
    - Retorna `404` si la regla no existe.
    - Retorna `403` si el usuario no es dueño.
  - _Dependencias:_ T07, T08, T09.

### Prueba de Compatibilidad con el Motor

- [x] **T15: Verificar compatibilidad del Engine con reglas deshabilitadas**
  - Archivo: `packages/devices/__tests__/automation/automation_engine.test.ts`
  - Caso nuevo: al disparar un `DeviceStateUpdated`, el motor NO ejecuta la acción si la regla tiene `enabled: false`.
  - Este test valida que ningún cambio de esta fase rompe el comportamiento del `AutomationEngine` existente.
  - _Dependencias:_ T05 (conceptualmente; el engine ya filtra por `enabled`, solo se formaliza el test).

---

### Prueba de aceptación de consola

- [x] **T16: Verificar creación horaria predeterminada desde la consola**
  - Archivo: `apps/operator-console/tests/responsive-shell.spec.ts`
  - Escenario BDD: al crear una regla horaria y conservar los valores por defecto, el payload contiene `timeLocal: "12:00"`, zona IANA y los siete días.
  - _Dependencias:_ T09.

---
## Resumen de Dependencias

| Tarea | Depende de |
|---|---|
| T02 | T01 |
| T03 | T01 |
| T04 | T03 |
| T05 | T03 |
| T06 | T02, T03 |
| T07 | T04 |
| T08 | T05 |
| T09 | T06 |
| T10 | T07, T08, T09 |
| T11 | T02 |
| T12 | T04, T05 |
| T13 | T06 |
| T14 | T07, T08, T09 |
| T15 | T05 (referencial) |

---

## Criterios de Aceptación (Vinculantes al Spec)

| AC | Descripción | Cubierto por |
|---|---|---|
| **AC1** | Desactivar una regla habilitada persiste `enabled:false` y el motor deja de evaluarla | T05, T12, T15 |
| **AC2** | Activar una regla deshabilitada persiste `enabled:true` y el motor la evalúa de nuevo | T04, T12, T15 |
| **AC3** | Habilitar/Deshabilitar una regla ya en ese estado es idempotente (retorna `200 OK`) | T12 |
| **AC4** | Un patch solo con `name` actualiza el nombre y preserva `trigger` y `action` | T13 |
| **AC5** | Actualizar `trigger.deviceId` a un dispositivo de otro hogar retorna `400` | T13 |
| **AC6** | Un update que resulta en `trigger.deviceId == action.targetDeviceId` retorna `400` | T11, T13 |
| **AC7** | La creación horaria predeterminada envía hora local, zona IANA y siete días | T16 |
| **AC8** | Un usuario sin ownership recibe `403 Forbidden` en cualquier operación de lifecycle | T12, T13, T14 |
| **AC9** | Cualquier operación sobre un `ruleId` inexistente retorna `404 Not Found` | T12, T13, T14 |
