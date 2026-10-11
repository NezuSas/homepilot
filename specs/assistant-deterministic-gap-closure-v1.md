# SPEC: Cierre de brechas del asistente determinista V1

**Estado:** Implementado
**Fecha:** 2026-10-11

## Problema

Una sesión de pruebas como cliente sobre la instalación real mostró órdenes que el asistente determinista entendía a medias y ejecutaba de forma distinta a lo pedido:

- `abre la cortina de sala al 50%` abría la cortina por completo y respondía como si hubiera cumplido.
- `apaga Sala 3 en 5 segundos` apagaba al instante: ignoraba la espera sin avisar.
- `apaga todo` intentaba apagar un reproductor que Home Assistant no permite apagar, devolvía error 500 y marcaba la orden como parcialmente fallida.
- `apaga las luces` con todas ya apagadas respondía "No encontré luces", como si no existieran.
- `sube la cortina` y `baja la cortina` no se entendían, y `encendé` (voseo) tampoco.

## Alcance

- Interpretar un porcentaje explícito para una cortina como posición.
- No ejecutar una orden cuya espera en segundos no puede honrarse.
- Respetar las funciones de encendido y apagado que Home Assistant declara para un reproductor.
- Distinguir "no hay dispositivos" de "ya están en ese estado".
- Aceptar sinónimos habituales: subir y bajar cortinas, voseo de `enciende`.

## Fuera de alcance

- Modelos de lenguaje o cualquier dependencia nueva: el runtime sigue siendo determinista (`assistant-interactive-llm-latency-budget-v1`).
- Temporizadores en segundos (`assistant-relative-timers-v1` los excluye).
- Cambios de permisos, confirmaciones, aislamiento por hogar o contratos de API.

## Requisitos

- **REQ-01:** Una frase con verbo de apertura, cierre o ajuste, una cortina nombrada y un porcentaje entero de 0 a 100 produce el comando `set_position` con `position`. Un porcentaje fuera de rango o sobre algo que no es una cortina no produce `set_position`.
- **REQ-02:** Una orden de dispositivo con una espera en segundos no se ejecuta; la respuesta lo indica, aclara que no se ejecutó nada y ofrece minutos o ejecución inmediata, en español e inglés.
- **REQ-03:** Un reproductor cuyo `supported_features` es numérico y no incluye `TURN_ON` (128) o `TURN_OFF` (256) no recibe esos comandos, ni individualmente ni en acciones masivas. Si las funciones se desconocen, no se bloquea.
- **REQ-04:** Una acción masiva por estancia o global cuyos dispositivos ya están en el estado pedido responde que ya lo están; solo responde "no encontré" cuando no existe ningún dispositivo aplicable.
- **REQ-05:** `sube/subir/levanta` más cortina equivale a abrir; `baja/bajar` más cortina equivale a cerrar; `encendé` equivale a `enciende`. `baja la luz` no cambia.

## Criterios de aceptación

- [x] **AC1:** `abre la cortina de sala al 50%` y `pon la cortina sala al 30 por ciento` resuelven `set_position` con 50 y 30; `al 150` y `pon luz sala al 50` no.
- [x] **AC2:** `apaga sala 3 en 5 segundos` y `turn off the lamp in 20 seconds` responden sin ejecutar; `en 5 minutos`, `en media hora` y consultas como `cuántos segundos tiene un minuto` no se ven afectadas.
- [x] **AC3:** Un reproductor con `supported_features` 153151 no es controlable para `turn_off`; con 128, 256 y 1 sí lo es; sin el dato, sí.
- [x] **AC4:** `apaga todas las luces` con la única luz apagada responde `Las luces ya están apagadas.`; sin luces responde `No encontré luces`.
- [x] **AC5:** `sube la cortina de la sala` se normaliza a `abre la cortina de la sala`, `baja las cortinas` a `cierra la cortina`, y `baja la luz de la sala` queda igual.

## Evidencia

- `packages/assistant/application/AssistantFastPathResolver.ts` reconoce posiciones de cortina.
- `packages/assistant/application/conversation/unsupportedQualifiers.ts` detecta esperas en segundos y `ConversationRouter` responde antes de cualquier ruta de ejecución.
- `packages/assistant/application/ScopeFilter.ts` aplica las funciones de encendido declaradas por Home Assistant.
- `packages/assistant/application/conversation/RoomFastPathHandler.ts` distingue "ya está en ese estado".
- `packages/assistant/application/AssistantPromptNormalizer.ts` agrega los sinónimos.
- Pruebas: `assistant_fast_path_resolver`, `assistant_unsupported_qualifiers`, `scope_filter`, `assistant_bulk_confirmation` y `assistant_prompt_normalizer`.
