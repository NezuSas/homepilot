# Tareas: Assistant Multi-Command Exclusion & Zone/Category Generalization V1

## Implementación

- [x] AC1/AC2: `parse()` prioriza `hasExclusion` sobre `hasConnector`; `EXCEPTION_SPLIT_REGEX`
      soporta N términos separados por coma y/o "y"/"e".
- [x] AC3/AC4: Categoría base y términos de exclusión resueltos genéricamente contra nombres reales
      de dispositivo/estancia vía `textMatching.buildVocabulary`/`correctAgainstVocabulary`, sin
      diccionario de categorías hardcodeado.
- [x] AC5/AC6: Nuevo método `tryParseZoneCategoryCommand` — "CATEGORÍA de/en [la zona/...] NOMBRE"
      resuelto contra `Room`.
- [x] AC7: Un término de exclusión no resoluble aborta el comando completo (`{type:'failure'}`).
- [x] AC8/AC9: `homeRepository?` opcional en el constructor; `getAuthorizedDevices`/
      `getAuthorizedRooms` home-scoped con fallback a `findAll()` sin filtrar cuando no se provee.
- [x] `bootstrap.ts:262` actualizado con el tercer argumento `repos.homeRepository`.
- [x] `IntentInterpreterService.ts:56` pasa `userId` a `multiCommandParser.parse()`.

## Verificación

- [x] AC1-AC7: 11 tests nuevos en `assistant_multi_command_generalization.test.ts` cubriendo ambas
      frases literales reportadas por el usuario, exclusiones múltiples con coma+"y" mezclados,
      tolerancia a errores de escritura, categoría libre nunca antes vista, zona con y sin la
      palabra "zona", zona no resoluble, y término de exclusión no resoluble.
- [x] AC8: test de aislamiento entre hogares (`never leaks devices from another home...`).
- [x] AC9: test de compatibilidad sin `homeRepository`.
- [x] AC10: `npx tsc --noEmit`, suite completa (144 suites, 1208 tests) sin regresiones, incluidos
      los 8 tests preexistentes de `assistant_multi_command.test.ts` sin modificar.
- [x] `check:spec-coverage` (conteo actualizado a 582), `check:bdd-traceability`,
      `check:architecture-boundaries`, `check:no-production-any`, `check:module-test-coverage` —
      todos en verde.
