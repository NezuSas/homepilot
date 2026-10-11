# SPEC: Backend Modularization V1

**Status:** Implemented
**Author:** Claude (agente de Arquitectura y QA)
**Date:** 2026-10-10
**Scope:** Dividir los archivos de backend que concentran varias responsabilidades en módulos cohesivos, sin cambiar contratos de API, formatos de persistencia, migraciones ni comportamiento observable.

## Problem Statement

La interfaz ya es modular y tiene controles automáticos, pero el backend conserva archivos que mezclan responsabilidades: `AssistantConversationService.ts` (5.514 líneas, 133 métodos), `DeviceRoutes.ts` (732), `CameraRoutes.ts` (562), `HomeAssistantRealtimeSyncManager.ts` (546), `bootstrap.ts` (532), `AssistantPlannerV2ShadowService.ts` (526), `AssistantMultiCommandParser.ts` (475) y `AutomationEngine.ts` (447). Son difíciles de revisar y de probar por partes, y cada cambio arriesga regresiones en el flujo de control físico y del asistente.

## Scope

- **Estrategia de compatibilidad** (obligatoria por `AGENTS.md`): ningún símbolo exportado cambia de nombre, firma ni módulo de importación. Cada archivo original sigue siendo el punto de entrada y reexporta lo que otros importan. La división es interna: colaboradores y módulos puros en una carpeta contigua.
- **Reglas de división**:
  - Lógica pura (normalización, puntuación, formato, reglas) pasa a módulos de funciones con pruebas propias.
  - Estado y dependencias externas se inyectan por constructor o parámetros mediante puertos existentes; los colaboradores no instancian infraestructura ni acceden a SQLite.
  - Las rutas de dominio se siguen registrando mediante `RouteHandler`; no se registran rutas en `ApiGateway.ts`. Los handlers con `reply.hijack()` siguen escribiendo en `reply.raw`; `parseBody<T>` conserva su contrato.
  - `bootstrap.ts` sigue siendo la raíz de composición y se reparte en ensambladores por área bajo `infrastructure/assemblers/`.
- **Archivos objetivo y meta** (menos de 400 líneas cada archivo resultante, una responsabilidad por archivo):
  - `packages/assistant/application/AssistantConversationService.ts` → `packages/assistant/application/conversation/`.
  - `apps/api/routes/DeviceRoutes.ts` y `CameraRoutes.ts` → carpetas `apps/api/routes/device/` y `apps/api/routes/camera/`.
  - `packages/integrations/home-assistant/application/HomeAssistantRealtimeSyncManager.ts`, `packages/automation/application/AutomationEngine.ts`, `packages/assistant/application/AssistantPlannerV2ShadowService.ts`, `AssistantMultiCommandParser.ts` y `bootstrap.ts`.
- **Reversión**: cada archivo original se conserva como entrada; revertir un paso es restaurar ese archivo y borrar su carpeta contigua.

## Out of Scope

- Cambios de contrato de API, de formato de persistencia, de migraciones, de stores o de comportamiento del asistente.
- `AssistantResponseCatalog.ts` (669 líneas): es un catálogo de datos verificado por `check:assistant-response-catalog`; solo se divide si el control lo permite sin cambiar su salida.
- Archivos de backend de 300–450 líneas con una sola responsabilidad.

## Functional Requirements

- **REQ-01:** Tras cada paso, la salida observable (respuestas HTTP, eventos, mensajes del asistente, SQL emitido) es idéntica; las pruebas existentes pasan sin modificar sus aserciones.
- **REQ-02:** Los símbolos exportados por los archivos originales siguen disponibles en la misma ruta de importación.
- **REQ-03:** Los módulos nuevos cumplen `check:architecture-boundaries` (sin dependencias de infraestructura concretas en dominio/aplicación) y `check:no-production-any`.
- **REQ-04:** Cada módulo con lógica pura nueva tiene una prueba propia; los colaboradores con estado se cubren con las pruebas del servicio que los usa.

## Non-Functional Requirements

- **NFR-01:** Pasos pequeños: cada extracción se valida con las pruebas del área antes de la siguiente; la suite completa se ejecuta al cerrar cada archivo objetivo.
- **NFR-02:** Sin cambios en `migrations/`, en esquemas JSON de API ni en `docker/`.

## Acceptance Criteria

- **AC1:** Ningún archivo de producción de los objetivos supera 400 líneas, salvo excepciones documentadas con motivo.
- **AC2:** `npm run test`, `npm run typecheck`, `npm run build`, `check:no-production-any`, `check:architecture-boundaries`, `check:module-test-coverage`, `check:assistant-response-catalog`, `check:spec-coverage` y `check:bdd-traceability` pasan.
- **AC3:** Los símbolos exportados de los archivos originales no cambian (se verifica con typecheck de los consumidores y con las pruebas de importación existentes).
- **AC4:** El árbol de `migrations/` y los esquemas de API no tienen cambios.

## Technical Notes

- La suite de Jest (≈4.200 pruebas) es la red de seguridad principal; las pruebas del asistente (`packages/assistant/__tests__`) cubren `AssistantConversationService` por escenarios.
- Para `AssistantConversationService` se extraen primero las funciones puras y los métodos sin estado compartido; los métodos que comparten estado de conversación se agrupan en colaboradores con ese estado inyectado.

## Open Questions

- ¿Se exige cobertura nueva por colaborador, o basta la cobertura por escenarios del servicio? Por defecto, pruebas propias solo para lógica pura.
