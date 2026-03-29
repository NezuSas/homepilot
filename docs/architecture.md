# Arquitectura del Sistema: HomePilot

## Visión General de la Arquitectura
HomePilot sigue una arquitectura híbrida Edge/Cloud con un límite estricto entre ambos. El núcleo del sistema está diseñado como un conjunto de contextos delimitados (bounded contexts) modulares que se comunican a través de un bus de eventos fuertemente tipado.

### Separación de Responsabilidades

#### 1. Edge (Sistema Local)
La capa Edge es la fuente de verdad (*source of truth*) para el hogar físico. Se ejecuta localmente y es responsable de:
- Comunicación con dispositivos (MQTT, APIs locales, Zigbee/Z-Wave vía puentes).
- Procesamiento de eventos casi en tiempo real (near real-time).
- Ejecución de automatizaciones y rutinas locales.
- Exposición de una API local para las aplicaciones cliente.

#### 2. Cloud (Futuro)
La capa Cloud es estrictamente aditiva. El sistema Edge debe funcionar al 100% sin ella. Cuando se implemente, la capa Cloud manejará:
- Proxies para acceso remoto.
- Ejecución de modelos pesados de ML/IA que el hardware Edge no puede soportar.
- Almacenamiento a largo plazo de métricas y analíticas.
- Gestión de flotas multi-hogar y licencias (para instaladores).

#### 3. Aplicaciones Cliente
Las aplicaciones cliente (iOS, Android, Dashboards Web) son interfaces sin estado (*stateless shells*) que renderizan datos provistos por las APIs Edge o Cloud. No contienen lógica de negocio.

---

## 1. Modelo de Dominio (Nivel Negocio)

El dominio define la jerarquía lógica y los límites de propiedad (*ownership boundaries*) dentro de HomePilot. 

### Entidades Principales
- **Home (Hogar)**: La unidad organizativa física principal. Representa una casa o edificio físico. Contiene Zonas, Habitaciones y Dispositivos. Un Home se ejecuta sobre un entorno Edge específico (el hardware/hub local).
- **Project (Proyecto)**: El nivel administrativo de más alto nivel para integradores y empresas de domótica. Un Project puede contener múltiples *Homes* (ej. un desarrollo inmobiliario o los clientes de un instalador).
- **User (Usuario)**: El residente físico o propietario del Home. Tiene permisos para operar, automatizar y gestionar el hogar en el día a día.
- **Installer (Instalador)**: Una entidad técnica remota asociada a un *Project*. Cuenta con permisos elevados para añadir hardware, ver diagnósticos del sistema y modificar la topología, pero con acceso restringido a la información privada o cámaras sin consentimiento del *User*.

### Modelo Multi-Tenant
El modelo multi-tenant se maneja principalmente en el nivel **Cloud/Project**:
- **Aislamiento**: Cada *Home* es un tenant completamente aislado a nivel de datos y bus de eventos. Un evento de *Home A* jamás debe cruzar al bus de *Home B*.
- **Jerarquía**: `Project (Tenant Global) -> Home (Sub-tenant físico) -> User`.

### Ownership Boundaries (Límites de Propiedad)
- El **User** es dueño de sus datos de uso, automatizaciones personales y perfiles (configuraciones, dashboard layouts).
- El **Installer/Project** es dueño del soporte técnico, estado del hardware (diagnósticos), y licencias del sistema operativo HomePilot asociado a ese *Home*.

---

## 2. Modelo de Eventos (Crítico)

Todo en HomePilot se comunica a través de un bus de eventos asíncrono y estandarizado, separando la emisión de los consumidores.

### Tipos de Eventos
1. **Eventos de Estado (State Events)**: Describen un hecho que *ya ocurrió* y no puede ser rechazado. (Ej. `DeviceStateChanged`). Cambian proyecciones y alimentan automatizaciones.
2. **Eventos de Comando (Command Events)**: Peticiones explícitas para realizar una acción. Pueden ser validadas, aceptadas o rechazadas. (Ej. `TurnOnLightCommand`).
3. **Eventos del Sistema (System Events)**: Informan sobre la salud e infraestructura del sistema (ej. caídas de red, reinicios). (Ej. `HubDisconnected`).

