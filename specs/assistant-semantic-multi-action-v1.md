# SPEC: Assistant Semantic Multi-Action Plans V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

El camino semántico (`AssistantPlannerV2ShadowService.attemptHybridExecution`), que ejecuta
comandos reales en producción (`ASSISTANT_PLANNER_V2_EXECUTION=true`), rechazaba de plano cualquier
plan con más de una acción (`plan.actions.length !== 1 → skip('multiple_actions')`), aunque el
contrato `AssistantPlanV2`/`PlannerAction` ya soporta un arreglo de N acciones y el validador no
imponía ningún límite. Esto significaba que una orden compuesta ("prende la sala y la cocina")
solo podía entenderse si coincidía exactamente con el conector fijo del parser determinista
(`AssistantMultiCommandParser`: `" y "`, `" tambien "`, `" ademas "`, `" pero "`, ...), que además
corre *después* del camino semántico en el orden de compuertas de `converse()` — es decir, ninguna
frase compuesta con otra redacción llegaba nunca al LLM para intentarlo de otra forma.

## Alcance

- Ítem A: `attemptHybridExecution` acepta planes con más de una acción cuando todas comparten el
  mismo comando (`turn_on`/`turn_off`/`toggle`) y cada una resuelve a exactamente un dispositivo
  distinto — reutilizando la forma de retorno "multi-objetivo con guardia" ya existente para
  categorías/múltiples dispositivos, de modo que el flujo de confirmación por ticket (ya
  implementado) lo cubre sin ningún cambio adicional.
- Ítem B: Límite explícito de 8 acciones por plan, añadido tanto al `PLANNER_V2_SCHEMA` (mediante
  `maxItems`, restringiendo la propia generación del modelo) como a `PlannerV2Validator` (defensa en
  profundidad, independiente de cualquier límite de la compuerta de ejecución).

## Fuera de alcance

- No se soportan planes con comandos mixtos (p. ej. "enciende la sala y apaga la cocina") por el
  camino semántico — se descarta el plan completo (`mixed_commands_unsupported`) y cae al parser
  determinista, que sí soporta comandos distintos por segmento.
- No se soporta resolución por pronombre/contexto dentro de un plan multi-acción — cualquier acción
  con `target.type === 'context_reference'` descarta el plan completo. Los pronombres siguen
  resolviéndose únicamente en planes de una sola acción.
- No se cambia el umbral de confianza (0.85) ni la lista de comandos permitidos — cada acción del
  plan multi-acción se valida individualmente con las mismas reglas que ya existían para el caso de
  una sola acción.

## Requisitos funcionales

- **REQ-01**: Un plan con N acciones (2 ≤ N ≤ 8) donde todas comparten el mismo comando y cada una
  resuelve a un único dispositivo distinto produce `{ command, confidence: min(confidencias),
  resolvedType: 'multiple', resolvedIds: [...] }` — la misma forma que ya usa el camino de una sola
  acción cuando resuelve una categoría o múltiples dispositivos.
- **REQ-02**: Cualquier fallo de una sola acción del plan (comando inválido, confianza insuficiente,
  resolución no única, referencia de contexto/pronombre) descarta el plan **completo** — nunca se
  ejecuta ni se propone una confirmación parcial.
- **REQ-03**: Un plan con comandos distintos entre acciones se descarta completo
  (`mixed_commands_unsupported`), dejando el caso a `AssistantMultiCommandParser`.
- **REQ-04**: Un plan de más de 8 acciones se descarta (`too_many_actions`) sin intentar resolver
  ninguna acción.
- **REQ-05**: `PlannerV2Validator.validate` rechaza cualquier plan con más de 8 acciones,
  independientemente de si llega por el camino de ejecución en vivo o por shadow mode.

## Requisitos no funcionales

- **NFR-01**: Regresión cero sobre el camino de una sola acción — el bloque de código para
  `plan.actions.length === 1` no cambió su lógica interna, solo se reordenó dentro de la función.
- **NFR-02**: El nuevo camino multi-acción reutiliza el mecanismo de tickets de confirmación de un
  solo uso ya existente (`specs/assistant-confirmation-tickets-v1.md`) sin modificarlo — la función
  de resolución multi-acción solo produce la misma forma de retorno "guardado", nunca ejecuta
  directamente.

## Criterios de aceptación

- [x] AC1: "prende la sala y la cocina" (dos acciones, mismo comando, cada una resuelve a un
      dispositivo distinto) crea un ticket de confirmación con ambos `deviceIds` y, al confirmar,
      ejecuta ambos dispositivos.
- [x] AC2: "prende la sala y apaga la cocina" (comandos distintos) se descarta completo por el
      camino semántico, sin llamar al resolvedor.
- [x] AC3: Si una de dos acciones no resuelve a un único dispositivo, el plan completo se descarta
      — no se ejecuta ni se confirma nada.
- [x] AC4: Un plan con una referencia de contexto/pronombre dentro de un conjunto multi-acción se
      descarta completo.
- [x] AC5: Un plan de 9+ acciones se descarta sin invocar al resolvedor;
      `PlannerV2Validator` rechaza el mismo caso de forma independiente.
- [x] AC6: Suite completa sin regresiones (142 suites, 1183 tests).
- [x] AC7: Validado en contenedor Docker limpio con
      `ASSISTANT_PLANNER_V2_EXECUTION=true` — arranque correcto, `/health` en verde.

## Notas técnicas y arquitectura

`AssistantPlannerV2ShadowService.attemptHybridExecution` (líneas ~327–342): el gate original
`plan.actions.length !== 1 → skip('multiple_actions')` se sustituyó por una bifurcación — un solo
elemento sigue el camino ya existente sin cambios; más de uno delega en el nuevo método privado
`attemptMultiActionResolution`, que falla en bloque (nunca parcialmente) ante cualquier acción
inválida, y devuelve exactamente la misma forma `{ command, confidence, resolvedType: 'multiple',
resolvedIds }` que ya consume sin cambios `AssistantConversationService.attemptV2HybridExecution`
en su "Multi-Target Guard" (que ya crea el ticket de confirmación y nunca ejecuta directo para más
de un dispositivo).

## Preguntas abiertas y TODOs

- TODO: Evaluar soportar comandos mixtos dentro de un plan multi-acción si se detecta demanda real
  (requeriría extender `ConfirmationTicket` para almacenar un comando por dispositivo en vez de uno
  compartido para todo el ticket).
- TODO: Evaluar mover el camino semántico (`attemptV2HybridExecution`) más temprano en el orden de
  compuertas de `converse()` — hoy corre en la posición ~19 de ~21, después de casi todos los
  caminos rápidos deterministas, lo que limita cuánto puede generalizar aunque ahora soporte más
  casos.
