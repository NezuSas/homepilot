# Task Breakdown: Sincronización de Estado y Observabilidad Básica
*(Device State Synchronization & Basic Observability)*

Este documento desglosa las tareas técnicas necesarias para implementar la sincronización de estado y la observabilidad de dispositivos siguiendo la arquitectura hexagonal de HomePilot.

---

## Fase 1: Capa de Dominio (Domain Layer)

### 1.1 Extensión de la Entidad Device
- [ ] Modificar `Device.ts` para incluir `lastKnownState: Record<string, unknown> | null`.
- [ ] Inicializar el campo como `null` en el constructor de la entidad.
- [ ] Implementar la lógica de comparación `isStateIdentical(oldState, newState): boolean`.
    - REGLA V1: Comparación estructural determinista limitada a objetos planos de un nivel (flat objects).

### 1.2 Errores de Dominio
- [ ] (Opcional) Agregar excepciones si se detectan payloads de estado que no cumplan con el formato básico esperado.

---

## Fase 2: Capa de Eventos (Events Layer)

### 2.1 Contrato del Evento de Cambio de Estado
- [ ] Definir `DeviceStateUpdatedEvent` en `events/types.ts`.
    - Payload: `deviceId`, `homeId`, `newState`.
- [ ] Actualizar la unión `DeviceDomainEvent` para incluir el nuevo evento.

### 2.2 Factoría de Eventos
- [ ] Implementar `createDeviceStateUpdatedEvent` en `events/factories.ts`.

---

## Fase 3: Capa de Persistencia y Repositorios (Repositories / Read Models)

### 3.1 Source of Truth: DeviceRepository (Snapshot)
- [ ] Actualizar `DeviceRepository` para persistir el `lastKnownState`.
- [ ] Asegurar que `InMemoryDeviceRepository` gestione de forma atómica el incremento de `entityVersion` y la actualización de `updatedAt` al guardar el snapshot del dispositivo.

### 3.2 Read Model: ActivityLogRepository (Observabilidad)
- [ ] **[NUEVO]** Definir el puerto `ActivityLogRepository` en `application/ports`.
    - Explicitar que es una **persistencia derivada** para fines de observabilidad.
- [ ] Implementar `InMemoryActivityLogRepository` en `infrastructure/repositories`.
    - Método `saveActivity(record: ActivityRecord): Promise<void>`.
    - Método `findRecentByDeviceId(deviceId: string, limit: number): Promise<ActivityRecord[]>`.
    - Inserción y recuperación cronológica estricta (LIFO - más reciente primero).

---

## Fase 4: Capa de Aplicación (Application Layer)

### 4.1 Caso de Uso: Sincronización de Estado (Ingesta M2M)
- [ ] Implementar `syncDeviceStateUseCase.ts`.
    - Flujo:
        1. Buscar Device (404 si no existe).
        2. Comparar `newState` con `lastKnownState` usando `isStateIdentical`.
        3. Si son idénticos: Retornar con éxito (200) sin disparar efectos secundarios.
        4. Si son diferentes:
            - Actualizar la entidad `Device` (`lastKnownState`, `updatedAt`, `entityVersion`).
            - Guardar en `DeviceRepository`.
            - Publicar `DeviceStateUpdatedEvent`.
            - Registrar entrada en `ActivityLogRepository` con tipo `STATE_CHANGED`.

### 4.2 Caso de Uso: Consulta de Estado Actual (Auth)
- [ ] Implementar `getDeviceStateUseCase.ts`.
    - Soporte explícito para dispositivos en estado `PENDING`.
    - Validación de propiedad con `TopologyReferencePort` (403).

### 4.3 Caso de Uso: Consulta de Historial (Auth)
- [ ] Implementar `getDeviceActivityHistoryUseCase.ts`.
    - Flujo:
        1. Buscar Device (404).
        2. Validar propiedad (403).
        3. Recuperar logs desde `ActivityLogRepository` (ordenados por fecha).

### 4.4 Integración de Comandos en el Log
- [ ] Modificar `executeDeviceCommandUseCase.ts` para registrar en `ActivityLogRepository` al terminar (tipos `COMMAND_DISPATCHED` o `COMMAND_FAILED`).

---

## Fase 5: Capa API (API Layer)

### 5.1 Controladores
- [ ] `StateIngestionController.ts`: Implementar `POST /integrations/state-sync`.
    - Garantizar política de idempotencia: Retornar 200 sin efectos si el estado no cambió.
- [ ] `ObservabilityController.ts`:
    - `GET /devices/:deviceId/state`.
    - `GET /devices/:deviceId/history`.
    - Validar presencia de `deviceId` en params.

---

## Fase 6: Pruebas (Testing Suite)

### 6.1 Pruebas de Dominio y Aplicación
- [ ] Test unitario de `isStateIdentical` probando comparaciones válidas e inválidas de objetos planos.
- [ ] Test de `syncDeviceStateUseCase` verificando la ausencia de efectos secundarios ante estados idénticos.

### 6.2 Pruebas E2E (Criterios de Aceptación)
- [ ] AC1: El cambio de estado muta la entidad e incrementa versión.
- [ ] AC2: La idempotencia devuelve 200 sin registrar actividad ni mutar versión.
- [ ] AC4: El historial muestra comandos y estados intercalados correctamente.
- [ ] **AC5: Visibilidad en Inbox**: Verificar que el dueño puede consultar `/state` de un dispositivo en `PENDING` (Inbox).
- [ ] Sad Path: Verificar 403 y 404 en todas las rutas de lectura.
