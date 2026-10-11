# SPEC: Operator Console Design Book V1

**Status:** Implemented
**Author:** Claude (agente de UI/UX y QA)
**Date:** 2026-10-10
**Scope:** Generar, desde el código real, un libro de diseño imprimible (PDF) en el que cada componente compartido de `components/ui` se vea en modo oscuro y claro, en celular, tableta, kiosko y escritorio, y en orientación vertical y horizontal.

## Problem Statement

El catálogo (`docs/design-system-catalog.md`) y las hojas de Figma describen los componentes, pero no muestran cómo se comporta cada uno en cada formato de pantalla. Figma no puede ejecutar el CSS responsive real, así que cualquier página hecha a mano en Figma se separaría del código. Para que el libro refleje lo que el usuario verá, las imágenes deben capturarse de los componentes reales con los puntos de corte reales.

## Scope

- **Galería de desarrollo** `apps/operator-console/design-book.html` (entrada separada de `index.html`, solo la sirve el servidor de desarrollo y no entra en la compilación de producción): renderiza una demostración de cada componente de `components/ui` con sus variantes y estados. Acepta `?theme=dark|light` y `?only=<Componente>`.
- **Script `scripts/generate-design-book.mjs`** (`npm run docs:design-book`): arranca Vite, abre la galería con Playwright en cada dispositivo y tema, captura cada componente y compone un PDF `docs/design-book/HomePilot-libro-de-diseno.pdf` (una página A4 apaisada por componente) además del `index.html` del libro.
- **Matriz de dispositivos** (píxeles CSS, con puntero táctil salvo escritorio):
  - Celular: vertical 390×844, horizontal 844×390.
  - Tableta: vertical 768×1024, horizontal 1024×768.
  - Kiosko: vertical 1080×1920, horizontal 1920×1080.
  - Escritorio: horizontal 1440×900.
- **Cobertura**: los 31 componentes de `components/ui`. Los que abren capas (`Modal`, `Drawer`, `ActionMenu`, `SearchableSelectField`) se capturan con la capa abierta.
- **Control** `check:design-book-coverage`: falla si un componente de `components/ui` no tiene demostración en la galería.

## Out of Scope

- Páginas hechas a mano en Figma para el comportamiento responsive.
- Componentes de dominio fuera de `components/ui` (tarjetas de escena, automatización, etc.).
- Cambios de estilo de los componentes, de API, stores o persistencia.
- Publicar el PDF o los PNG en el control de versiones (se generan bajo demanda y se ignoran en Git).

## Functional Requirements

- **REQ-01:** Cada componente aparece en las 14 combinaciones (7 dispositivos × 2 temas) con el viewport real y puntero táctil donde corresponde.
- **REQ-02:** La galería usa solo los componentes compartidos y los tokens reales; no define estilos propios para los componentes.
- **REQ-03:** El PDF muestra, por componente: nombre, propósito y variantes (del catálogo generado) y una matriz dispositivo × tema.
- **REQ-04:** El script falla con un mensaje claro si Playwright o el servidor no están disponibles, y no deja procesos en ejecución.
- **REQ-05:** La galería no se incluye en `npm run build --prefix apps/operator-console`.

## Non-Functional Requirements

- **NFR-01:** Generación completa en menos de 15 minutos en el equipo de referencia.
- **NFR-02:** Sin `any` en producción ni violaciones de `check:architecture-boundaries`, `check:ui-primitives` o `check:ui-patterns`.

## Acceptance Criteria

- **AC1:** `npm run docs:design-book` genera el PDF con una página por componente y la matriz completa.
- **AC2:** `check:design-book-coverage` pasa con los 31 componentes.
- **AC3:** La compilación de producción no contiene la galería.
- **AC4:** Una revisión visual de una muestra de componentes confirma que cada dispositivo usa el diseño que corresponde (por ejemplo, el celular apila el aviso y el escritorio lo alinea).
- **AC5:** `check:spec-coverage`, `check:bdd-traceability`, `check:module-test-coverage`, `check:ui-primitives`, `check:ui-patterns`, `check:modular-components`, `check:no-production-any`, `check:architecture-boundaries`, lint, typecheck, Jest y builds pasan.

## Technical Notes

- Los componentes responden a puntos de corte de Tailwind (`sm`, `md`, `lg`, `xl`) y a `(pointer: coarse)`, así que se capturan con el viewport completo y no con un contenedor estrecho.
- Para capas fijas (`Modal`, `Drawer`) se captura el viewport; para el resto, el elemento de la demostración.
- La galería inicializa i18n con las mismas traducciones de la app para que los textos integrados (`UiLabelsContext`) se vean como en producción.

## Open Questions

- ¿Se añade el Escritorio vertical (900×1440) o un escritorio amplio (1920×1080)? Por defecto no.
