# SPEC: Engineering Quality Compliance V1

**Estado:** Aprobado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-11

## Objetivo

Establecer una definición verificable de cumplimiento SDD, TDD, BDD y SOLID para cada módulo mantenido de HomePilot.

## Requisitos

- **REQ-01 (SDD):** Cada módulo funcional tiene una spec y tareas con criterios de aceptación trazables y estado Implementado solo con evidencia.
- **REQ-02 (TDD):** Cada comportamiento de aplicación o API tiene una prueba automatizada de regresión que falla antes del cambio y pasa después.
- **REQ-03 (BDD):** Cada flujo de usuario crítico tiene escenarios Given/When/Then ejecutables o trazables a pruebas de aceptación.
- **REQ-04 (SOLID):** Orquestadores delegan responsabilidades cohesivas; infraestructura se inyecta desde composition roots; no hay dependencias concretas en handlers de dominio.
- **REQ-05 (CI):** Las reglas anteriores se verifican automáticamente en cada PR.

## Criterios de aceptación

- [x] AC1: Todas las specs primarias activas tienen estado, tareas y criterios de aceptación completos. Evidencia: `npm run check:spec-coverage`.
- [x] AC2: Cada bounded context tiene una matriz que enlaza specs, escenarios BDD y suites TDD. Evidencia: `docs/quality/sdd-tdd-bdd-traceability.md`.
- [x] AC3: Los flujos críticos de auth, dispositivos, escenas, automatizaciones, asistente y consola tienen escenarios BDD verificables. Evidencia: `npm run check:bdd-traceability` exige 21 flujos únicos Given/When/Then.
- [x] AC4: Los módulos sin cobertura directa incorporan pruebas de comportamiento o se justifican como tipos/puertos sin lógica ejecutable. Evidencia: `npm run check:module-test-coverage`.
- [ ] AC5: Los orquestadores con responsabilidades múltiples se dividen en colaboradores inyectables y testeables.
- [x] AC6: CI bloquea cambios que incumplan los controles SDD/TDD/BDD/SOLID. Evidencia: `.github/workflows/ci.yml` ejecuta `npm run verify:quality` en cada push y PR.