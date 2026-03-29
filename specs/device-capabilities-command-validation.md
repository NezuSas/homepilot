# Especificación Funcional: Capacidades de Dispositivo y Validación de Comandos por Tipo

## 1. Problema
Actualmente, HomePilot permite el envío de comandos operativos (`turn_on`, `turn_off`, `toggle`) a cualquier dispositivo en estado `ASSIGNED`, sin verificar si el hardware físico realmente soporta esa acción según su tipo (ej. mandar un `turn_on` a un sensor de temperatura). Esto genera ruido en el dispatcher, registros de actividad inválidos y posibles errores de integración que deben ser interceptados antes de salir de la lógica de negocio.

## 2. Alcance
Se define una capa de validación determinista basada en **Capacidades (Capabilities)** que actúa como un "Gualdián de Dominio" antes del despacho de comandos.

### 2.1 Incluido
- **Modelo de Capacidades (V1)**: Diccionario estático e inmutable que mapea cada `DeviceType` a sus comandos permitidos.
- **Validación Contractual**: Intercepción en la capa de aplicación (`executeDeviceCommandUseCase`) antes de invocar puertos de infraestructura.
- **Rechazo determinista**: Retorno de error inmediato si el comando no es compatible.
- **Soporte para Comandos V1**: `turn_on`, `turn_off`, `toggle`.

### 2.2 Fuera de Alcance
- **Comandos con Parámetros**: Brillo, color, etc. (V2).
- **Descubrimiento Dinámico**: Las capacidades son fijas por tipo en esta versión.
- **Eventos de Dominio de Rechazo**: Por sobriedad, no se emitirán eventos para intentos de comandos inválidos.
- **UI/Frontend**: Adaptación de botones en interfaz.

## 3. Requisitos Funcionales

### RF1: Diccionario Estático de Capacidades
Las capacidades **no** se almacenan en la base de datos ni en la entidad `Device`. Se derivan dinámicamente de su `device.type` consultando un diccionario estático en la capa de Domain.
- `switch` -> [`turn_on`, `turn_off`, `toggle`]
- `light` -> [`turn_on`, `turn_off`, `toggle`]
- `sensor` -> [] (No acepta comandos operativos)
- `gateway` -> []

### RF2: Validación Pre-Dispatch (Guardián)
Antes de invocar al `DeviceCommandDispatcherPort`, el sistema debe validar la compatibilidad. Esta validación es el tercer paso del flujo:
1.  Validar existencia del dispositivo.
2.  Validar Ownership (Zero-Trust) y estado (`ASSIGNED`).
3.  **VALIDAR CAPACIDAD (Nuevo)**.
4.  Despachar comando.

### RF3: Rechazo por Incompatibilidad
Si el comando no es soportado:
1.  Se aborta la ejecución.
2.  **No** se invoca al dispatcher ni se emiten eventos de éxito/fallo de despacho.
3.  Se lanza un `UnsupportedCommandError`.

## 4. Requisitos No Funcionales
- **Baja Latencia**: Validación en memoria sin I/O adicional.
- **Determinismo**: La misma combinación de (Tipo, Comando) siempre debe dar el mismo resultado.
- **Mantenibilidad**: Centralización del diccionario de capacidades en una única constante de dominio.

## 5. Modelo Conceptual de Datos
- **Capability**: Identificador del comando operativo (`turn_on`, `turn_off`, `toggle`).
- **Domain Dictionary**: Estructura de solo lectura que vincula `DeviceType` con su conjunto de `Capabilities`.

## 6. Semántica HTTP
- **POST /devices/:deviceId/commands**: Si falla la validación de capacidad:
  - Status: `400 Bad Request`.
  - Body: `{ "error": "Bad Request", "message": "Command 'turn_on' is not supported by device type 'sensor'." }`

## 7. Criterios de Aceptación (AC)

### AC1: Derivación Correcta de Capacidades
- Dado un dispositivo de tipo `light`.
- Cuando se valida el comando `toggle`.
- Entonces la validación debe ser positiva.

### AC2: Rechazo por Tipo Incompatible
- Dado un dispositivo de tipo `sensor`.
- Cuando se intenta ejecutar `turn_on`.
- Entonces el sistema debe lanzar `UnsupportedCommandError`.

### AC3: Preservación del Flow
- El proceso de validación de capacidades debe ocurrir **después** del chequeo de `ownership` pero **antes** de cualquier comunicación externa con el hardware.

### AC4: Política de Silencio en Auditoría (Sin Ruido)
- Cuando un comando es rechazado por capacidad:
  - **No** se debe registrar nada en el `ActivityLog`.
  - El historial solo debe contener acciones que el hardware intentó o ejecutó realmente.

## 8. Notas Técnicas y Arquitectura
- **Tipo de Error**: `UnsupportedCommandError` se define como un **Error de Dominio**.
  - *Justificación*: La incapacidad de un hardware de realizar una acción es una regla intrínseca de la lógica del negocio de dispositivos, no un fallo de orquestación o infraestructura.
- **Mantenimiento del Contrato**: Se debe seguir usando el `DeviceCommandDispatcherPort` existente sin modificaciones en su firma.
- **Ubicación de la Lógica**: El mapeo de capacidades debe estar en `packages/devices/domain/capabilities.ts` (o similar).

## 9. Preguntas Abiertas / TODOs
- Ninguna. Spec listo para implementación.
