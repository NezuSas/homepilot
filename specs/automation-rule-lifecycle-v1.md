# SPEC: Gestión de ciclo de vida de reglas de automatización V1 (Automation Rule Lifecycle Management V1)

**Estado:** Borrador  
**Autor:** Antigravity (IA Architect)  
**Fecha:** 2026-03-30  
**Dependencias:** `automation-rules-engine-v1.md`

---

## 1. Declaración del Problema (Problem Statement)

HomePilot ya permite crear, listar y eliminar reglas de automatización, y un motor reactivo evalúa y ejecuta acciones ante cambios de estado. Sin embargo, el ciclo de vida de una regla queda incompleto: no existe forma de desactivar temporalmente una regla sin eliminarla, ni de modificar sus condiciones después de su creación. Esto obliga al usuario a recrear reglas ante cualquier cambio, y reduce la utilidad del sistema ante escenarios dinámicos del hogar (vacaciones, cambio de rutinas, ajustes de sensibilidad). Este slice formaliza y expone el control explícito del estado `enabled` y la modificación de los campos editables de una regla, reutilizando todas las validaciones de dominio ya existentes.

---

## 2. Alcance (Scope)

- **Habilitar regla**: Permitir que el dueño del hogar reactive una regla previamente desactivada.
- **Deshabilitar regla**: Permitir que el dueño del hogar suspenda temporalmente una regla sin eliminarla.
- **Actualizar regla**: Permitir modificar el `name`, el `trigger` y/o la `action` de una regla existente. Las validaciones del dominio (existence, ownership, loop prevention, home mismatch) se reaplicarán íntegramente sobre los nuevos valores.

---

## 3. Fuera de Alcance (Out of Scope)

- Interfaz de usuario (UI).
- Historial de cambios o versionado de reglas.
- Soft delete / papelera de reciclaje.
- Pausado automático de reglas por fallos consecutivos (candidato a V2).
- Programación horaria (schedulers / cron).
- Reglas con múltiples acciones o condiciones AND/OR.
- Plantillas, importación o exportación de reglas.
- Validación de capacidades durante el update (la validación de capabilities ocurre en el momento de ejecución, no de configuración, siguiendo el patrón de V1).

---

## 4. Requisitos Funcionales (Functional Requirements)

### 4.1 Habilitar / Deshabilitar Regla

- **REQ-01: Habilitar regla**: El dueño del hogar puede marcar una regla existente como `enabled: true`. Si ya estaba habilitada, la operación es idempotente y retorna éxito.
- **REQ-02: Deshabilitar regla**: El dueño del hogar puede marcar una regla existente como `enabled: false`. Si ya estaba deshabilitada, la operación es idempotente y retorna éxito.
- **REQ-03: Validación de ownership en toggle**: Antes de modificar el estado `enabled`, el sistema debe verificar que el solicitante es dueño del hogar al que pertenece la regla, invocando `TopologyReferencePort.validateHomeOwnership`.
- **REQ-04: Regla no encontrada**: Si el `ruleId` no corresponde a ninguna regla existente, se retorna un error de tipo `AutomationRuleNotFoundError`.

### 4.2 Actualización de Regla

- **REQ-05: Campos actualizables**: Solo se permiten actualizar `name`, `trigger` y `action`. El `homeId` y el `userId` original son inmutables.
- **REQ-06: Validación de ownership en update**: El sistema debe verificar ownership del hogar antes de persistir cualquier cambio.
- **REQ-07: Revalidación de dispositivos**: Al actualizar `trigger` o `action`, el sistema revalida que los dispositivos referenciados existan y pertenezcan al mismo `homeId` de la regla.
- **REQ-08: Revalidación de auto-bucle**: Si se actualizan `trigger.deviceId` y/o `action.targetDeviceId`, el sistema debe verificar que no se configura un bucle directo (`trigger.deviceId == action.targetDeviceId`).
- **REQ-09: Regla no encontrada en update**: Si el `ruleId` no existe, se retorna `AutomationRuleNotFoundError`.
- **REQ-10: Actualización parcial (PATCH semántico)**: Solo se aplican los campos presentes en el payload. Los campos ausentes mantienen su valor anterior.

---

## 5. Requisitos No Funcionales (Non-Functional Requirements)

- **NFR-01: Zero-Trust obligatorio**: Toda operación de ciclo de vida (enable, disable, update) debe validar el ownership del home antes de realizar cualquier mutación.
- **NFR-02: Inmutabilidad de campos de identidad**: `homeId` y `userId` no son modificables tras la creación.
- **NFR-03: Operaciones idempotentes**: Habilitar una regla ya habilitada, o deshabilitar una ya deshabilitada, no debe producir error ni efecto secundario.
- **NFR-04: Consistencia con el motor**: El `AutomationEngine` ya filtra reglas por `enabled: true`. Las operaciones de este slice garantizan que ese filtro se mantenga coherente en tiempo real.
- **NFR-05: Local-First**: Todas las operaciones se ejecutan en el Edge, sin dependencia de servicios Cloud.

---

## 6. Semántica HTTP

### Enable Rule
`PATCH /rules/:ruleId/enable`
- **Auth**: Bearer token del usuario.
- **Params**: `ruleId`.
- **Body**: Vacío.
- **Respuestas**:
  - `200 OK` — Regla habilitada. Retorna la regla actualizada.
  - `404 Not Found` — La regla no existe.
  - `403 Forbidden` — El solicitante no es dueño del hogar.

### Disable Rule
`PATCH /rules/:ruleId/disable`
- **Auth**: Bearer token del usuario.
- **Params**: `ruleId`.
- **Body**: Vacío.
- **Respuestas**:
  - `200 OK` — Regla deshabilitada. Retorna la regla actualizada.
  - `404 Not Found` — La regla no existe.
  - `403 Forbidden` — El solicitante no es dueño del hogar.

