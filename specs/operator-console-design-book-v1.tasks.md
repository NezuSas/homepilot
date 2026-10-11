# TASK BREAKDOWN: Operator Console Design Book V1

- [x] Galería de desarrollo `apps/operator-console/design-book.html` con `src/design-book/` (31 demostraciones, una por componente de `components/ui`); fuera de la compilación de producción.
- [x] `scripts/check-design-book-coverage.mjs` y `npm run check:design-book-coverage` en `verify:ci`.
- [x] `scripts/generate-design-book.mjs`, `scripts/design-book-layout.mjs` y `npm run docs:design-book`: 7 dispositivos (celular, tableta y kiosko en vertical y horizontal; escritorio) × 2 temas × 31 componentes = 434 capturas de pantalla completa (celular a 2×), dibujadas dentro de un celular, tableta, kiosko o monitor; PDF de 256 páginas (portada, guía, índice, 5 familias y 7 páginas por componente: celular, tableta, kiosko y escritorio, cada uno en oscuro y claro) en `docs/design-book/` (ignorado en Git).
- [x] Propósitos en español en `scripts/design-book-purposes.json`; variantes tomadas de `docs/design-system-catalog.md`.
- [x] Generación completa medida: 3 min 50 s (límite NFR-01: 15 min); incluye reintentos ante esperas de Vite.
- [x] Revisión visual de una muestra (Button, Modal, Card, SearchableSelectField): cada formato usa el diseño que corresponde y los dos temas se distinguen.
- [ ] Revisión visual humana del PDF completo.
