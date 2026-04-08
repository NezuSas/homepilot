# First-Run Setup & Edge Onboarding V1

## Objetivo
Transformar a HomePilot Edge en un appliance realmente instalable y operable de caja. Implementar un flujo guiado ("First-Run Setup") para administradores, de forma persistente e inyectada en la UI pre-existente, asegurando la configuración mandatoria para inicializar el sistema sin hacky scripts o pre-conocimiento de bases de datos.

## Alcance V1
- Sistema persistente en SQLite para registrar inicialización global del sistema.
- Endpoint de System Status para discernir en qué etapa del First-Run estamos.
- Flujo interactivo que verifica credenciales de HA y responde una validación estricta de conexión **viva** al completarse.
- Trazabilidad y Observabilidad con activity_logs sobre las transiciones del Setup con estructuras limpias `ONBOARDING_STARTED`, `ONBOARDING_COMPLETED`.
- Barreras de usabilidad y seguridad: El Auth jamás se salta.

## Fuera de Alcance
- Descubrimiento mDNS / ZeroConf dinámico de Home Assistant.
- Manejo de redes locales Wi-Fi, Ethernet, IP Estáticas (Instalación de SO está fuera de scope).
- Múltiples tenants en la Edge (onboarding cloud).

---

## Modelado y Arquitectura

### 1. Dominio: `SystemSetupState`
La identidad del sistema y su estado recaen sobre el entorno local. 

Ubicación: `packages/system-setup/domain/SystemSetupState.ts`
Shape:
```typescript
export interface SystemSetupState {
  id: string; // Fijo ej. 'local-edge'
  isInitialized: boolean;
  initializedAt: string | null;
  setupVersion: number;
  onboardingCompletedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 2. Capa de Aplicación (`SystemSetupService`)
Se integra reciclando lógica existente (sin copypaste):
- `HomeAssistantSettingsService` (Para test de conectividad vivos y recuperación de Config).
- `AuthService` (Validación de cuentas admin y autorizaciones).

Casos de Uso:
- `getSetupStatus()`: Devuelve el estado calculando `requiresOnboarding` (!isInitialized).
- `completeOnboarding(userId: string)`: 
  - **REGLA ESTRICTA 1:** Ejecuta una **validación viva obligatoria** a Home Assistant empleando el setting persistido. No se aceptan cacheos de test previos.
  - **REGLA ESTRICTA 2:** Si el sistema **ya está inicializado**, la llamada debe ser puramente idempotente, no lanzará error y devolverá un `HTTP 200 OK` limpio sin reimprimir nuevos instantes en memoria ni mutar `initializedAt`.

### 3. Reglas Abstractas del Onboarding (Requires / Status)
- `requiresOnboarding` = `!isInitialized`. Esta es la bandera binaria maestra.
- `hasAdminUser`, `hasHAConfig`, `haConnectionValid` **no disparan bloqueos por sí solos**, son puramente *señales auxiliares informativas*.

### 4. Endpoints Protegidos e Interpretación Dinámica
Restricción Global: Nada aquí esquiva Auth/RBAC. Un Operador genérico puede consultar estatus `GET`, pero el `POST` es territorio exclusivamente de Admin.

`GET /api/v1/system/setup-status` (Rol: Operador o Admin)
```json
{
  "isInitialized": false,
  "requiresOnboarding": true,
  "hasAdminUser": true, 
  "hasHAConfig": false,
  "haConnectionValid": false // Se asume el último caché conocido de HA connectivity, de ser útil. NO es una prueba viva.
}
```

`POST /api/v1/system/setup-status/complete` (Rol: Admin ONLY)
- Ejecuta el test VIVO de HA.
- Cambia permanentemente `isInitialized: true`.
- Si se invoca sobre un sistema `isInitialized: true`, responde `200 OK` de forma idempotente ignorando los checks para no crashear retries perdidos.

### 5. UI (Frontend) / Pasos de Flujo
El onboarding redirecciona la UI preexistente obligando foco si `requiresOnboarding === true`. 
**Si isInitialized === true, el onboarding abandona su flujo obligatorio pero permanece en Settings como consulta o reevaluación técnica.**

Flujo:
- **Paso 1: Diagnóstico Integral**. La presentación ya no será apenas "Admin Check". Incluirá: Estado del sistema Edge, Nombre/Rol del usuario montado, Status de HA Config crudo, Status de HA connectivity persistente.
- **Paso 2: Gateway Integration**. Ingesta / Cambio de Home Assistant URL y Long-Lived Token. Prueba remota asíncrona local (Reaprovechando `testConnection`).
- **Paso 3: Certificación y Commit**. Reuniendo lo anterior, invoca el `POST /complete`. Si hay timeout en red o credencial desactualizada el servidor abortará `HTTP 400`. Si procede, la redirección es universal y reactiva a Topology.

### 6. Observabilidad (Activity Logs Structured)
Generación controlada de auditoría sin fugas de secretos (`token: *`).
- `ONBOARDING_STARTED`: Log con el User ID/Role.
- `ONBOARDING_HA_TESTED`: `result: success | failure` al tocar o reconfigurar HA desde dentro del paso de Setup. 
- `ONBOARDING_COMPLETED`: `completedByUserId: <uuid>`.

---

## Verificación Mínima
Los Tests exigidos para la suite V1 son formales:
- Testeo de retorno inmaculado en `GET /setup-status` con Edge Factory Reset (sin iniciar).
- Testeo de retorno de `GET /setup-status` ya inicializado formalmente.
- Testeo de intento a `POST /complete` como `operator` -> HTTP 403 Forbidden.
- Testeo de intento a `POST /complete` como `admin` omitiendo HA Setup o HA injuriando la URL -> HTTP 400 Bad Request.
- **Idempotencia:** Testeo de `POST /complete` en una Base de Datos ya Inicializada -> responde HTTP 200 directo sin readjuntar estado ni re-testear HA vivo, respetando mutabilidad.
- Refrendo y persistencia de memoria comprobando un falso Reinicio luego del setup completado, validando readmisión automática sin loop al Setup.