### Update Rule
`PATCH /rules/:ruleId`
- **Auth**: Bearer token del usuario.
- **Params**: `ruleId`.
- **Body** (todos los campos son opcionales):
  ```json
  {
    "name": "Nuevo nombre",
    "trigger": {
      "deviceId": "sensor-abc",
      "stateKey": "contact",
      "expectedValue": "open"
    },
    "action": {
      "deviceId": "luz-xyz",
      "command": "turn_on"
    }
  }
  ```
- **Respuestas**:
  - `200 OK` — Regla actualizada. Retorna la regla completa en su nuevo estado.
  - `400 Bad Request` — Payload inválido, dispositivos en hogares diferentes, o auto-bucle detectado.
  - `404 Not Found` — La regla no existe.
  - `403 Forbidden` — El solicitante no es dueño del hogar.

---

## 7. Modelo Conceptual de Datos

No se introducen nuevos modelos. Se reutiliza íntegramente la entidad `AutomationRule` definida en `automation-rules-engine-v1`:

### AutomationRule (sin cambios al modelo)

| Campo | Tipo | Mutabilidad |
|---|---|---|
| `id` | `string` | Inmutable |
| `homeId` | `string` | Inmutable |
| `userId` | `string` | Inmutable |
| `name` | `string` | **Actualizable** |
| `enabled` | `boolean` | **Actualizable** (enable/disable) |
| `trigger.deviceId` | `string` | **Actualizable** |
| `trigger.stateKey` | `string` | **Actualizable** |
| `trigger.expectedValue` | `string \| number \| boolean` | **Actualizable** |
| `action.targetDeviceId` | `string` | **Actualizable** |
| `action.command` | `turn_on \| turn_off \| toggle` | **Actualizable** |

---

## 8. Criterios de Aceptación (Acceptance Criteria)

- **AC1: Desactivación exitosa**: Dado un hogar con una regla habilitada, cuando el dueño llama a `PATCH /rules/:ruleId/disable`, la regla persiste con `enabled: false` y el motor ya no la evalúa en subsiguientes eventos de estado.
- **AC2: Activación exitosa**: Dado un hogar con una regla deshabilitada, cuando el dueño llama a `PATCH /rules/:ruleId/enable`, la regla persiste con `enabled: true` y el motor vuelve a evaluarla.
- **AC3: Idempotencia**: Llamar a `/enable` sobre una regla ya habilitada retorna `200 OK` sin error, y el estado no cambia.
- **AC4: Actualización parcial de nombre**: El dueño envía solo `{ "name": "Nuevo nombre" }` y la regla actualiza únicamente el nombre, preservando `trigger` y `action` intactos.
- **AC5: Revalidación de dispositivos en update**: Si se actualiza `trigger.deviceId` con un dispositivo que pertenece a otro hogar, el sistema retorna `400 Bad Request`.
- **AC6: Prevención de bucle en update**: Si el update resulta en `trigger.deviceId == action.targetDeviceId`, el sistema retorna `400 Bad Request`.
- **AC7: Zero-Trust en todas las operaciones**: Un usuario que no es dueño del hogar recibe `403 Forbidden` en cualquier operación de lifecycle (enable, disable, update).
- **AC8: Regla inexistente**: Cualquier operación sobre un `ruleId` que no existe retorna `404 Not Found`.

---

## 9. Notas Técnicas y Arquitectura

### Capa de Dominio
- La entidad `AutomationRule` ya contiene el campo `enabled`. No se requieren cambios al modelo.
- Se añadirá una función de dominio `updateAutomationRule(existing, patch, idResolver?)` que aplique las mutaciones válidas y reedite las invariantes (loop prevention, trimming de nombre).

### Capa de Infraestructura
- Se añadirá el método `update(rule: AutomationRule): Promise<void>` al contrato `AutomationRuleRepository` y a su implementación `InMemoryAutomationRuleRepository`.

### Capa de Aplicación
- Se crearán tres casos de uso nuevos, siguiendo el patrón funcional existente:
  - `EnableAutomationRuleUseCase`
  - `DisableAutomationRuleUseCase`
  - `UpdateAutomationRuleUseCase`
- Cada uno valida ownership vía `TopologyReferencePort` antes de mutar.
- `UpdateAutomationRuleUseCase` debe revalidar dispositivos (existence + home mismatch) si se actualizan `trigger` o `action`.

### Capa API
- Se añadirán tres handlers en `AutomationController`:
  - `enableRule(req)`
  - `disableRule(req)`
  - `updateRule(req)`
- El handler de `updateRule` aplica narrowing estricto del body sin `any`.

### Compatibilidad con el Motor
- El `AutomationEngine` no requiere cambios. Ya filtra por `enabled: true` al momento de la evaluación. Las operaciones de lifecycle actúan directamente sobre el repositorio, y el motor lee el estado actual en cada invocación de `handleDeviceStateUpdated`.

---

## 10. Preguntas Abiertas / TODOs

- ¿Debe el sistema registrar en el `ActivityLog` cuándo una regla es habilitada o deshabilitada? (candidato para observabilidad en V2).
- ¿Qué ocurre si un dispositivo referenciado por una regla es dado de baja (`unassigned`) del hogar? Este spec no cubre la invalidación reactiva de reglas, pero debería contemplarse en una versión posterior.
- ¿El endpoint de update debe admitir también la modificación del estado `enabled` en un solo PATCH, o se mantiene la separación explícita de enable/disable como operaciones semánticamente distintas? (Decisión de diseño de API pendiente de validación con el equipo de producto).
