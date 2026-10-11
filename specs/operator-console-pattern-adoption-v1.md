# SPEC: Operator Console Pattern Adoption V1

**Status:** Implemented
**Author:** Claude (agente de Arquitectura, UI/UX y QA)
**Date:** 2026-10-10
**Scope:** Hacer que los componentes compartidos de `components/ui` sean la única forma de construir encabezados, tarjetas, chips de estado, avisos, estados vacíos, cargas y capas en `apps/operator-console`, para que cada pieza de la interfaz tenga una contraparte única en Figma y pueda documentarse como catálogo de diseño.

## Problem Statement

El contrato modular (`operator-console-modular-contract-v1`) garantiza que los 27 componentes compartidos son modulares, pero no que se usen. Una auditoría con el compilador de TypeScript (2026-10-10) encontró 226 reconstrucciones a mano en 106 archivos fuera de `components/ui`: 86 encabezados, 59 tarjetas, 15 chips, 37 avisos, 15 estados vacíos, 7 esqueletos, 6 capas y 1 indicador de carga. No son copias idénticas: cada instancia tiene clases distintas (por ejemplo, más de 14 variantes de chip y de tarjeta). La interfaz no tiene hoy un catálogo cerrado que pueda reflejarse en Figma. Solo botones, campos, selectores y áreas de texto están protegidos por `check:ui-primitives`.

## Scope

- **Detector `scripts/check-ui-pattern-usage.mjs` y `npm run check:ui-patterns`:** analiza JSX con el compilador de TypeScript y lista los patrones reconstruidos fuera de `components/ui` (encabezado, tarjeta, chip, aviso, estado vacío, esqueleto, carga, capa). Un archivo `scripts/ui-pattern-baseline.json` fija el número permitido por archivo y regla; solo puede bajar (trinquete). Integrado en `verify:ci`.
- **Catálogo canónico** (la fuente única para Figma):
  - `Heading` nuevo: texto semántico `h1`–`h4` o `span` con estilos `view`, `section`, `card`, `item` y `label`; `SectionHeader` lo usa por dentro.
  - `Card`: variantes que cubren los niveles de superficie reales (plana, elevada, vidrio, error, activa) y `CardTitle` ligado a `Heading`.
  - `StatusPill`: tonos (`success`, `warning`, `danger`, `primary`, `neutral`, `offline`) y tamaños (`sm`, `md`) con y sin mayúsculas.
  - `AlertBanner` y `EmptyState`: variantes necesarias para absorber los usos reales; sin variante nueva si una existente sirve.
- **Migración por familias**, de la más segura a la más delicada: estados vacíos, avisos, chips, encabezados, tarjetas, esqueletos y capas. Cada instancia pasa al componente más cercano. Si el aspecto cambia, el cambio es el del catálogo canónico (convergencia intencional); si no encaja, queda como excepción documentada con motivo.
- **Documentación:** `docs/components/<Nombre>.md` para `Heading` y actualización de los de `Card`, `StatusPill`, `AlertBanner`, `EmptyState`; `docs/design-system-catalog.md` con cada componente, variante y estado en un formato que se pueda trasladar a Figma y exportar como libro de diseño.

## Out of Scope

- Rediseñar paleta, tipografía o la dirección «Estancia viva».
- Tarjetas de dashboard con geometría fijada por spec (`homepilot-dashboard-large-card`, medios, cámara), distintivos sobre vídeo y capas decorativas sin interacción (`pointer-events-none`).
- Contratos de API, stores globales, persistencia.
- Construir el archivo de Figma (se hace después, a partir del catálogo).

## Functional Requirements

- **REQ-01:** `check:ui-patterns` informa por regla y por archivo y falla si algún archivo supera su línea base o aparece un archivo sin línea base.
- **REQ-02:** Toda migración mantiene el comportamiento, la accesibilidad (roles, nombres, `aria-*`) y el orden de foco.
- **REQ-03:** Las variantes nuevas se declaran en el componente compartido con nombre semántico y documentación; no se admiten clases sueltas que sustituyan una variante.
- **REQ-04:** Un cambio de aspecto por convergencia se limita al catálogo canónico y se verifica con pruebas de geometría y capturas de las pantallas afectadas.
- **REQ-05:** Las excepciones se declaran en la línea base con motivo y no pueden crecer.

## Non-Functional Requirements

- **NFR-01:** Cada familia se valida con Jest, typecheck, lint, build y `check:*` antes de pasar a la siguiente.
- **NFR-02:** La suite responsive completa pasa al cerrar cada fase que cambie pantalla.
- **NFR-03:** Sin `any` en producción; sin violar `check:architecture-boundaries` ni `check:ui-primitives`.

## Acceptance Criteria

- **AC1:** `npm run check:ui-patterns` existe, emite el informe y su línea base queda registrada en las tareas.
- **AC2:** `Heading` existe con prueba, documentación y exportación en el barrel, y `SectionHeader` lo usa.
- **AC3:** Al cerrar cada familia, su número de hallazgos baja y ninguna prueba previa falla.
- **AC4:** Al cerrar la spec, los hallazgos abiertos son cero o excepciones documentadas, y `check:ui-patterns` está en `verify:ci`.
- **AC5:** `docs/design-system-catalog.md` lista todos los componentes de `components/ui` con variantes, estados y tokens.
- **AC6:** `check:spec-coverage`, `check:bdd-traceability`, `check:module-test-coverage`, `check:ui-primitives`, `check:modular-components`, `check:no-production-any`, `check:architecture-boundaries`, lint, typecheck, Jest, builds y la suite responsive completa pasan.

## Technical Notes

- El detector solo examina elementos HTML intrínsecos: una etiqueta con mayúscula ya es un componente.
- Reglas de detección: `h1`–`h4`; clases con `rounded-*`+`border`+`bg-card|popover`; `rounded-full`+`border`+`px-*`+`text-*`; `border-<tono>/n`+`bg-<tono>/n`+`rounded`+padding; `border-dashed`+`rounded`; `animate-spin`; `animate-pulse`+`bg-muted`; `fixed`+`inset-0`+`z-*` sin `pointer-events-none`.
- La convergencia elige como canónica la variante más frecuente en la interfaz actual para minimizar el cambio visible.

## Open Questions

- ¿Se aceptan como excepción permanente las tarjetas de dispositivo con geometría fijada por spec o se crea una variante `device`?
