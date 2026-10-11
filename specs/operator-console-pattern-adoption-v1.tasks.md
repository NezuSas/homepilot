# TASK BREAKDOWN: Operator Console Pattern Adoption V1

- [x] Auditoría con el compilador de TypeScript: 226 hallazgos en 106 archivos (2026-10-10): encabezado 86, tarjeta 59, aviso 37, chip 15, estado vacío 15, esqueleto 7, capa 6, carga 1.
- [x] `scripts/check-ui-pattern-usage.mjs` con línea base `scripts/ui-pattern-baseline.json` (trinquete), motivos en `scripts/ui-pattern-exceptions.json` y `npm run check:ui-patterns`.
- [x] `check:ui-patterns` y `check:design-catalog` integrados en `verify:ci`.
- [x] `Heading` (estilos `view`, `section`, `card`, `item`, `label`) con prueba, documentación y barrel; `SectionHeader` lo usa. `CardTitle` no cambia (conserva su estilo propio).
- [x] Variantes: `Card` (`flat`, `radius`, `as`), `StatusPill` (`size`, `uppercase`), `AlertBanner` (`size="sm"`), `EmptyState` (`dashed`), con prueba y documentación.
- [x] Migración de estados vacíos, avisos, chips, encabezados, tarjetas, esqueletos, cargas y capas: de 222 a 38 hallazgos en 30 archivos (2026-10-10). Los 38 restantes son excepciones con motivo (geometría fijada por spec, capas sobre vídeo, paneles que no son mensajes).
- [x] `docs/design-system-catalog.md` generado desde el código (`npm run docs:design-catalog`) con colores oscuro/claro, formas, escala tipográfica y 31 componentes con variantes.
- [x] Controles de spec, BDD, módulos, UI, patrones, catálogo, any, arquitectura, i18n, Tuya, Docker profiles, lint, typecheck, Jest (4200 pruebas) y builds.
- [x] Suite responsive completa: 400 de 400 (51 del reloj + 349 de aplicación) tras corregir `Card` para conservar `<article>`/`<section>` (`as`) y limitar la fase de aplicación a 5 workers.
- [x] Figma (archivo `DY3si2zdoiZwoE8dvRhxKT`) reconciliado con el código (2026-10-10):
  - Estilos de texto: 109 estilos pasan de Rubik a Inter y se crean `HomePilot/Heading/View|Section|Card|Item|Label`; textos sueltos de 55 páginas de escritorio pasan a Inter (las páginas móviles ya estaban en Inter).
  - Componentes: `Card` Desktop/Mobile con `Surface=Flat`; `StatusPill` Desktop/Mobile con `Size` (Sm/Md/Lg) y `Case` (Normal/Upper); `AlertBanner` Desktop/Mobile con `Size=Sm`; `EmptyState` Desktop/Mobile con `Variant=Dashed`.
  - Página «Libro de diseño · Catálogo»: 11 hojas A4 apaisadas (portada, índice, colores, formas y elevación, superficies, tipografía, estados y avisos, catálogo en 4 hojas) listas para exportar como PDF.
- [ ] Revisión visual humana de las pantallas migradas y del libro; decidir las excepciones de tarjetas de dispositivo con geometría fijada.
- [ ] Sincronizar a mano en Figma los componentes de vistas que no pertenecen a `components/ui` (por ejemplo, tarjetas de dominio) cuando se rediseñen.
