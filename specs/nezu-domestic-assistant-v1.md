# SPEC: Asistente Doméstico Nezu V1

- Estado: borrador preparado para implementación
- Fecha: 2026-08-05
- Propietario: HomePilot

## 1. Problema

HomePilot ya dispone de conversación, activador de voz, STT, TTS, memoria, planificación y ejecución de dispositivos. Sin una definición unificada, estas capacidades pueden evolucionar como flujos aislados y producir respuestas tardías, duplicadas o poco útiles para una vivienda.

Esta especificación define el producto **Asistente Doméstico Nezu**. “Jarvis doméstico” describe el nivel de experiencia buscado; no se utiliza como identidad, integración ni referencia de marca dentro del producto.

## 2. Alcance

- Unificar el comportamiento esperado para chat, activación por voz y ejecución de acciones del hogar.
- Definir el ciclo de una interacción, recuperación ante errores y descarte de respuestas obsoletas.
- Establecer límites de contexto, permisos, confirmaciones, privacidad, observabilidad e internacionalización.
- Dividir la implementación posterior en fases verificables.
- Mantener HomePilot como fuente de verdad; Home Assistant puede ser un bridge opcional.

## 3. Fuera de alcance

- Crear un asistente paralelo, otro sistema de memoria o un nuevo contrato HTTP.
- Cambiar la política actual de dispositivos, rutinas, cámaras o multimedia sin una spec posterior.
- Ejecutar acciones fuera de una sesión autenticada de HomePilot.
- Hacer obligatorio un modelo en la nube, guardar audio por defecto o usar identidad de terceros.

## 4. Principios de producto

1. **Local primero:** la experiencia debe seguir siendo útil cuando no exista acceso externo.
2. **Resultado verificable:** una acción solo se confirma como realizada tras recibir el resultado del ejecutor.
3. **Respuesta mínima útil:** clara, breve, sin emojis ni inventario irrelevante de dispositivos sin asignar.
4. **Sin respuestas antiguas:** una orden cancelada o reemplazada no puede hablar ni sobrescribir el estado actual.
5. **Idioma coherente:** texto y voz siguen el idioma seleccionado dentro de HomePilot.
6. **Privacidad por diseño:** secretos, tokens, audio y contenido sensible no se exponen en la interfaz ni en auditorías ordinarias.
7. **Lenguaje semántico, no quemado:** el asistente no construye respuestas, errores, preguntas ni confirmaciones con cadenas literales repartidas en código. Produce un resultado semántico tipado que un compositor localizado transforma en texto y voz.

## 5. Casos de uso

| ID | Caso | Resultado esperado |
|---|---|---|
| UC-01 | Control de un dispositivo | Ejecuta una capacidad permitida y comunica el resultado real. |
| UC-02 | Control por estancia | Resuelve luces, cortinas u otros dispositivos visibles de la estancia solicitada. |
| UC-03 | Ejecutar rutina | Ejecuta una escena o automatización disponible para el usuario. |
| UC-04 | Consultar estado | Responde con el estado actual sin modificar el hogar. |
| UC-05 | Petición ambigua | Solicita una aclaración breve antes de ejecutar. |
| UC-06 | Interrupción | Cancela captura, transcripción, planificación, TTS y callbacks pendientes. |
| UC-07 | Error recuperable | Mantiene la interfaz disponible y explica solo el error útil. |

## 6. Requisitos funcionales

### RF-01. Entrada unificada

Chat, micrófono manual y activador de voz deben crear una interacción identificable por `turnId`, origen e idioma. No se debe crear una segunda ruta de negocio para cada superficie.

### RF-02. Ciclo de interacción

```text
idle -> wake_detected -> listening_order -> transcribing -> resolving
     -> confirming (opcional) -> executing -> responding -> idle

cualquier estado -> cancel_requested | timeout | error -> idle
```

- Cada origen mantiene como máximo una interacción activa.
- La cancelación invalida TTS, solicitudes pendientes y callbacks asociados al `turnId` cancelado.
- Un callback tardío no puede actualizar el transcript, respuesta ni estado de una interacción posterior.
- Un transcript vacío libera el ciclo sin bloquear una nueva activación.

### RF-03. Captura y STT

- Una captura produce como máximo una solicitud STT.
- Los errores HTTP transitorios, incluidos conflictos de sesión, se tratan como finalización recuperable, no como bloqueo permanente.
- No se reproduce el sonido de activación más de una vez por interacción aceptada.

### RF-04. Contexto autorizado

El asistente usa solo hogares, estancias, dispositivos, rutinas y tableros que el usuario actual puede consultar o controlar. El contexto se construye con servicios existentes, sin duplicar permisos en el cliente.

### RF-05. Resolución y ejecución

- Se reutilizan `AssistantConversationService`, `AssistantContextBuilder`, `AssistantFastPathResolver`, el planificador existente, políticas de confirmación y capacidades de dispositivos.
- El asistente no inventa capacidades ni estados.
- La sincronización de estado debe propagarse a Inicio, Espacios, Tableros y demás superficies afectadas.

### RF-06. Confirmaciones

- En voz se conserva la política actual: acciones masivas no requieren una segunda confirmación innecesaria cuando la política las permite.
- En chat se conserva la confirmación visual cuando la acción sea sensible según la política existente.
- Ante ambigüedad, primero pregunta; no adivina el objetivo.

### RF-07. Respuesta

Toda interacción termina en una de estas categorías: `completed`, `needs_clarification`, `needs_confirmation`, `cancelled`, `failed` o `no_speech`. La respuesta comunica solo la información necesaria para el usuario.

### RF-08. Composición semántica e i18n

