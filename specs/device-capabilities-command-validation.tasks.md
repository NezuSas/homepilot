# Task Breakdown: Capacidades de Dispositivo y Validación de Comandos por Tipo

Este documento desglosa las tareas técnicas necesarias para implementar la capa de validación de capacidades en el flujo de ejecución de comandos de HomePilot, siguiendo una arquitectura modular y orientada a dominio.

## Fase 1: Capa de Dominio (Core Logic)
Implementación del modelo de capacidades y errores intrínsecos del hardware.

- [ ] **T1.1: Definir Diccionario de Capacidades V1**
  - Crear `packages/devices/domain/capabilities.ts`.
  - Definir tipo `Capability` (`'turn_on' | 'turn_off' | 'toggle'`).
  - Implementar constante `DEVICE_TYPE_CAPABILITIES` (un Record de `DeviceType` a `Capability[]`).
  - Incluir mapeos: `switch`, `light` (full); `sensor`, `gateway` (empty).
- [ ] **T1.2: Implementar UnsupportedCommandError**
  - Agregar `UnsupportedCommandError` en `packages/devices/domain/errors.ts`.
  - Debe extender de `DomainError` (o base de dominio del proyecto).
  - El mensaje debe ser descriptivo: "El comando X no es soportado por el tipo Y".
- [ ] **T1.3: Exponer Servicio de Dominio para Validación**
  - (Opcional) Crear una función pura `canDeviceExecuteCommand(type, command): boolean` en `capabilities.ts`.

## Fase 2: Capa de Aplicación (Command Guard)
Integración de la regla de negocio en el flujo coordinado de ejecución.

- [ ] **T2.1: Actualizar executeDeviceCommandUseCase con el "Guardián de Capacidad"**
  - Modificar `packages/devices/application/executeDeviceCommandUseCase.ts`.
  - **Inyección**: Asegurar acceso a la lógica de capacidades (importando el diccionario o función de dominio).
  - **Lógica**:
    1. Obtener el dispositivo de `DeviceRepository`.
    2. Realizar validaciones existentes (Existence, Ownership, ASSIGNED state).
    3. **Nuevo paso**: Validar si el comando está en las capacidades del `device.type`.
    4. Si falla: Lanzar `UnsupportedCommandError`.
- [ ] **T2.2: Garantizar Política de Silencio (Audit Log & Dispatcher)**
  - Verificar que si el lanzamiento del error ocurre antes de `dispatcher.dispatch()`, no se invoque el hardware físico.
  - Verificar que si el error ocurre antes de `activityLogRepository.saveActivity()`, no se ensucie el historial con el comando rechazado.

## Fase 3: Capa API (Error Mapping)
Asegurar que el error de dominio se traduzca al contrato HTTP correcto.

- [ ] **T3.1: Mapear UnsupportedCommandError en el ErrorHandler**
  - Actualizar `packages/devices/api/core/errorHandler.ts` (o el global de la integración).
  - Capturar `UnsupportedCommandError` y mapearlo a `400 Bad Request`.

## Fase 4: Pruebas (Verification)
Validación exhaustiva de los criterios de aceptación.

- [ ] **T4.1: Pruebas Unitarias de Dominio (AC1)**
  - Crear `packages/devices/__tests__/capabilities_domain.test.ts`.
  - Probar que `light` soporta `turn_on`.
  - Probar que `sensor` no soporta ningún comando.
- [ ] **T4.2: Pruebas de Integración de Aplicación (AC2, AC3)**
  - Crear `packages/devices/__tests__/capabilities_application.test.ts`.
  - **Escenario Positivo**: Validar que un comando compatible llega al dispatcher.
  - **Escenario Negativo**: Validar que un comando incompatible lanza el error esperado y el dispatcher no es llamado.
- [ ] **T4.3: Pruebas E2E / Acceptance (AC4)**
  - Crear `packages/devices/__tests__/capabilities_e2e.test.ts`.
  - Verificar que ante un comando inválido, el API responde 400.
  - Verificar que el `ActivityLog` (vía `/history`) permanece vacío tras un rechazo de capacidad.

## Orden de Ejecución Sugerido
1. Domain (Fase 1) -> Bloqueante para el resto.
2. Application (Fase 2) -> Depende de Fase 1.
3. API (Fase 3) -> Depende de Fase 2.
4. Testing (Fase 4) -> Puede realizarse en paralelo con cada fase si se sigue TDD.
