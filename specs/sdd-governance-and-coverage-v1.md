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
- **REQ-05:** La comprobación automatizada debe fallar si una regla de cobertura apunta a una spec inexistente, si un archivo fuente queda sin spec primaria, o si una spec primaria no declara un estado válido y su archivo de tareas asociado.
- **REQ-06:** La matriz debe reflejar el número de archivos auditados que informa la comprobación automatizada vigente.
- **REQ-07:** Cada cambio de comportamiento debe asociar sus criterios de aceptación con pruebas automatizadas o una verificación manual explícita en su archivo de tareas.

## 5. Requisitos No Funcionales

- **NFR-01:** La matriz se mantiene legible y no duplica el contenido de las specs.
- **NFR-02:** Las fuentes normativas son `AGENTS.md`, `docs/architecture.md`, `specs/README.md` y la spec aplicable.

## 6. Criterios de Aceptación

- [x] AC1: Todos los contextos de `packages/`, rutas API y áreas de consola tienen una referencia de spec en la matriz.
- [x] AC2: Las áreas que carecían de spec funcional tienen spec y tareas propias.
- [x] AC3: El índice de specs explica el flujo obligatorio para cambios futuros.
- [ ] AC4: La comprobación de cobertura valida la integridad de las referencias a specs y los metadatos mínimos de las specs primarias.
- [ ] AC5: La matriz declara el mismo total de archivos que la comprobación automatizada.
- [ ] AC6: Las tareas de specs primarias identifican cómo se valida cada criterio de aceptación aplicable.

## 7. Notas Técnicas y Arquitectura

- La matriz es un artefacto documental; no cambia contratos de runtime.
- Una spec puede cubrir varias vistas solo si describe el mismo comportamiento de negocio.

## 8. Preguntas Abiertas y TODOs

- TODO: Extender la trazabilidad de criterios de aceptación a enlaces directos con pruebas cuando se acuerde un formato de identificadores de prueba.
