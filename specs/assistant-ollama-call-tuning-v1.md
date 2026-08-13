# SPEC: Assistant Ollama Call Tuning V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

`OllamaClient.generateJson` llamaba a `/api/generate` con solo `{ model, prompt, stream: false,
format: 'json' }` — sin `keep_alive` (el modelo se descarga de memoria entre peticiones, pagando el
costo completo de carga en cada turno de conversación), sin `options` (temperatura por defecto no
determinista, sin límite de longitud de generación), y con `format: 'json'` (JSON sintácticamente
válido pero sin restricción de forma) en vez del JSON Schema real cuando el llamador ya lo conoce.
Esto era exactamente el hallazgo H8 documentado en la sesión de diseño de arquitectura
conversacional original, nunca implementado hasta ahora.

## Alcance

- Ítem A: `keep_alive: '30m'` en cada llamada — el modelo permanece residente en memoria entre
  peticiones en vez de recargarse cada vez.
- Ítem B: `options: { temperature, num_predict, num_ctx, top_k, top_p }` con valores por defecto
  deterministas (`temperature: 0`) y acotados (`num_predict: 256`), configurables por el llamador.
- Ítem C: `format` ahora acepta un JSON Schema completo además de `'json'` — `LlmIntentInterpreter`
  pasa `PLANNER_V2_SCHEMA` real en `interpretV2`, restringiendo la decodificación del modelo a la
  gramática válida (enums de `type`/`command`/`target.type`), en vez de solo validar después.

## Fuera de alcance

- No se toca `LlmIntentInterpreter.interpret()` (V1) — su forma de salida (`{type, sceneId,
  deviceId, command, params, reason}`) no coincide con `PLANNER_V2_SCHEMA`, así que sigue usando el
  formato `'json'` genérico.
- No se cambia el modelo por defecto (`OLLAMA_MODEL=phi3` en `.env`) — es una decisión operativa que
  depende de qué modelos estén realmente descargados en la instancia de Ollama del usuario, fuera
  del alcance de un cambio de código.
- No se implementan perfiles de modelo por hardware detectado (mencionado en el diseño original)
  — sigue siendo trabajo futuro.

## Requisitos funcionales

- **REQ-01**: Toda llamada a `generateJson` incluye `keep_alive: '30m'` en el cuerpo de la petición.
- **REQ-02**: Toda llamada incluye `options.temperature` (por defecto 0) y `options.num_predict`
  (por defecto 256), ambos configurables vía el nuevo `OllamaGenerateOptions`.
- **REQ-03**: `LlmIntentInterpreter.interpretV2` pasa `format: PLANNER_V2_SCHEMA` en vez de
  `'json'`, en todos los modos de prompt (full/light/ultra_light) — esto importa especialmente en
  modo `ultra_light`, cuyo texto de prompt omite el schema por completo a favor de ejemplos few-shot.

## Requisitos no funcionales

- **NFR-01**: Regresión cero — los tres llamadores existentes de `generateJson`
  (`AssistantSmallTalkService`, `LlmIntentInterpreter.interpret`, `LlmIntentInterpreter.interpretV2`)
  siguen funcionando con los valores por defecto sin cambiar su propio código de llamada, salvo
  `interpretV2` que ahora pasa el schema explícitamente.

## Criterios de aceptación

- [x] AC1: El cuerpo de toda petición a `/api/generate` incluye `keep_alive: '30m'` y
      `options: { temperature: 0, num_predict: 256, num_ctx: 1024, top_k: 20, top_p: 0.9 }` por
      defecto.
- [x] AC2: Un llamador puede sobrescribir `temperature`/`numPredict`/`format` sin afectar a los
      demás llamadores.
- [x] AC3: `interpretV2` invoca `generateJson` con `format` igual al `PLANNER_V2_SCHEMA` real, no la
      cadena `'json'`.
- [x] AC4: Suite completa sin regresiones (143 suites, 1195 tests).
- [x] AC5: Validado en contenedor Docker limpio con `ASSISTANT_PLANNER_V2_EXECUTION=true` — arranque
      correcto, `/health` en verde.

## Notas técnicas y arquitectura

`OllamaGenerateOptions` (nuevo, en `ports/OllamaClientPort.ts`): `model?`, `timeoutMs?`, `format?`
(antes solo aceptaba el string `'json'` implícito), `temperature?`, `numPredict?`. La implementación
en `OllamaClient.ts` aplica los valores por defecto solo cuando el llamador no los especifica —
ningún llamador existente necesitó cambios salvo `interpretV2`, que ahora pasa el schema real.

## Preguntas abiertas y TODOs

- TODO: Perfiles de modelo detectados por hardware (RAM libre + presencia de GPU), como se describió
  en el diseño original, en vez de un modelo fijo en `.env`.
- TODO: Evaluar si `num_ctx: 1024` es suficiente para el modo de prompt `full`/`light` (que incluyen
  el home map completo con más dispositivos) o si necesita ser mayor solo para esos modos.
