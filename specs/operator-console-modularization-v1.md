# SPEC: Operator Console Modularization V1

**Status:** Draft
**Author:** Claude (agente de Arquitectura y QA)
**Date:** 2026-10-10
**Scope:** Reorganización interna de `apps/operator-console` y de sus pruebas, sin cambios de comportamiento, de DOM, de clases ni de estilos.

## Problem Statement

Varios archivos mezclan responsabilidades y concentran riesgo: `App.tsx` (907 líneas), `DashboardCanvas.tsx` (763), `sectionCardCatalog.ts` (430) y la suite `responsive-shell.spec.ts` (7448 líneas en un solo archivo, lo que además impide ejecutarla en paralelo). Hay componentes sin consumidores (`DashDeviceTile`, `DeviceTileBase`) y lógica repetida entre tarjetas (nombre visible, comprobación de «no disponible», disponibilidad de comandos). El resultado es lectura lenta, cambios con mucho radio de impacto y validaciones largas.

## Scope

- **Fase A (código, sin cambio de DOM ni de clases):**
  - A1. Retirar el código sin ninguna referencia verificada (12 archivos, ver tareas). Se conservan los componentes sin consumidores de producción pero exigidos por una spec o leídos por pruebas (`DeviceTileBase` se retiró tras enmendar la spec; quedan `DashboardCreateForm`, `SearchFilterBar`, `AssistantCard`, `AutomationWorkbenchForm`); su retirada requiere enmendar la spec correspondiente.
  - A2. Partir `sectionCardCatalog.ts` por familia con un índice que conserva la API pública.
  - A3. Extraer a `lib/` la lógica pura repetida: nombre visible de dispositivo y disponibilidad de comandos, con pruebas, y adoptarla en los consumidores que la repiten sin cambiar su salida.
  - A4. Partir `App.tsx` y las vistas grandes en hooks y subcomponentes, solo tras leer cada archivo y solo donde el corte es mecánico.
- **Fase T (pruebas):** dividir `responsive-shell.spec.ts` por tema en archivos, con ayudantes compartidos en un módulo, sin cambiar aserciones, títulos ni número de pruebas, de modo que Playwright pueda repartir archivos entre workers.

## Out of Scope

- Cambios de estilo, tokens, estructura DOM, nombres de clase o geometría.
- División de `index.css` y unificación de tarjetas en una sola primitiva (riesgo alto; fase aparte).
- Contratos de API, stores globales, migraciones y persistencia.
- Nuevas funciones.

## Functional Requirements

- **REQ-01:** Tras cada paso, la salida renderizada y el comportamiento observable no cambian.
- **REQ-02:** Cada módulo extraído conserva su API pública o mantiene un índice de reexportación.
- **REQ-03:** Los archivos nuevos fuera de `components/ui` respetan `check:ui-primitives`.
- **REQ-04:** La lógica extraída tiene pruebas unitarias propias.
- **REQ-05:** Tras la división, la suite responsive contiene exactamente los mismos títulos de prueba que antes.

## Non-Functional Requirements

- **NFR-01:** Cambios en pasos pequeños y reversibles, cada uno validado antes del siguiente.
- **NFR-02:** Sin `any` en producción ni imports cruzados que violen `check:architecture-boundaries`.
- **NFR-03:** La división de pruebas no debe aumentar el tiempo total ni la inestabilidad.

## Acceptance Criteria

- **AC1:** `DashDeviceTile` y `DeviceTileBase` no existen y ningún script, doc ni test los referencia; `check:spec-coverage` pasa.
- **AC2:** Jest pasa con la misma cantidad o más de pruebas, y typecheck, lint y ambos builds pasan tras cada paso.
- **AC3:** Los títulos listados por Playwright (`--list`) antes y después de la división de `responsive-shell.spec.ts` son idénticos en número y nombre.
- **AC4:** La suite responsive dirigida de las áreas tocadas pasa; la completa pasa antes de publicar.
- **AC5:** El tiempo de la suite responsive completa se mide antes y después de la Fase T y se registra.
- **AC6:** `check:ui-primitives`, `check:no-production-any`, `check:architecture-boundaries`, `check:bdd-traceability` y `check:module-test-coverage` pasan.

## Technical Notes

- Los cortes de la Fase A4 son hipótesis hasta leer cada archivo; solo se ejecutan los mecánicos.
- La Fase T mueve los ayudantes (`prepareAuthenticatedDashboard`, datos de ejemplo) a un módulo importado por cada archivo; los escenarios se agrupan por tema.

## Open Questions

- Resuelta: se enmendó `operator-console-modular-components-v1` (REQ-34 retirado, REQ-35 sin `DeviceTileBase`) y `DeviceTileBase` se eliminó junto con su prueba, doc y demo.
