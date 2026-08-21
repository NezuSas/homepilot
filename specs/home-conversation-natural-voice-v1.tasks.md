# Tareas: home-conversation-natural-voice-v1

## Auditoría de evidencia por capacidad

- [x] **Voice entity resolution and single-option acceptance.** Cover authorized-inventory phonetic/plural normalization, safe ambiguous handling, affirmative selection of one pending option, and bounded local Whisper contextual terms.

- [x] **Activador, normalización y corte seguro.** `apps/operator-console/src/lib/__tests__/homeConversationVoice.test.ts` verifica catálogo canónico, variantes permitidas, rechazo de activadores no válidos, comandos naturales e interrupciones.
- [x] **Conversación residencial y ruta determinística.** `packages/assistant/__tests__/assistant_conversation_service.test.ts` y `assistant_fast_path_integration.test.ts` cubren matriz conversacional, frases naturales, destino inexistente y normalización de voz.
- [x] **Audio local STT/TTS.** `apps/api/__tests__/AssistantRoutes.test.ts` verifica TTS Piper, transcripción Whisper local y error recuperable sin exponer detalles internos.
- [x] **Preferencia de lectura de respuestas.** `apps/operator-console/tests/responsive-shell.spec.ts` verifica lectura activada por defecto, solicitud de TTS tras una respuesta y persistencia de la decisión explícita tras recargar.
- [x] **Restauración del hilo y conversación directa.** `apps/operator-console/tests/responsive-shell.spec.ts` verifica que un historial largo abre directamente en el último turno y expone una acción contextual para iniciar otra conversación.
- [x] **Timeout y telemetría local.** `apps/operator-console/src/lib/__tests__/assistantApi.test.ts` y `homeConversationTelemetry.test.ts` cubren límite de espera de voz y eventos locales tipados.
- [x] **Confirmación sonora local.** `apps/operator-console/src/lib/__tests__/wakeAcknowledgementSound.test.ts` cubre la señal de dos tonos independiente de red.
- [x] **Captura manual de navegador simulada.** `apps/operator-console/tests/responsive-shell.spec.ts` verifica que una grabación aceptada genera exactamente una transcripción y una solicitud conversacional.
- [x] **Activador global de navegador simulado.** `apps/operator-console/tests/responsive-shell.spec.ts` verifica silencio inicial, voz posterior, una transcripción, una solicitud conversacional y una única señal de confirmación para `Ok Nezu`.
- [x] **Direct authorized execution.** `packages/assistant/__tests__/assistant_confirmation_policy.test.ts` verifies that explicit device, curtain, scene, global, and multi-device requests execute without confirmation while authorization and capability validation remain enforced.
- [ ] **Evidencia E2E de hardware/navegador.** Verificar en navegador real permisos de micrófono, múltiples entradas, `MediaRecorder`, silencio, barge-in y reproducción contra STT/TTS Docker.
- [x] **Evidencia runtime Docker.** Docker Desktop validado el 2026-08-11: `homepilot-stt` healthy (`whisper-local`, modelo `small`, `ready:true`), `homepilot-tts`, API y consola responden healthchecks. La integridad del modelo queda gestionada por el healthcheck de STT.

> La spec sigue en **Borrador** hasta completar las validaciones de hardware, navegador y runtime que las pruebas unitarias no pueden sustituir.
