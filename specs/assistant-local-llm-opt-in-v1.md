# SPEC: Modelo de lenguaje local opcional para el asistente V1

**Estado:** Implementado
**Fecha:** 2026-10-11

## Problema

El asistente es determinista por diseño (`assistant-interactive-llm-latency-budget-v1`): los modelos locales retrasaban las respuestas en equipos sin GPU. Eso deja sin respuesta a las paráfrasis naturales ("enciéndeme la Sala 3", "quiero que se prenda la Sala 3", "ya no necesito la luz de Sala 3"). Una instalación con GPU puede ejecutar un modelo local con latencia aceptable, pero activarlo exigía editar variables a mano y exponía fallos reales del código existente:

- Los modelos con razonamiento (qwen3) devolvían una respuesta vacía porque gastaban todos los tokens pensando.
- La ventana de contexto fija de 1024 tokens truncaba el inventario de una casa.
- El plan del modelo se cortaba a 96 tokens y quedaba como JSON inválido.
- Una orden con "dale" (`dale luz a Sala 3`) se tomaba por confirmación, y los subjuntivos (`que se prenda`, `que se apague`) no se reconocían como órdenes del hogar.
- Una acción que el modelo leyó como "toda una categoría" se ejecutaba sin preguntar.

## Alcance

- Un overlay de Compose explícito, apagado por defecto, que activa un modelo local en Ollama.
- Corrección de los fallos anteriores en el cliente, el gate de ejecución y el reconocimiento de órdenes.
- Sin modelos en la nube ni servicios nuevos en los perfiles por defecto.

## Requisitos

- **REQ-01:** Ningún perfil por defecto, plantilla de entorno ni script de mantenimiento configura un modelo. El único lugar permitido es `docker-compose.assistant-llm.yml`, y `check:docker-profiles` lo valida: debe mantener el modelo local, el tiempo límite del planificador, la interpretación heredada apagada y el acceso al host, sin proveedor en la nube, puertos ni imágenes propias.
- **REQ-02:** El motor determinista responde primero. El modelo solo se consulta cuando no entiende la frase y únicamente propone un plan; autorización, validación, normalización, confianza mínima de 0.85 y confirmaciones siguen en HomePilot.
- **REQ-03:** Ante tiempo agotado, error, JSON inválido o circuit breaker abierto, la respuesta cae al flujo determinista sin ejecutar nada.
- **REQ-04:** El cliente de Ollama envía `think: false` y una ventana de contexto configurable (`OLLAMA_NUM_CTX`, 1024 por defecto).
- **REQ-05:** El plan del modelo dispone de 320 tokens y la interpretación heredada de 192. El overlay apaga la interpretación heredada para dejar una sola llamada al modelo por turno.
- **REQ-06:** Un plan que el modelo resuelve como categoría no se ejecuta; pasa al flujo determinista, que pregunta o ejecuta una acción masiva que entiende. Un plan con varias acciones sobre dispositivos distintos conserva su comportamiento.
- **REQ-07:** `dale` confirma solo, o con una cortesía breve; con un objeto es una orden. Los subjuntivos e infinitivos de encender y apagar cuentan como órdenes del hogar.
- **REQ-08:** El registro de un plan omitido por error del modelo indica la clase del fallo y los primeros 60 caracteres, nunca el texto del usuario.
- **REQ-09:** Los presupuestos de la conversación breve son configurables (`ASSISTANT_SMALLTALK_TIMEOUT_MS`, `ASSISTANT_SMALLTALK_MAX_TOKENS`) con los mismos valores por defecto.

## Medición (RTX 3060 12 GB, qwen3:8b, prompt ligero, contexto 2048)

Batería de 20 frases sobre la instalación real: órdenes 11 de 12 (la restante pidió aclaración, que es seguro) y todas las frases de seguridad sin ejecutar nada indebido. Las órdenes deterministas responden en unos 450 ms; las paráfrasis que resuelve el modelo, en unos 2,5 s; el límite de 4 s acota los peores casos. qwen2.5:3b resultó más rápido pero ejecutó acciones sobre varios dispositivos con una sola frase, por lo que no se recomienda.

## Criterios de aceptación

- [x] **AC1:** `check:docker-profiles` pasa con los perfiles por defecto sin modelo y falla si el overlay pierde sus límites.
- [x] **AC2:** `OllamaClient` envía `think: false` y la ventana configurada.
- [x] **AC3:** `dale luz a Sala 3` no es una confirmación y `quiero que se prenda la Sala 3` se trata como orden del hogar.
- [x] **AC4:** Una acción resuelta como categoría devuelve el control al flujo determinista.
- [x] **AC5:** Con el overlay, en la instalación real, "enciéndeme la Sala 3", "dale luz a Sala 3", "quita la luz de Sala 3" y "ya no necesito la luz de Sala 3" producen el efecto correcto, y sin él el asistente sigue siendo determinista.

## Evidencia

- `docker-compose.assistant-llm.yml`, `scripts/check-docker-profiles.mjs` y `docs/command-reference.md`.
- `packages/assistant/infrastructure/OllamaClient.ts`, `planner/HybridExecutionGate.ts`, `conversation/DeviceFastPathHandler.ts`, `IntentInterpreterService.ts`, `conversation/confirmationReplies.ts` y `conversation/generalQueryIntents.ts`.
