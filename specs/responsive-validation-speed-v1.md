# SPEC: Responsive Validation Speed V1

**Status:** Implemented
**Author:** Claude (agente de QA y Releases/DevOps)
**Date:** 2026-10-10
**Scope:** Reducir el tiempo de la validación responsive local sin recortar cobertura ni cambiar ninguna aserción.

## Problem Statement

`npm run test:responsive` tarda entre 15 y 25 minutos. La fase del contrato del reloj ocupa unos 8 de esos minutos con un solo worker, porque sus 51 pruebas viven en un único archivo y Playwright las ejecuta en serie. Son barridos de geometría del DOM sin estado compartido ni red. Cada cambio visual ajeno al reloj paga ese coste. Una espera tan larga empuja a omitir la suite o a repetirla innecesariamente.

## Scope

- **Paralelizar los lotes del barrido de geometría del reloj (4 workers por defecto en esa fase)** (`Built clock geometry sweep … batch n/22`), agrupándolos en un bloque `describe` con modo paralelo. Las demás pruebas del archivo siguen en serie.
- **Parámetro `--skip-clock`** (y variable `HOMEPILOT_SKIP_CLOCK=1`) en `scripts/run-responsive-tests.mjs`: omite la fase del contrato del reloj y ejecuta el resto.
- **Script `npm run test:responsive:fast`** equivalente a `--skip-clock`.
- **Documentación** en `docs/command-reference.md` de las tres formas de ejecución: completa (puerta de publicación), rápida y dirigida por área.

## Out of Scope

- Cambiar, relajar o eliminar aserciones, escenarios, viewports o muestras (`HOMEPILOT_CLOCK_SAMPLE_STEP` conserva su valor por defecto).
- Paralelizar las pruebas de la aplicación en desarrollo: comparten rutas simuladas y servidor y la configuración las serializa a propósito.
- Cambios en CI: `full-quality-validation.yml` sigue ejecutando la suite completa.
- Cambios de producto, API, stores o persistencia.

## Functional Requirements

- **REQ-01:** Sin argumentos, `npm run test:responsive` ejecuta exactamente los mismos escenarios que antes (fase del reloj y fase de aplicación).
- **REQ-02:** Los lotes del barrido del reloj pueden ejecutarse en workers distintos y cada uno devuelve su evidencia `CLOCK_SWEEP` con `failures: []`.
- **REQ-03:** Con `--skip-clock`, la fase del reloj no se ejecuta y se informa en consola que la suite completa debe correr antes de publicar.
- **REQ-04:** Si `--skip-clock` deja la selección sin pruebas, el script falla con un mensaje explícito, no pasa en silencio.
- **REQ-05:** Los argumentos de Playwright (`--grep`, `--workers`, etc.) siguen reenviándose.

## Non-Functional Requirements

- **NFR-01:** El número de pruebas y de combinaciones barridas del reloj no cambia (51 pruebas; 6750 combinaciones por lote completo).
- **NFR-02:** La fase del reloj baja de ~8 min a menos de 4 min en el equipo de referencia, o se informa la medición real.
- **NFR-03:** El resultado no depende del orden ni del número de workers.

## Acceptance Criteria

- **AC1:** Ejecución completa: 51 pruebas del reloj pasan y los lotes reportan las mismas combinaciones que la ejecución previa.
- **AC2:** La duración medida de la fase del reloj antes y después queda registrada en las tareas.
- **AC3:** `npm run test:responsive:fast` ejecuta la fase de aplicación y omite la del reloj, con el aviso de REQ-03.
- **AC4:** `npm run test:responsive -- --skip-clock -g "Clock size contract"` falla con el mensaje de REQ-04.
- **AC5:** `check:spec-coverage`, `check:bdd-traceability`, `check:module-test-coverage`, lint y typecheck siguen pasando.

## Technical Notes

- Playwright solo paraleliza pruebas de un mismo archivo cuando están en un `describe` con `mode: 'parallel'` o con `fullyParallel`. Se evita `fullyParallel` global porque la configuración lo desactiva a propósito para la aplicación en desarrollo.
- Los títulos de las pruebas siguen conteniendo «Clock size contract», de modo que el patrón de selección del script no cambia.
- El barrido corre contra `vite preview` (producción) y no modifica estado compartido.

## Open Questions

- Si la medición muestra variabilidad por contención de CPU con muchos workers, se limitará con `--workers`.
