# Tareas: HomePilot Assistant V1

## Implementado

- [x] Hallazgos de inventario y su interfaz de resolución están cubiertos por pruebas de Assistant y rutas API.

## Verificación pendiente

- [ ] Validar los criterios conversacionales de `assistant-v1.md` mediante las suites `packages/assistant/__tests__`.
- [ ] Mantener el formato residencial opcional: sin nombre de usuario, las respuestas conservan el mensaje funcional original.
- [ ] Registrar en esta tarea cualquier cambio de comportamiento conversacional antes de implementarlo.


## Perfil conversacional

- [x] AC-01: Cubrir persistencia de nombre preferido y su reconocimiento por usuario.
- [x] AC-02: Cubrir rechazo de entradas inválidas.
- [x] AC-03: Cubrir detección y persistencia de tono.
- [x] AC-04: `packages/assistant/__tests__/assistant_conversation_service.test.ts` verifica que el nombre preferido conserva la misma validación, confirmación y despacho del comando.


## Endurecimiento de seguridad conversacional

- [x] Vincular la identidad de conversación a la sesión autenticada y descartar confirmaciones inyectadas por el cliente.
- [x] Descartar pendingAction y nombre enviados por el cliente; usar sólo la sesión autenticada y la memoria persistida.
- [x] Eliminar del cliente la persistencia y reenvío de acciones pendientes; las selecciones usan sólo su identificador.
- [x] Requerir confirmación persistida para acciones masivas por voz y chat.
- [x] Aislar hallazgos, acciones y escaneos por hogar autorizado.
- [x] Limitar acciones administrativas y telemetría del planificador por rol.
- [x] Eliminar prompt, respuesta e identidad de los registros del planificador en sombra.
- [x] Verificar autorización del hogar antes de ejecutar dispositivos, escenas, atajos y reintentos conversacionales.
