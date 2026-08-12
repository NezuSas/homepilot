# Tareas: home-conversation-natural-voice-v1

## Auditoría de evidencia por capacidad

- [x] **Activador, normalización y corte seguro.** `apps/operator-console/src/lib/__tests__/homeConversationVoice.test.ts` verifica catálogo canónico, variantes permitidas, rechazo de activadores no válidos, comandos naturales e interrupciones.
- [x] **Conversación residencial y ruta determinística.** `packages/assistant/__tests__/assistant_conversation_service.test.ts` y `assistant_fast_path_integration.test.ts` cubren matriz conversacional, frases naturales, destino inexistente y normalización de voz.
- [x] **Audio local STT/TTS.** `apps/api/__tests__/AssistantRoutes.test.ts` verifica TTS Piper, transcripción Whisper local y error recuperable sin exponer detalles internos.
- [x] **Timeout y telemetría local.** `apps/operator-console/src/lib/__tests__/assistantApi.test.ts` y `homeConversationTelemetry.test.ts` cubren límite de espera de voz y eventos locales tipados.
- [x] **Confirmación sonora local.** `apps/operator-console/src/lib/__tests__/wakeAcknowledgementSound.test.ts` cubre la señal de dos tonos independiente de red.
- [ ] **Evidencia E2E de hardware/navegador.** Verificar en navegador real permisos de micrófono, múltiples entradas, `MediaRecorder`, silencio, barge-in y reproducción contra STT/TTS Docker.
- [ ] **Evidencia runtime Docker.** Verificar cargas de modelo, integridad y healthchecks de `homepilot-stt` y `homepilot-tts` en el perfil objetivo.

> La spec sigue en **Borrador** hasta completar las validaciones de hardware, navegador y runtime que las pruebas unitarias no pueden sustituir.