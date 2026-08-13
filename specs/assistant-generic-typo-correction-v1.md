# SPEC: Assistant Generic Typo Correction V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

`AssistantFastPathResolver` corregía errores de escritura en nombres de dispositivo mediante un
diccionario `TYPO_MAP` fijo (`'cosina': 'cocina'`, `'luy': 'luz'`, etc.). Cada nueva forma de
escribir mal un dispositivo requería añadir una entrada nueva a mano — exactamente el problema que
el usuario señaló: "sin tener que quemar las palabras que se dirán cada vez". Un diccionario fijo
solo cubre los typos que un ingeniero pensó en añadir; nunca cubre el error de escritura real que
un usuario cometa mañana sobre un dispositivo con un nombre que ni siquiera existía cuando se
escribió el diccionario.

## Alcance

- Ítem A: Utilidad de coincidencia de texto genérica y reutilizable
  (`packages/assistant/application/textMatching.ts`): normalización, distancia de Levenshtein,
  coeficiente de Dice sobre bigramas de caracteres, similitud de palabra combinada, y corrección de
  una palabra frente a un vocabulario arbitrario.
- Ítem B: `AssistantFastPathResolver` corrige errores de escritura sobre nombres de dispositivo
  construyendo el vocabulario a partir de los nombres reales de los dispositivos del hogar en cada
  petición — no de una lista estática — de modo que cualquier error de escritura sobre cualquier
  palabra que exista en ese hogar específico se corrige automáticamente.
- Ítem C: Se preserva la distinción de seguridad ya existente entre "corrección con confianza
  suficiente para ejecutar directo" (umbral 0.8) y "coincidencia insegura que debe pedir
  confirmación" (delegada al flujo `findFuzzyCandidateSuggestions` ya existente, sin cambios).

## Fuera de alcance

- No se migran los otros ~14 puntos de coincidencia difusa inventariados en el módulo del asistente
  (`PlannerV2Resolver`, `SmartEntityResolver`, `AssistantMultiCommandParser`,
  `findFuzzyCandidateSuggestions`, `nezuWakePhrases`) a la utilidad compartida en esta iteración.
  Quedan como candidatos de consolidación futura, documentados como TODO.
- No se toca `AssistantPromptNormalizer.ts`: sus reescrituras son correcciones gramaticales/de
  preposición (p. ej. "ensaila"→"en sala"), no typos de nombres de dispositivo — no crecen por
  instalación y no se benefician de un vocabulario dinámico.
- `SmartEntityResolver` sigue siendo código muerto en el camino de conversación real (solo
  inyectado, nunca invocado) — se deja documentado como candidato a eliminación, sin tocarlo.

## Requisitos funcionales

- **REQ-01**: `correctAgainstVocabulary(text, vocabulary, threshold=0.8)` corrige cada palabra de
  `text` que no exista ya en `vocabulary`, sustituyéndola por la palabra del vocabulario con mayor
  similitud si esta supera `threshold`; en caso contrario, la deja intacta.
- **REQ-02**: `AssistantFastPathResolver` construye `vocabulary` en cada llamada a `resolve()` a
  partir de `buildVocabulary(devices.map(d => d.name), STOPWORDS)` — nunca de una lista fija.
- **REQ-03**: Los sinónimos reales de dominio (`foco`/`focos`/`luces` → `luz`) se mantienen en un
  mapa `DOMAIN_SYNONYMS` explícito y pequeño, separado conceptualmente de la corrección de typos:
  son sinonimia de significado, no error ortográfico, y no se pueden derivar de un vocabulario.
- **REQ-04**: Se conserva una única excepción documentada, `SHORT_WORD_TYPOS = { luy: luz }`: para
  palabras de 3 letras, un solo carácter distinto ya representa ~33% de diferencia, por lo que la
  coincidencia genérica no puede distinguir de forma fiable una corrección válida de una
  coincidencia casual. Cualquier typo de 4+ letras (la inmensa mayoría de nombres reales de
  dispositivos/estancias) se resuelve genéricamente.

## Requisitos no funcionales

- **NFR-01**: El umbral de corrección (0.8) debe seguir bloqueando correcciones ambiguas de
  palabras cortas (p. ej. "sal"→"sala", similitud exactamente 0.8, no supera el umbral con
  comparación estricta) para no degradar el camino de confirmación "¿quisiste decir...?" ya
  existente en casos de baja confianza.
- **NFR-02**: Regresión cero sobre el comportamiento observable de `AssistantFastPathResolver` para
  los casos ya cubiertos por el `TYPO_MAP` anterior que superan el nuevo umbral genérico.

## Criterios de aceptación

- [x] AC1: Un error de escritura jamás visto antes sobre un nombre de dispositivo real de este
      hogar (p. ej. "persana" para una "Persiana Comedor", "bentilador" para un "Ventilador Techo")
      se corrige y resuelve correctamente, sin ninguna entrada de diccionario nueva.
- [x] AC2: "prende luy cosina" sigue ejecutando directo con confianza 1.0 (comportamiento previo
      preservado: "cosina"→"cocina" se corrige genéricamente a 0.833; "luy"→"luz" vía la única
      excepción documentada).
- [x] AC3: "prende lux sal" sigue devolviendo la aclaración "¿Quisiste decir 'Luz Sala'?" en vez de
      ejecutar directo — el umbral 0.8 impide que "sal"/"sala" (0.8 exacto) se autocorrija.
- [x] AC4: Suite completa sin regresiones (140 suites, 1162 tests).

## Notas técnicas y arquitectura

`packages/assistant/application/textMatching.ts` — funciones puras, sin estado, reutilizables por
cualquier colaborador del asistente: `stripDiacritics`, `normalizeText`, `levenshteinDistance`,
`diceCoefficient`, `wordSimilarity`, `correctAgainstVocabulary`, `buildVocabulary`.

`AssistantFastPathResolver.ts`: `TYPO_MAP` (8 entradas fijas) reemplazado por
`DOMAIN_SYNONYMS` (3 entradas, sinónimos reales) + `SHORT_WORD_TYPOS` (1 entrada, límite documentado
de la coincidencia genérica) + corrección genérica contra vocabulario dinámico.

## Preguntas abiertas y TODOs

- Consolidado (2026-08-13): `findFuzzyCandidateSuggestions` y `PlannerV2Resolver.normalize` ahora
  reutilizan `textMatching.levenshteinDistance`/`normalizeText` en vez de sus propias copias — se
  eliminó una de las dos implementaciones de Levenshtein y una de las ~cuatro funciones de
  normalización casi duplicadas. `PlannerV2Resolver.findBestMatches` conserva su propia escala 0-100
  sin cambios: `ASSISTANT_PLANNER_V2_EXECUTION=true` está activo en `.env`, así que ese camino
  ejecuta comandos reales y no es "solo shadow mode" como se asumió inicialmente — cualquier cambio
  de umbral ahí requiere su propia validación dedicada, no un refactor de paso.
- TODO: Quedan sin consolidar: la escala de puntuación 0-100 de `PlannerV2Resolver.findBestMatches`,
  `SmartEntityResolver` (normalización + matching por etapas), `AssistantMultiCommandParser`
  (`resolveTargets`), y el Levenshtein independiente de `nezuWakePhrases.ts` (dominio distinto:
  activación por voz, no nombres de dispositivo).
- TODO: Evaluar eliminar `SmartEntityResolver` si se confirma que sigue sin invocarse desde
  `AssistantConversationService` en la siguiente limpieza de deuda técnica.
