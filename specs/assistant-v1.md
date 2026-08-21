# Specification: HomePilot Assistant V1

**Estado:** Implementado

## 1. Goal
Introduce an intelligent assistant layer that detects system issues and suggests actionable improvements to the user.

## 2. Requirements
- Detect new devices (not imported).
- Detect devices missing room assignments.
- Detect technical naming (snake_case, HA prefixes).
- Detect duplicate device names.
- Provide a dedicated UI to resolve or dismiss these findings.
- No autonomous changes; user must confirm every action.

## 3. Domain Model: `AssistantFinding`

| Field | Type | Description |
|---|---|---|
| id | string | UUID |
| type | string | Finding type |
| severity | string | high \| medium \| low |
| title | string | User-friendly title |
| description | string | User-friendly description |
| relatedEntityType | string \| null | e.g., "device" |
| relatedEntityId | string \| null | ID of the entity |
| status | string | open \| dismissed \| resolved |
| metadata | json | Extra context for the rule |
| createdAt | datetime | ISO timestamp |
| updatedAt | datetime | ISO timestamp |
| dismissedAt | datetime \| null | ISO timestamp |
| resolvedAt | datetime \| null | ISO timestamp |

### Types
- `new_device_available` (high)
- `device_missing_room` (high)
- `device_name_technical` (medium)
- `device_name_duplicate` (medium)

## 4. Detection Rules

### R1: New Device Available
- **Logic**: HA entity exists in discovery but not in local `DeviceRepository`.
- **Severity**: High.

### R2: Device Missing Room
- **Logic**: `device.roomId` is null or undefined.
- **Severity**: High.

### R3: Technical Name
- **Logic**: `device.name` contains `snake_case`, HA prefixes (`light.`, `switch.`, `cover.`), or numeric-only suffixes.
- **Severity**: Medium.

### R4: Duplicate Name
- **Logic**: Two or more devices have the same `name`.
- **Severity**: Medium.

## 5. Persistence
- Store in SQLite via `AssistantFindingRepository`.
- Fingerprint logic: `type` + `relatedEntityId` should be unique for "open" findings.

## 6. Actions
- **Resolve**: Redirects user to the appropriate UI (import, rename, assign room).
- **Dismiss**: Set status to "dismissed". Dismissed findings should not be re-detected for the same entity unless a new condition arises (though for V1, we just keep them dismissed).

## 7. UX / UI
- **View**: `/assistant` (Asistente).
- **Sidebar**: Badge showing count of "open" findings.
- **Cards**: Each finding has a title, description, and action buttons.

## 8. i18n
- Full support for ES and EN.
- No hardcoded strings in services.

## 9. Conversational Voice
- Assistant responses must sound like a professional residential operator: concise, calm, confident, and service-oriented.
- The assistant may use a subtle "Jarvis-like" tone, but must not become theatrical, verbose, or obscure operational clarity.
- Device execution responses must stay explicit about what was controlled.
- Successful command, scene and query responses must not append inventory-maintenance notices about devices without a room. Those notices belong to dedicated diagnostics surfaces, not every conversation turn.
- Visible and spoken answers must be concise, focused on the current request, and contain no emojis.
- Multi-line operational answers must preserve their semantic line breaks through API sanitization and render every line as a distinct visual row; neither transport nor browser whitespace handling may collapse state summaries into a single paragraph.
- En la conversación visual, confirmaciones, aclaraciones y resultados se distinguen mediante una jerarquía compacta y accesible; los estados no duplican ni compiten con el mensaje principal.
- Conversation, STT, and TTS language must follow the language selected inside HomePilot rather than the browser's original language.
- Las acciones masivas, tanto por voz como por chat, requieren una confirmación explícita y persistida antes de ejecutarse.
- Ambiguous, unsafe, or unknown commands must be acknowledged immediately and ask for a clearer device/room target.
- The assistant must not claim that an action was executed unless the execution result confirms it.
- The assistant must list only authorized rooms for home-scoped room-inventory questions, including Spanish requests for estancias, espacios, habitaciones, cuartos, and zonas.
- The assistant must support creating a named room through the existing authorized Topology use case only after an explicit conversational confirmation; a missing name must request clarification and duplicate names must not be proposed.
- The assistant must support creating named scenes and time-based routines through the existing draft workflow. A named scene requires an authorized room and an explicit controllable action; a named routine additionally requires a valid local time. The draft may become active only after an explicit conversational confirmation.


