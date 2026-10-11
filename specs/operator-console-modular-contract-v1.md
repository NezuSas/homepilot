# SPEC: Operator Console Modular Contract V1

**Status:** Implemented
**Author:** Claude (agente de Arquitectura y QA)
**Date:** 2026-10-10
**Scope:** Definir como contrato verificable qué significa que un componente de `modularComponentDocs` sea realmente modular, medirlo automáticamente y corregir cada incumplimiento, sin cambiar el comportamiento ni el DOM observable.

## Problem Statement

La modularidad de los 27 componentes documentados se evalúa a ojo. Una auditoría (2026-10-10) encontró: sin barrel de importación; 22 de 27 sin prueba propia; componentes que no aceptan `className` ni atributos nativos (`DatabaseBackupsCard`, `InlineTabCreator`, `CoverPositionControl`, `Modal`); primitivos que llaman a `useTranslation` internamente (`Modal`, `SearchableSelectField`, `SearchFilterBar`, `ConfirmModal`, `AssistantCard`, `DatabaseBackupsCard`); archivos con varias responsabilidades (`SearchableSelectField` 350 líneas, `AudioInputPicker` 213); y patrones repetidos a mano fuera de los primitivos (≈17 tarjetas con la misma cadena de clases, 6 chips que copian `StatusPill`, 19 encabezados, 7 chips de selección, 3 `radiogroup`, 1 checkbox).

## Scope

- **Contrato (verificable por script):** cada componente de la lista debe cumplir, según aplique:
  - **C1 Composición:** acepta `className` y lo combina con `cn()`.
  - **C2 Contrato nativo:** si envuelve un elemento nativo, usa `forwardRef` o extiende los atributos nativos del elemento.
  - **C3 Presentación pura:** no importa stores, no hace `fetch`/`apiFetch` y no llama a `useTranslation` ni lee `i18n`; recibe textos y locale por props. Los envoltorios de dominio con i18n viven fuera de `components/ui/`.
  - **C4 Prueba propia:** existe un `*.test.tsx` que importa el componente.
  - **C5 Documentación:** existe `docs/components/<Nombre>.md` (ya exigido).
  - **C6 Importación:** se exporta desde el barrel `components/ui/index.ts` (los de `components/ui/`).
- **Script `scripts/check-modular-contract.mjs`** y `npm run check:modular-components`, con informe por componente y por regla, integrado en `verify:ci`. Lista única de componentes en `scripts/modular-components.mjs`, compartida con `check-spec-coverage.mjs`.
- **Corrección por fases**, validando cada una:
  - **M1:** barrel; `className`/`cn`/`forwardRef`/atributos nativos donde falten; pruebas unitarias propias de los 22 sin prueba.
  - **M2:** sacar `useTranslation` de los primitivos, recibiendo textos por props, y adaptar a los consumidores.
  - **M3:** sustituir las copias a mano por los primitivos donde la equivalencia de clases y geometría esté verificada (tarjetas planas, chips semánticos, encabezados, chip de selección, checkbox, `radiogroup`).
  - **M4:** extraer lógica repetida entre tarjetas a `lib/` (`useDeviceDisplayName`, disponibilidad de comandos, indicador de carga).
  - **M5:** dividir los archivos grandes (`SearchableSelectField`, `AudioInputPicker`) en hooks y subcomponentes.
  - **M6:** sincronizar la documentación de cada componente con su API real.

## Out of Scope

- Cambios de estilo, tokens, estructura DOM observable o nombres de clase `homepilot-*`/`sensor-*` que fijan las pruebas responsive.
- Tarjetas de dashboard con geometría fijada por la spec (`homepilot-dashboard-large-card`, medios, cámara) y overlays sobre vídeo.
- Contratos de API, stores globales, persistencia.
- Nuevas funciones.

## Functional Requirements

- **REQ-01:** `check:modular-components` informa, para cada componente, qué reglas cumple y cuáles no, y falla si alguna no se cumple y no figura como excepción documentada.
- **REQ-02:** Las excepciones se declaran en el script con un motivo (por ejemplo, una regla que no aplica a un hook).
- **REQ-03:** Tras cada fase, el DOM renderizado y el comportamiento observable no cambian, salvo atributos nativos adicionales que ahora se aceptan.
- **REQ-04:** Todo cambio de props de un primitivo mantiene compatibilidad o adapta a todos sus consumidores en el mismo paso.
- **REQ-05:** Cada componente nuevo o dividido cumple el contrato desde su creación.

## Non-Functional Requirements

- **NFR-01:** Pasos pequeños, cada uno validado con Jest, typecheck, lint, build y los controles del repositorio.
- **NFR-02:** Las migraciones que toquen pantalla pasan por Playwright dirigido a su área.
- **NFR-03:** Sin `any` en producción y sin violar `check:architecture-boundaries` ni `check:ui-primitives`.

## Acceptance Criteria

- **AC1:** `npm run check:modular-components` existe, emite el informe y su línea base queda registrada en las tareas.
- **AC2:** Al cerrar cada fase, el número de incumplimientos baja y ninguna prueba previa falla.
- **AC3:** Al cerrar M1–M2 los 27 componentes cumplen C1–C6 o tienen una excepción documentada.
- **AC4:** `components/ui/index.ts` existe y la lista de componentes de `check-spec-coverage.mjs` procede de la lista única.
- **AC5:** Tras M3, ninguna copia verificada de los patrones listados queda fuera del primitivo, salvo las excluidas de alcance.
- **AC6:** `check:spec-coverage`, `check:bdd-traceability`, `check:module-test-coverage`, `check:ui-primitives`, `check:no-production-any`, `check:architecture-boundaries`, lint, typecheck y builds pasan.
- **AC7:** La suite responsive de las áreas tocadas pasa; la completa pasa antes de publicar.

## Technical Notes

- El script analiza el código fuente con la API del compilador de TypeScript para reducir falsos positivos (importaciones, uso de `forwardRef`, firmas de props).
- `OverlayAccessibility` es un hook: C1–C2 no le aplican y se registra como excepción.
- Los consumidores de primitivos que pierdan `useTranslation` pasan los textos con `t(...)` en el sitio de uso o mediante un envoltorio de dominio.

## Open Questions

- ¿Se admite que `Modal` conserve un texto de cierre por defecto en inglés, o se exige `closeLabel` en todos los usos?
