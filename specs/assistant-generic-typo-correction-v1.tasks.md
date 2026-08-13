# Tareas: Assistant Generic Typo Correction V1

## Implementación

- [x] AC1/AC2/AC3: `packages/assistant/application/textMatching.ts` — normalización, Levenshtein,
      Dice, similitud combinada, corrección contra vocabulario, construcción de vocabulario.
- [x] AC2/AC3: `AssistantFastPathResolver` reescrito: `TYPO_MAP` → `DOMAIN_SYNONYMS` +
      `SHORT_WORD_TYPOS` + vocabulario dinámico construido por petición desde los nombres reales
      de dispositivo.
- [x] Umbral de corrección calibrado a 0.8 para preservar la frontera de seguridad entre
      autoejecución y aclaración "¿quisiste decir...?".

## Verificación

- [x] AC1: Tests nuevos en `text_matching.test.ts` — typos nunca vistos ("persana", "bentilador")
      se corrigen sin diccionario.
- [x] AC2: `assistant_fast_path_resolver.test.ts` — "prende luy cosina" sigue ejecutando directo.
- [x] AC3: `assistant_bulk_refined.test.ts` — "prende lux sal" sigue pidiendo confirmación.
- [x] AC4: `npx tsc --noEmit`, `npm run build`, suite completa (140 suites, 1162 tests) sin
      regresiones.
- [x] `check:spec-coverage` (conteo actualizado 573→575), `check:bdd-traceability`,
      `check:architecture-boundaries`, `check:no-production-any`, `check:module-test-coverage` —
      todos en verde.