## 10. Perfil conversacional por usuario

- El usuario puede configurar una forma preferida de tratamiento mediante llámame <nombre> o call me <name> y un tono neutral, warm o formal mediante comandos explícitos.
- Las preferencias se persisten por usuario en el almacenamiento local existente; no modifican permisos, confirmaciones ni ejecución de dispositivos.
- El nombre preferido se usa en respuestas residenciales que ya admiten estilo; el tono se conserva para composición de conversación general.
- Entradas inválidas, instrucciones o referencias al sistema no se persisten.

## 11. Criterios de aceptación del perfil

- [x] AC-01: llámame Ana persiste Ana solo para el usuario actual y confirma el cambio en el idioma activo.
- [x] AC-02: Un nombre inválido no se persiste.
- [x] AC-03: Los comandos explícitos de tono persisten únicamente neutral, warm o formal.
- [x] AC-04: Una preferencia de nombre no altera validación, confirmaciones ni ejecución.


## 12. Seguridad, identidad y aislamiento

- La identidad y nombre de la sesión autenticada prevalecen sobre cualquier `userId`, nombre o `pendingAction` recibido en el cuerpo de la petición.
- La interfaz sólo envía el identificador de opción seleccionado; no conserva ni reenvía acciones pendientes, objetivos o comandos.
- La interfaz no envía nombre de usuario ni confirmaciones; ambos datos se determinan exclusivamente en el servidor.
- El intérprete local de lenguaje natural usa el mismo modelo configurado para el planificador y un presupuesto de latencia acotado para conversación; no bloquea acciones deterministas.
- Los atajos y órdenes deterministas aceptan formas naturales equivalentes, incluidos infinitivo, imperativo, invocación opcional a HomePilot/Jarvis y peticiones elípticas de estado final como "HomePilot, apagado todo", antes de consultar al modelo.
- Las órdenes masivas seleccionan solamente dispositivos con estado conocido que requieren transición: apagar incluye los encendidos y encender incluye los apagados.
- Ningún campo enviado por el cliente puede confirmar una acción. Una confirmación sólo es válida cuando corresponde a una intención pendiente del mismo usuario y se procesa mediante una respuesta positiva (`confirm` o lenguaje natural equivalente).
- Cada hallazgo incorpora el `homeId` que produjo su detección. Listados, resumen, resolución, descarte y acciones sólo operan sobre hogares pertenecientes al usuario autenticado. Los comandos de dispositivos y la ejecución de escenas validan el mismo hogar antes de despacharse.
- Las acciones administrativas sobre hallazgos exigen el rol `parent` o superior; el estado y las métricas del planificador en sombra exigen `admin`.
- El registro del planificador no conserva el texto original de la conversación, la respuesta visible ni el identificador de usuario; registra únicamente métricas técnicas y longitudes.

## 13. Criterios de aceptación de seguridad

- [x] AC-05: `POST /assistant/converse` ignora `userId`, nombre, `confirmed` y `pendingAction` suministrados por el cliente y usa exclusivamente la sesión y la memoria persistida.
- [x] AC-06: Una acción masiva por voz no se ejecuta sin confirmación persistida.
- [x] AC-07: Un hallazgo de un hogar no autorizado no se lista, resuelve, descarta ni ejecuta.
- [x] AC-08: Un escaneo resuelve únicamente hallazgos del hogar escaneado.
- [x] AC-09: Las rutas administrativas del planificador y las acciones de hallazgos validan el rol requerido.
- [x] AC-10: Los eventos operativos del planificador no incluyen prompt, respuesta ni usuario en texto plano.
- [x] AC-11: Un comando de dispositivo, escena o estancia de contexto fuera de un hogar autorizado no se despacha ni expone detalles internos al cliente.