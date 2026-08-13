# SPEC: Assistant Multi-Command Exclusion & Zone/Category Generalization V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

Un usuario reportó que el asistente no entendía frases reales de exclusión y de zona:
"Apagada todas las luces menos dicroicos y gata" y "Apaga dicroicos de la zona tech" fallaban o se
interpretaban mal. Auditando `AssistantMultiCommandParser.ts` se confirmaron cinco defectos:

- **Bug de enrutamiento**: `parse()` comprobaba `hasConnector` antes que `hasExclusion`. Cualquier
  frase de exclusión que también contuviera un conector " y " entre los términos excluidos (el caso
  normal con dos o más excepciones) se enrutaba como comando compuesto y perdía la exclusión.
- **Una sola exclusión**: `parseExclusion` solo soportaba un `excludedRoomId`/`excludedDeviceId`.
  "menos dicroicos y gata" (dos términos) no tenía forma de expresarse.
- **Sin categorías genéricas**: la única categoría reconocida era "todo"/luces; una palabra libre
  como "dicroicos" o "ventiladores" no tenía ningún mecanismo de resolución.
- **Sin concepto de zona**: no existía ningún soporte para "CATEGORÍA de la zona X" — la única forma
  de acotar por estancia era el fast-path determinista de bulk-por-habitación con palabras clave
  fijas ("todo"/"todas las luces").
- **Fuga entre hogares**: `deviceRepository.findAll()`/`roomRepository.findAll()` sin filtro de
  hogar, no detectada en la Fase 0 de aislamiento porque esta clase nunca fue auditada en esa
  iteración.

## Alcance

- Ítem A: `parse()` prioriza `hasExclusion` sobre `hasConnector` (corrige el bug de enrutamiento).
- Ítem B: `parseExclusion` reescrito para soportar N términos de exclusión, separados por coma y/o
  "y"/"e" (`EXCEPTION_SPLIT_REGEX`), cada uno resuelto independientemente a una estancia, un
  dispositivo o una categoría libre.
- Ítem C: Detección de categoría genérica no-hardcodeada: cualquier palabra que no sea "todo" ni un
  sinónimo reconocido de luz se trata como categoría libre y se compara contra los nombres reales de
  dispositivo de ese hogar (con tolerancia singular/plural y corrección de errores de escritura vía
  `textMatching.correctAgainstVocabulary`, reutilizando la utilidad de
  [[assistant-generic-typo-correction-v1]]).
- Ítem D: Nuevo método `tryParseZoneCategoryCommand` para "CATEGORÍA de/en (la zona|el area|...)?
  NOMBRE" — dado que el dominio no tiene un concepto de "zona" distinto de `Room`
  ([[home-room-management]]), "zona X" se resuelve como una estancia llamada X.
- Ítem E: Aislamiento por hogar: constructor acepta `homeRepository?: HomeRepository` opcional;
  `getAuthorizedDevices`/`getAuthorizedRooms` usan `findAllByHomeId`/`findRoomsByHomeId` cuando hay
  `userId` y `homeRepository`, replicando el patrón ya usado en
  [[assistant-home-isolation-and-bulk-parity-v1]]. Sin `homeRepository` (construcción legacy en
  tests existentes), cae al `findAll()` sin filtrar, preservando compatibilidad hacia atrás.
- Ítem F: Un término de exclusión que no resuelve a ninguna estancia/dispositivo/categoría aborta el
  comando completo con un mensaje explicativo — nunca se ejecuta parcialmente ignorando la excepción
  no resuelta.

## Fuera de alcance

- No se introduce una entidad `Zone` real en el dominio de topología; "zona" sigue siendo sinónimo
  textual de `Room` en este parser únicamente.
- No se toca `parseCompound`/`resolveTargets` (comandos compuestos "A y B" sin exclusión) más allá
  del cambio de firma para pasar `userId`.
- No se consolida `resolveTargets`'s scoring 0-100 con `textMatching` en esta iteración (queda como
  TODO heredado de [[assistant-generic-typo-correction-v1]]).

## Requisitos funcionales

- **REQ-01**: `parse(prompt, userId?)` resuelve una frase con exclusión y conector simultáneos
  ("todas las luces menos dicroicos y gata") como exclusión con dos términos, nunca como comando
  compuesto.
- **REQ-02**: `parseExclusion` acepta 1-N términos de exclusión separados por `,`, `y` o `e`.
- **REQ-03**: La categoría base de una exclusión ("todo", "las luces", o una palabra libre como
  "ventiladores"/"dicroicos") se resuelve genéricamente contra los nombres reales del hogar, nunca
  contra una lista fija de categorías conocidas.
