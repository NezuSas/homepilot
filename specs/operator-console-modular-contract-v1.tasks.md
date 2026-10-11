# TASK BREAKDOWN: Operator Console Modular Contract V1

- [x] Auditoría de solo lectura de los 27 componentes y de las fugas fuera de los primitivos (2026-10-10).
- [x] Lista única `scripts/modular-components.mjs`, usada también por `check-spec-coverage.mjs`.
- [x] `scripts/check-modular-contract.mjs` y `npm run check:modular-components`, con excepciones documentadas.
- [x] Línea base (2026-10-10): 83 incumplimientos. Tras barrel, 5 docs y las 16 pruebas propias: 32 (C1:8 C2:15 C3:9).
- [x] M1: barrel, className/cn, atributos nativos y pruebas propias (2026-10-10).
- [x] M2: primitivos sin i18n mediante `UiLabelsContext` y props de texto; consumidores adaptados (2026-10-10). Informe: 0 incumplimientos, 1 excepción documentada (ComponentSkeletons C2).
- [x] M3: auditoría de patrones hechos a mano resuelta en la spec `operator-console-pattern-adoption-v1` (222 → 38 hallazgos, excepciones con motivo).
- [x] M4: la lógica de disponibilidad y de nombre de dispositivo ya está centralizada en `lib/` (`deviceAvailability`, `deviceOperationalEligibility`, `devicePresentation`); no queda copia que extraer.
- [x] M5: archivos grandes divididos en hooks, módulos puros y subcomponentes (2026-10-10); ningún archivo de producción de la consola supera 300 líneas salvo `DeviceInspectorInfoSections` (288 de JSX).
- [x] M6: documentación de componentes sincronizada con la API real y catálogo generado (`docs/design-system-catalog.md`).
- [x] `check:modular-components` integrado en `verify:ci`.
- [x] Validación completa y suite responsive completa (400/400) tras cada fase.