- Los servicios de dominio devuelven un resultado tipado por intención, por ejemplo `assistant.action_completed`, junto con parámetros seguros como nombre visible, estancia y estado confirmado.
- El cliente y TTS resuelven ese resultado desde un catálogo i18n central; no deben recibir ni duplicar frases completas desde servicios, rutas, componentes o callbacks.
- Cada clave usada por el asistente debe existir en español e inglés. Una clave sin resolver debe usar el fallback del idioma configurado y generar telemetría técnica sin exponer contenido sensible.
- Las variaciones de redacción, tono y personalidad se definen como plantillas versionadas por idioma, no como condicionales con textos literales. La plantilla no puede cambiar hechos, permisos ni el resultado de ejecución.
- Los nombres que el usuario creó para hogares, estancias, dispositivos y rutinas se conservan como datos; no se traducen ni se alteran dentro de la respuesta.

### RF-09. Voz e idioma

TTS usa el idioma seleccionado en la aplicación, no únicamente el idioma del navegador. Si TTS falla, la respuesta escrita continúa disponible.

### RF-10. Activador

La frase canónica es **Ok Nezu** y sus variaciones permitidas se gestionan desde el catálogo central existente. El activador descarta audio, transcript y respuestas anteriores antes de abrir una nueva interacción.

### RF-11. Auditoría útil

La auditoría registra evento, resultado, entidad legible y marca de tiempo. No almacena tokens, secretos, audio ni prompts completos por defecto y agrupa eventos técnicos repetitivos para no ocultar información útil.

## 7. Arquitectura objetivo

```text
Chat / Micrófono / Activador
          |
   Coordinador de interacción del cliente
          |
STT / TTS / ciclo de cancelación
          |
 AssistantConversationService
   |         |          |
Contexto  Fast path    Planner / seguimiento
   |         |          |
Política de confirmación y capacidades
          |
Ejecutor de dispositivos / rutinas
          |
Respuesta saneada + auditoría + sincronización de estado
```

`packages/assistant` conserva la lógica de dominio. El cliente controla permisos de micrófono, accesibilidad, presentación y cancelación local. `AssistantRoutes` permanece como límite HTTP; cualquier cambio de contrato requiere una spec de implementación específica.

```text
Resultado de dominio tipado
          |
 Compositor de respuestas semánticas
          |
Catálogo i18n + parámetros seguros + plantilla de tono
          |
    Texto UI y síntesis TTS
```

## 8. Requisitos no funcionales

- **Continuidad:** no dejar bloqueado el micrófono ni la interfaz después de error, silencio, timeout o cancelación.
- **Rendimiento:** conservar datos visibles durante refresh; evitar solicitudes STT, TTS y estado duplicadas.
- **Seguridad:** las instrucciones de usuario nunca tienen privilegios de sistema; no revelar datos no autorizados.
- **Accesibilidad:** estados de escucha, proceso, éxito y fallo comprensibles sin depender exclusivamente del color.
- **Responsive:** el compositor y controles de voz permanecen visibles con teclado virtual en móvil y tableta.
- **i18n:** no mezclar idiomas ni claves sin resolver en superficies del asistente; no introducir textos literales fuera de los catálogos centralizados.

## 9. Criterios de aceptación

- [ ] Una activación genera una sola captura y una sola solicitud STT.
- [ ] Cancelar una interacción impide que respuestas, TTS o resultados tardíos aparezcan después.
- [ ] Un transcript vacío, 409 o timeout devuelve el ciclo a disponible sin reactivar solo.
- [ ] El contexto respeta permisos de usuario y nunca revela entidades ajenas.
- [ ] La respuesta coincide con el resultado confirmado por el ejecutor y no incluye avisos de inventario irrelevantes.
- [ ] Los resultados de dominio del asistente no contienen frases completas de interfaz; texto, TTS, confirmaciones y errores se componen desde claves i18n y parámetros tipados.
- [ ] Cada clave del asistente tiene traducción en español e inglés, con fallback controlado para una clave ausente.
- [ ] Se respeta la política de confirmación actual para chat, voz y acciones sensibles.
- [ ] El cambio manual de idioma modifica texto y voz del asistente.
- [ ] `Ok Nezu` es la frase principal y una nueva activación limpia el turno anterior.
- [ ] La auditoría muestra eventos útiles y agrupa ruido técnico repetitivo.
- [ ] Se cubren cancelación, carrera de callbacks, permisos, idioma y recuperación con pruebas.
- [ ] Las validaciones obligatorias pasan: `npm run typecheck`, `npm run build`, `npm run build --prefix apps/operator-console` y `npm run test`.

## 10. Plan de implementación posterior

1. **Fase A — Contratos y ciclo:** tipar estados y coordinar turnos sin duplicar flujos.
2. **Fase B — Voz robusta:** reforzar activador, captura, STT, TTS, cancelación y recuperación.
3. **Fase C — Contexto y seguridad:** validar permisos, confirmaciones y auditoría útil.
4. **Fase D — Experiencia residencial:** compositor semántico, respuestas concisas, i18n, accesibilidad y superficies responsivas.
5. **Fase E — Observabilidad y endurecimiento:** métricas locales mínimas, pruebas de carreras y validación Docker.

Cada fase requiere su actualización de tareas, pruebas y aceptación antes de cambiar APIs, persistencia o políticas de ejecución.

## 11. Decisiones pendientes

- Catálogo exacto de acciones consideradas sensibles.
- Retención y activación voluntaria de telemetría de voz sin contenido.
- Personalidad por hogar frente a una personalidad única Nezu.
- Tratamiento final de restricciones de autoplay en navegadores.