- **REQ-04**: `tryParseZoneCategoryCommand` resuelve "CATEGORÍA de/en [la zona/el area/...] NOMBRE"
  mapeando NOMBRE a una `Room` existente y CATEGORÍA a dispositivos de esa estancia por nombre.
- **REQ-05**: Todo acceso a dispositivos/estancias pasa por `getAuthorizedDevices`/
  `getAuthorizedRooms`, homogéneos con el resto del asistente en cuanto a aislamiento por hogar.
- **REQ-06**: Un término de exclusión no resuelto produce `{type:'failure'}` con mensaje explicativo,
  nunca una ejecución parcial que ignore la excepción.

## Requisitos no funcionales

- **NFR-01**: Regresión cero sobre los 8 tests preexistentes de `assistant_multi_command.test.ts`.
- **NFR-02**: Sin diccionario de categorías hardcodeado — el mecanismo debe generalizar a cualquier
  categoría de dispositivo presente en el hogar, no solo a los dos ejemplos literales reportados.

## Criterios de aceptación

- [x] AC1: "Apaga todas las luces menos dicroicos y gata" y su variante en voz pasiva "Apagada..."
      excluyen ambos términos y afectan solo el resto de luces.
- [x] AC2: "apaga todo, excepto la cocina, el bano y gata" (coma + "y" mezclados, con y sin tilde)
      excluye los tres términos.
- [x] AC3: "apaga todo menos la cosina" (error de escritura en el término de excepción) resuelve
      la estancia correcta vía corrección genérica, sin entrada de diccionario nueva.
- [x] AC4: Una categoría libre nunca antes vista ("ventiladores") se resuelve por nombre real de
      dispositivo, con una exclusión adicional por nombre exacto.
- [x] AC5: "Apaga dicroicos de la zona tech" y la variante sin la palabra "zona" ("apaga dicroicos en
      tech") resuelven la misma estancia y el mismo conjunto de dispositivos.
- [x] AC6: Una zona/categoría no resoluble no lanza excepción; retorna `null` (no es una frase de
      exclusión/zona) o `failure` explicativo, según corresponda.
- [x] AC7: Un término de exclusión no resoluble ("el garaje", sin estancia ni dispositivo con ese
      nombre) aborta el comando completo en vez de ignorarlo.
- [x] AC8: Ningún dispositivo de un hogar ajeno al usuario aparece en el alcance base ni en el
      vocabulario de corrección de excepciones.
- [x] AC9: Construcción sin `homeRepository` (compatibilidad con los sitios de construcción
      existentes en tests) sigue funcionando vía `findAll()` sin filtrar.
- [x] AC10: Suite completa sin regresiones (144 suites, 1208 tests), typecheck y build limpios.

## Notas técnicas y arquitectura

`packages/assistant/application/AssistantMultiCommandParser.ts`: constructor con tercer parámetro
opcional `homeRepository?: HomeRepository`; `getAuthorizedDevices`/`getAuthorizedRooms` replican el
patrón de `IntentInterpreterService`. `parse()` invierte la prioridad `hasExclusion` > `hasConnector`
y añade `tryParseZoneCategoryCommand` como tercera rama. `parseExclusion` reescrito: separa base y
excepciones, resuelve la categoría base (bulk/luces/libre) reutilizando `ScopeFilter`, divide las
excepciones con `EXCEPTION_SPLIT_REGEX`, y resuelve cada una contra estancias, dispositivos (con
comparación de nombre cruda y con artículos/preposiciones eliminados vía `stripArticlesAndBulkWords`)
o categoría con tolerancia singular/plural (`categoryMatchesDeviceName`).

`bootstrap.ts:262`: se añade `repos.homeRepository` como tercer argumento del constructor.

`packages/assistant/application/IntentInterpreterService.ts:56`: `multiCommandParser.parse(prompt,
userId)` — prerequisito para que el parser pueda aplicar aislamiento por hogar.

## Preguntas abiertas y TODOs

- TODO: `resolveTargets` (usado por `parseCompound`, comandos compuestos sin exclusión) sigue con su
  propio scoring 0-100 sin consolidar con `textMatching`; hereda el TODO de
  [[assistant-generic-typo-correction-v1]].
- TODO: Si en el futuro se introduce una entidad `Zone` real distinta de `Room`, revisar
  `tryParseZoneCategoryCommand` para resolver contra ambas en vez de asumir que "zona" siempre
  equivale a una estancia.
