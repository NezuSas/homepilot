# Especificación: Ejecución de Comandos de Dispositivo y Control Básico
*(Device Command Execution & Basic Device Control)*

---

## 1. Problema
HomePilot actualmente puede modelar de forma segura la estructura topológica de los hogares (Homes y Rooms) y gestionar el ciclo de vida de los dispositivos inteligentes mediante descubrimiento (Discovery) y posterior asignación estricta (Inbox). Sin embargo, el sistema aún no posee la capacidad de enviar instrucciones operativas a dichos dispositivos. Se requiere un mecanismo transaccional seguro que permita a los usuarios legítimos alterar el estado operativo del hardware (ej. encender una luz o apagar un aire acondicionado), delegando la ejecución a capas de integración externas (Edge Gateways).

## 2. Alcance
*   Definir el modelo para la ejecución de un conjunto estricto y acotado de comandos básicos en V1 (`turn_on`, `turn_off`, `toggle`) orientados a un `Device` específico.
*   Asegurar que las órdenes provengan únicamente de identidades autenticadas a nivel perimetral, con permisos de propiedad confirmados sobre el `Home` al que pertenece el `Device` (Topological Zero-Trust).
*   Garantizar que solo los dispositivos formalmente asignados (`ASSIGNED`) a una habitación (`Room`) puedan recibir comandos (los dispositivos en `PENDING` o Inbox se consideran topológicamente inoperables).
*   Absorber el comando de aplicación y despacharlo asíncronamente (hacia la red física) pero de forma estrictamente síncrona hacia el puerto de integración (Adapter/Gateway), esperando su confirmación preliminar de transmisión.
*   Proveer trazabilidad transaccional sobre el intento de ejecución y capturar su desenlace heurístico local (éxito al despachar o fallo del despachador).

## 3. Fuera de Alcance
*   Motores de automatización, creación de escenas predefinidas, rutinas condicionales o IA.
*   Programación de eventos basados en métricas temporales (Cronjobs / Schedules).
*   Sincronización de estados entrantes (telemetría pasiva/continua) o lectura del estado físico real post-ejecución.
*   Reintentos automáticos de red distribuida con retroceso exponencial (Backoff Algorithms). El fallo recae de inmediato en el cliente/UI sin encolarse localmente en la entidad.
*   Comandos genéricos arbitrarios, diccionarios de color, niveles de atenuamiento (brightness) o payloads complejos; **V1 solo evalúa `turn_on`, `turn_off`, y `toggle`**.
*   Implementaciones de hardware real (Drivers de Home Assistant, MQTT crudo, API local de Philips Hue); solo se asume un puerto de integración abstracto.

## 4. Requisitos Funcionales (FR)
*   **FR-01: Control de Propiedad Autenticado**: Toda petición de comando debe ir estructurada mediante un contexto perimetral de usuario autenticado. El acceso al `Home` del dispositivo será verificado rigurosamente cruzando el `TopologyReferencePort`.
*   **FR-02: Filtro Estricto de Estatus**: El sistema debe rechazar instrucciones orientadas a dispositivos cuyo estatus de vida actual sea `PENDING` (solos en el Inbox, sin habitación asignada).
*   **FR-03: Autorización de Comandos V1**: Únicamente se interpretarán cadenas exactas del diccionario base: `"turn_on"`, `"turn_off"` y `"toggle"`. Cualquier otro comando debe arrojar una excepción estructural pura.
*   **FR-04: Sincronía Nominal de Transmisión (Dispatch) y Trazabilidad**: El Application UseCase debe invocar sincrónicamente el puerto saliente (Gateway) y aguardar la resolución inmediata de transmisión antes de destrabar la request HTTP.
    *   Si el Gateway acepta y despacha exitosamente a la red, se emite un `DeviceCommandDispatchedEvent`.
    *   Si el Gateway rechaza, agota la conexión o inyecta una excepción perimetral, el sistema emite el `DeviceCommandFailedEvent`. La entidad base `Device` jamás se modifica estructuralmente ante un fallo.

## 5. Requisitos No Funcionales (NFR)
*   **NFR-01: Determinismo Restrictivo**: La validación de seguridad (identidad transversal del Owner) debe ocurrir monolíticamente antes de que la orden toque cualquier proceso de ejecución hexagonal en infraestructura.
*   **NFR-02: Agnosticismo de Identidad y Mecanismos**: El diseño de contexto no debe atarse a tecnologías de tokens puntuales (como JWT Auth Bearer explícito); simplemente asume un contexto nativo de "Request Autenticado" validado por el Gateway API del proyecto en su anillo exterior.
*   **NFR-03: Política Estricta Anti-Reintentos**: En V1 el puerto despachador ejecutará la premisa `Try Once`. Ante cualquier caída o indisposición transitoria de la red IoT limítrofe, el dominio absorberá el fallo en primera instancia y lo propagará directamente impidiendo colas zombis que saturen colas internas.

## 6. Semántica HTTP
Se expone un único endpoint transaccional de acción para la inyección de comandos REST:

`POST /devices/:deviceId/commands`
*   **Condición**: Requiere Identidad Autenticada / Contexto Perimetral validado (ej. `AuthenticatedHttpRequest`).
*   **Estructura Base Payload Obligatoria**: `{ "command": "turn_on" | "turn_off" | "toggle" }`