### Convención de Nombres (Naming)
- Eventos de Estado (Pasado): `[Sujeto][Acción en Pasado]Event` -> `LightTurnedOnEvent`, `RoomCreatedEvent`.
- Eventos de Comando (Imperativo): `[Verbo][Sujeto]Command` -> `TurnOnLightCommand`, `AssignDeviceToRoomCommand`.

### Estructura de un Evento (Payload)
Todos los eventos asumen un esquema universal inmutable. Ejemplo de una carga útil:

```json
{
  "eventId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "eventType": "LightTurnedOnEvent",
  "version": "1.0",
  "source": "domain:device-management:integration:mqtt",
  "timestamp": "2026-03-28T10:00:00Z",
  "correlationId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "payload": {
    "deviceId": "light-123",
    "newState": "ON",
    "brightness": 80
  }
}
```

### Metadatos Obligatorios
- **`timestamp`**: Formato estricto ISO-8601 (UTC). Cuándo ocurrió con exactitud milimétrica.
- **`source`**: URN estricto de quién emitió el evento (ej. `automation-engine`, `app:ios:user1`, `agent:ai:core`).
- **`correlationId`**: Usado para rastrear la cadena de causalidad completa. Si la orden inicial (`TurnOnLightCommand`) genera múltiples transiciones y procesos, TODOS los eventos resultantes comparten este ID.
- **`version`**: Versión del esquema del payload, clave para la evolución progresiva sin romper retrocompatibilidad.

---

## 3. Estrategia de Estado y Persistencia

### Source of Truth (Fuente de la Verdad)
La **Capa Edge** retiene siempre un monopolio absoluto como fuente de verdad del hogar. El Cloud nunca es maestro, sólo actúa como un esclavo (réplica o snapshot asíncrono) para visualización remota.

### Rol de la Base de Datos Local
HomePilot Edge diversifica su persistencia en dos responsabilidades separadas (estilo CQRS):

1. **Almacenamiento de Estado (Document/Key-Value)**: Almacena exclusivamente el estado más reciente o "foto actual" (Current State). Ej. ¿Dime instantáneamente cuántas luces están encendidas? Optimizado para lecturas ultrarrápidas y renderizado de la interfaz gráfica.
2. **Almacenamiento de Eventos (Event Store / Time-Series)**: Una bitácora de solo-inserción (append-only logic). Almacena íntegramente cada mensaje del bus de eventos. Es la base sobre la que se apoya el motor ML para inferir costumbres, rutinas y anomalías.

### Estrategia de Sincronización
La comunicación Edge->Cloud opera mediante el patrón "Event Forwarding". El Edge actúa de buffer asíncrono. Cuando hay conexión, se replican los eventos de interés. Si internet falla, el sistema encola localmente sin afectar el funcionamiento del Home.

---

## 4. Capa de IA (Diseño Profundo)

La Inteligencia Artificial en HomePilot está enjaulada dentro de sus límites. Funciona como un servicio más en el Edge que lee el Event Bus y reacciona de manera auditable.

### Tipos de Acciones de IA
- **Sugerencias (Pasiva)**: Analiza el event store y recomienda nuevas automatizaciones. (Ej. "Noté que el riego sucede a las 7 AM. ¿Deseas crear una automatización para los lunes y miércoles?").
- **Recomendaciones (Proactiva)**: Alerta contextual dinámica con botones de acción inmediata (Push Notification). (Ej. "Parece que dejaste abierta la puerta del garaje. [Cerrar Ahora]").
- **Acciones Automáticas (Autónoma)**: La IA genera Comandos sin validación humana basada en configuraciones de emergencia o extrema confianza. (Ej. Fuga de agua detectada -> `ShutOffMainValveCommand`).

### Niveles de Autonomía y Permisos (Seguridad)
La IA opera bajo control de acceso (RBAC) con tres perfiles:
1. **Sombra (Shadow)**: Acceso de solo lectura al Bus. Permiso exclusivo para emitir Push Notifications.
2. **Delegado (Delegate)**: Lectura/Escritura para iluminación, cortinas, climatización o medios multimedia (Impacto no crítico).
3. **Bloqueo Restringido (Restricted)**: Por defecto, la IA tiene prohíbido modificar cerraduras, sistemas de intrusión y electrodomésticos peligrosos (Ej. Hornos) salvo excepciones firmadas por el usuario (MFA o tokens temporales). 

