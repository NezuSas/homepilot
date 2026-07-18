# SPEC: SDD Governance and Coverage V1

**Estado:** Implementado  
**Autor:** HomePilot Engineering  
**Fecha:** 2026-07-17

## 1. Declaración del Problema

El producto contiene dominios, rutas y vistas crecientes. Sin una matriz de trazabilidad, cambios funcionales pueden implementar comportamiento sin especificación, criterios de aceptación o validación reproducible.

## 2. Alcance

- Establecer la matriz de cobertura `docs/spec-coverage-matrix.md` como fuente de trazabilidad código-especificación.
- Exigir una spec y archivo de tareas para toda funcionalidad, contrato API o cambio de comportamiento nuevo.
- Definir criterios mínimos de actualización, revisión y validación documental.

## 3. Fuera de Alcance

- Reescribir retrospectivamente cada línea de código histórico.
- Sustituir pruebas automatizadas por documentación.

## 4. Requisitos Funcionales

- **REQ-01:** Cada bounded context y familia de rutas debe aparecer en la matriz con una spec primaria.
- **REQ-02:** Cada spec nueva debe incluir alcance, fuera de alcance, requisitos, criterios de aceptación, notas técnicas y TODOs explícitos.
- **REQ-03:** Las tareas deben separar trabajo implementado de verificaciones futuras sin marcar trabajo no validado como completado.
- **REQ-04:** Toda PR funcional debe citar su spec y actualizar la matriz si introduce una nueva superficie.

## 5. Requisitos No Funcionales

- **NFR-01:** La matriz se mantiene legible y no duplica el contenido de las specs.
- **NFR-02:** Las fuentes normativas son `AGENTS.md`, `docs/architecture.md`, `specs/README.md` y la spec aplicable.

## 6. Criterios de Aceptación

- [x] AC1: Todos los contextos de `packages/`, rutas API y áreas de consola tienen una referencia de spec en la matriz.
- [x] AC2: Las áreas que carecían de spec funcional tienen spec y tareas propias.
- [x] AC3: El índice de specs explica el flujo obligatorio para cambios futuros.

## 7. Notas Técnicas y Arquitectura

- La matriz es un artefacto documental; no cambia contratos de runtime.
- Una spec puede cubrir varias vistas solo si describe el mismo comportamiento de negocio.

## 8. Preguntas Abiertas y TODOs

- TODO: Automatizar en CI una comprobación de que nuevas rutas y contextos estén mapeados.