**Respuestas Posibles**:
*   `202 Accepted`: El comando superó las validaciones formales, la Topología aprobó al usuario legítimo, y el Gateway de Hardware local aceptó exitosamente el mandato síncrono para despacharlo a la red física (efecto asíncrono real inminente).
*   `400 Bad Request`: Payload con comando vacío, arbitrario, o violando la lista blanca estricta inquebrantable de V1 (`turn_on`, `turn_off`, `toggle`).
*   `403 Forbidden`: El usuario activo autenticado no es poseedor validado del hogar que enmarca topológicamente al dispositivo afectado.
*   `404 Not Found`: El ID de dispositivo especificado no figura dentro de los registros maestros.
*   `409 Conflict`: El dispositivo se encuentra operando en estatus de aislamiento `PENDING` (Inbox), haciéndolo lógicamente inoperable para recepciones de comandos remotos.
*   `502 Bad Gateway`: El Adapter/Puerto abstracto de transmisión falló, se desconectó internamente, o la llamada síncrona rebotó el mandato forzando la negación sin reintento transitorio.

## 7. Eventos de Dominio Relevantes
Dado que la "Acción de Comando" es un factor inyectivo de Side-Effect dirigido al universo del hardware ajeno, este comportamiento abstracto de transmisión no genera mutaciones persistentes contra la entidad nativa de base de datos (`Device`), sino eventos cronológicos auditables garantizados:
*   `DeviceCommandDispatchedEvent`: Publicado en caliente tras concluir de forma exitosa y libre de fallos locales la delegación determinista del mandato al Dispatcher Port.
*   `DeviceCommandFailedEvent`: Publicado explícitamente en el instante residual cuando el proceso estalla (ej. 502) tras chocar con fallos sincrónicos levantados o inyectados por el Gateway físico, preservando la trazabilidad de control.

## 8. Modelo Conceptual y Puertos
*   **Application Services / UseCase**: Orquesta la validación segura Zero-Trust interceptando `topologyPort.validateHomeOwnership`, garantizando estatus `ASSIGNED` estricto y asumiendo finalmente la entrega atómica al puerto local dispatcher.
*   **DeviceCommandDispatcherPort (Inbound/Outbound Port)**: Interfaz hexagonal limitante totalmente aislada para la consumación de transmisión pura.
    *   Firma abstracta sugerida: `dispatch(deviceId: string, command: 'turn_on' | 'turn_off' | 'toggle'): Promise<void>`

## 9. Criterios de Aceptación (AC)
*   **AC1 (Interceptación Perimetral de Topología)**: Dado un usuario sin privilegios directos asediando, cuando intenta inyectar `turn_on` a un Device de ese hogar que no le pertenece, entonces la aplicación aborta la ejecución en frío, retorna `403 Forbidden` y en ningún momento invoca físicamente al Dispatcher o Port.
*   **AC2 (Condicionamiento Estricto de Estatus Inbox Operativo)**: Dado un propietario legítimo con permisos autentificados nativamente, cuando transmite formalmente un comando a un Device bajo estatus intacto `PENDING` (Inbox), el sistema descarta la llamada sincrónica retornando `409 Conflict` preservando su estado pasivo obligatorio.
*   **AC3 (Rechazo Restrictivo del Diccionario V1)**: Dado un propietario legal dictando control, cuando inyecta un subcomando no soportado por V1 (Ej. `"set_color"`, `"on"`, vacío), entonces el Payload parser lo bloquea recibiendo la petición un `400 Bad Request` puro sin efectuar impacto físico externo jamás.
*   **AC4 (Happy Path de Despacho Sincrónico Exitoso)**: Dado un propietario autenticado de un Device `ASSIGNED` funcional, al disparar un comando listado idéntico (`turn_on`), el servicio orquesta e invoca al Gateway, éste aguarda síncronamente, logra transmisión satisfactoria y devuelve localmente la request con HTTP `202 Accepted` emitiendo colateralmente un `DeviceCommandDispatchedEvent` auditable.
*   **AC5 (Defensa Local ante Degradación Exógena Física)**: Dado un propietario legal despachando un subcomando V1 perfectamente lícito sobre un device validado cruzado y asumiendo una interrupción/desconexión del adaptador de hardware externo (Ej. Puente Zigbee Congelado o API externa desbordada), el puerto abstracto arroja inevitablemente una intercepción Exception interna o Timeout limitante; el caso de uso absorbe el error nativo, no altera a la Entidad base en BD, propaga hacia Edge de forma controlada el resultado HTTP `502 Bad Gateway` explícitamente y gatilla obligatoriamente al sistema de monitoreo un auditable transaccional `DeviceCommandFailedEvent`.

## 10. Notas Técnicas y Arquitectura
*   La simplicidad monolítica del modelo *Fire and Forget Sincrónico* para la delegatura a la red estructural física garantiza que el Core Domain de HomePilot se asuma estrictamente con roles de "Paso de Tránsito Liviano". Al no agendar, encolar o repetir, logramos blindar a los Use Cases de los colapsos eventuales del Hardware IOT, sin la necesidad de ensuciar persistencias innecesariamente con contadores de "fallos de red" sobre la mismísima entidad Device principal.

## 11. TODOs / Preguntas Abiertas
*   ¿Cuándo introduzcamos color de luz o dimmerizado estático (Brightness level), deberíamos expandir dinámicamente el esquema del comando creando una entidad abstracta anidada separada (Payload Schema), o bastará simplemente con parametrizar el Payload base de comandos en V2?
*   ¿La entidad estática purista referida en el `DeviceCommandFailedEvent` debería acumular estadísticamente un tracking (ej. un rate limiter o contador pasivo de incidentes transitorios por UUID de Red) para rastrear de forma observacional aquellos problemas crónicos a largo plazo sin abrumar a los dueños con notificaciones push?