### Trazabilidad y Seguridad de Base
Toda acción de IA es tratada por el sistema con desconfianza. Para que el motor procese un comando de la IA, su payload debe incluir forzosamente metadatos de trazabilidad:
- `"aiDecisionReason": "Energy optimization: No human motion since 2:00 AM"`
- `"confidenceScore": 0.96`
El usuario puede auditar en la aplicación el `Log de Razonamiento`, sabiendo de forma transparente por qué las luces se apagaron por sí mismas.

---

## 5. Primer Vertical Slice (Flujo Principal)

**Escenario (End-to-End)**: *El usuario crea un hogar, descubre un dispositivo existente (bombilla), lo asigna al salón y lo enciende.*

### 1. Dominios Participantes
- **Topology Domain**: Administra entidades estructurales (Hogar, Habitaciones).
- **Integration Layer**: Habla protocolos sucios del hardware (MQTT/Zigbee) y hace traducción hacia un modelo limpio de la plataforma.
- **Device Management Domain**: Administra la entidad lógica genérica (`Light`), sus atributos disponibles y estado.
- **Client API (Gateway)**: Provee endpoints REST/WebSockets a la aplicación.

### 2. Flujo Completo End-to-End
1. **Configuración Básica**:
   - `HTTP POST /api/topology/homes { name: "Casa" }`
   - El *Topology Domain* persiste y publica -> `HomeCreatedEvent`.
   - `HTTP POST /api/topology/rooms { name: "Salón", homeId: 1 }` -> publica `RoomCreatedEvent`.

2. **Ingesta y Descubrimiento**:
   - Una bombilla es encendida de fábrica. El puente MQTT dispara telemetría en crudo (raw bytes).
   - La *Integration Layer* procesa el payload, abstrae al dispositivo y formula -> `DeviceDiscoveredEvent(deviceId: "zgb-abc", capabilities: ["POWER", "BRIGHTNESS"])`.
   - El *Device Management Domain* retiene al dispositivo en un "Inbox" (Estado pendiente de asignación).

3. **Asignación Lógica (La app actuando)**:
   - La App consulta `GET /api/devices/inbox`.
   - La App asigna: `POST /api/topology/rooms/10/devices { deviceId: "zgb-abc" }`.
   - El *Topology Domain* inscribe la jerarquía y publica -> `DeviceAssignedToRoomEvent`.

4. **Operación y Control (Encendiendo la luz)**:
   - El usuario pulsa encender. La App dispara `POST /api/devices/zgb-abc/commands { action: "turn_on" }`.
   - El *Client API* traduce a un `TurnOnLightCommand` con un `correlationId` UUID-1, volcándolo al bus.
   - *Device Management Domain* absorbe el comando, procesa reglas (ej. Validar que el equipo soporte "POWER"), y envía una orden al Driver vía *Integration Layer*.
   - El *Integration Layer* emite la señal física al MQTT (`{"state": "ON"}`).
   - El hardware responde con la afirmación del hardware (estado deseado alcanzado).
   - El *Integration Layer* empuja un evento afirmativo `LightTurnedOnEvent`, llevando el mismo `correlationId` (UUID-1).
   - *Device Management Domain* recibe y actualiza su *State Data Store* en memoria y disco local.
   - El *Client API Gateway* captura la actualización y, a través de WebSockets o SSE, empuja el cambio en milisegundos a la App del usuario para que pinte la bombilla en color amarillo.

---

## TODOs y Decisiones Abiertas
- TODO: Seleccionar la tecnología oficial para Event Bus local (¿NATS JetStream?, ¿Redis Streams?, ¿MQTT Broker embebido como fuente principal?).
- TODO: Establecer formato de definición unificada de capabilities.
- TODO: Diseñar flujos alternativos cuando el `TurnOnLightCommand` falla a nivel de hardware local.
- TODO: Validar la integración para Single Sign-On (SSO) de Instaladores vía Cloud.
