# SPEC: Assistant Scope Filter & Permission Gate Extraction V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

`AssistantConversationService` (monolito de ~4300 líneas) concentraba tanto la lógica de "¿este
comando aplica realmente a este dispositivo ahora mismo?" (disponibilidad, capacidad, categoría
semántica, cambio de estado) como la de "¿este usuario tiene permiso sobre este hogar/dispositivo?"
mezcladas con la orquestación conversacional. Esto dificultaba verificar cada pieza de forma
aislada y aumentaba el riesgo de que un futuro colaborador del pipeline semántico (Fase 4 del plan
de arquitectura conversacional) reimplementara estas reglas de forma inconsistente.

## Alcance

- Ítem A: `ScopeFilter` (`packages/assistant/application/ScopeFilter.ts`) — única fuente de verdad
  para `isDeviceAvailable`, `supportsCommand`, `isLightEntity`, `isControllableForBulk`,
  `requiresBulkStateChange`, `isControllableDevice`. Extracción pura, sin cambio de comportamiento.
- Ítem B: `PermissionGate` (`packages/assistant/application/PermissionGate.ts`) — única fuente de
  verdad para `authorizedHomeIdsFor`, `getAuthorizedDevices/Rooms/Scenes/Automations`,
  `assertHomeAuthorized`. Extracción pura, sin cambio de comportamiento.
- Ítem C: Ambas clases quedan disponibles para ser reutilizadas directamente por el futuro
  `LlmPlannerService` (Fase 4), en vez de que el pipeline semántico tenga que reimplementar estas
  reglas o depender del monolito completo.

## Fuera de alcance

- No se extrae aún un `IntentResolver` unificado (la resolución de nombres naturales a IDs sigue
  repartida entre `AssistantFastPathResolver`, `findMatchingDevices`/`findFuzzyCandidateSuggestions`
  en el propio `AssistantConversationService`, y `PlannerV2Resolver`). Queda como siguiente paso.
- No se consolidan aún los ~14 puntos de coincidencia difusa restantes sobre `textMatching.ts`
  (ver `specs/assistant-generic-typo-correction-v1.md`).

## Requisitos funcionales

- **REQ-01**: `ScopeFilter` no depende de `AssistantConversationService` ni de ningún estado de
  instancia — es una clase sin dependencias de constructor, instanciable de forma aislada.
- **REQ-02**: `PermissionGate` recibe sus cuatro repositorios y el `HomeRepository` opcional por
  constructor, igual que los recibía `AssistantConversationService` — mismo patrón de fallback
  cuando no hay `HomeRepository` configurado (contextos de test legados).
- **REQ-03**: `AssistantConversationService` delega en `this.scopeFilter` y `this.permissionGate`
  para las seis y las seis funciones respectivamente, sin duplicar la lógica.

## Requisitos no funcionales

- **NFR-01**: Regresión cero — ningún test existente debía cambiar para pasar tras la extracción
  (verificado: 0 cambios de test necesarios, solo tests nuevos añadidos).

## Criterios de aceptación

- [x] AC1: `ScopeFilter` tiene cobertura de test unitaria directa e independiente de
      `AssistantConversationService` (`scope_filter.test.ts`).
- [x] AC2: `PermissionGate` tiene cobertura de test unitaria directa, incluyendo el caso de
      aislamiento cross-home y el fallback sin `HomeRepository` (`permission_gate.test.ts`).
- [x] AC3: Suite completa sin regresiones (142 suites, 1175 tests) tras la extracción.
- [x] AC4: `tsc --noEmit` y `npm run build` limpios.

## Notas técnicas y arquitectura

Extracción mecánica en dos pasos por clase: (1) mover el bloque de métodos a un archivo nuevo,
cambiando `private` → `public`; (2) reemplazar cada sitio de llamada `this.metodo(` por
`this.colaborador.metodo(` mediante sustitución literal (22 sitios para `ScopeFilter`, 47 para
`PermissionGate`), verificado sin sitios residuales sin migrar. `PermissionGate` se instancia en el
cuerpo del constructor (no como inicializador de campo) porque depende de los parámetros del
constructor de `AssistantConversationService`.

## Preguntas abiertas y TODOs

- TODO: Extraer un `IntentResolver` unificado que consolide la resolución nombre-natural→ID hoy
  repartida entre `AssistantFastPathResolver`, `findMatchingDevices`/`findFuzzyCandidateSuggestions`
  y `PlannerV2Resolver`, reutilizando `ScopeFilter`/`PermissionGate` como colaboradores.
