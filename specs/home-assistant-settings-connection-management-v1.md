# Spec: Home Assistant Settings & Connection Management V1 (REVISADO)

## Contexto
La conexión con Home Assistant (HA) debe ser dinámica, persistente y administrable. Esta revisión corrige deficiencias de diseño iniciales para asegurar una arquitectura modular y una experiencia de usuario coherente con el estado actual del sistema.

## Objetivos Revisados
1. **Reconfiguración Dinámica**: El sistema debe adoptar nuevos ajustes de HA inmediatamente sin reiniciar el servidor.
2. **Separación de Estados**: Diferenciar claramente si el sistema está configurado de si tiene conectividad.
3. **Persistencia Local**: Guardar en SQLite (sin cifrado en V1, limitación conocida).
4. **Seguridad en API**: No exponer tokens completos en lecturas.
5. **Independencia de Operaciones**: Permitir guardar aunque el test de conexión falle.

## Modelo de Datos y Estados (ACTUALIZADO)

### HomeAssistantSettings
- `baseUrl`: string (validada: esquema http/https, no vacía, normalizada).
- `accessToken`: string (opcional en actualizaciones).
- `updatedAt`: ISO Timestamp.

### Estados de Conexión y Prioridad
- **Prioridad de Carga**: 
  1. **Database**: Siempre tiene precedencia absoluta.
  2. **Env-Fallback**: Solo si la DB está vacía.
  3. **None**: Si ambos están vacíos.
  Una vez guardado en DB, el sistema **deja de usar fallback automáticamente**.

- **`configurationStatus`**:
  - `not_configured`: Faltan URL o Token en la fuente activa.
  - `configured`: URL y Token presentes en la fuente activa.
- **`connectivityStatus`**:
  - `unknown`: No verificado recientemente.
  - `reachable`: Conexión exitosa.
  - `unreachable`: Error de red/timeout.
  - `auth_error`: Error de credenciales (401).
- **`lastCheckedAt`**: ISO Timestamp. Se actualiza en:
  - `/test` connection.
  - Operaciones reales: discovery, import, refresh, command dispatch.

### Comportamiento con Configuración Inválida
- **Guardar NO depende del Test**: Se puede persistir una config aunque el test de conectividad falle (e.g. DNS temporalmente caído).
- **Fallo Consistente**: Si la config es inválida (URL mal formada o Token erróneo), el `connectivityStatus` debe reflejarlo y las operaciones dependientes de HA deben fallar de forma controlada y con logs claros.

## Requerimientos Técnicos

### 1. Gestión de Conexión (Backend)
- Se introducirá un `HomeAssistantConnectionProvider` o similar que actúe como Registry/Factory.
- El `HomeAssistantClient` activo en memoria debe ser actualizado o reemplazado inmediatamente tras un `Save` exitoso en DB.
- El sistema (discovery, import, refresh, commands) debe usar siempre la instancia provista por este Provider.

### 2. API Endpoints (`/api/v1/settings/home-assistant`)
- **`GET /`**:
  - Retorna: `baseUrl`, `hasToken` (bool), `maskedToken` (e.g., `abc...xyz`), `updatedAt`, `configurationStatus`, `connectivityStatus`, `lastCheckedAt`, `activeSource`.
- **`POST /`**:
  - Recibe: `baseUrl`, `accessToken` (opcional).
  - Si `accessToken` no se envía, se mantiene el actual.
  - Realiza validación básica de URL.
- **`POST /test`**:
  - Valida conexión con los parámetros recibidos (NO persiste).
  - Retorna `connectivityStatus` y error detallado si aplica.
- **`GET /status`**:
  - Retorna `connectivityStatus` actual y `lastCheckedAt`.

### 3. Seguridad
- **IMPORTANTE**: En esta V1, los tokens se almacenan en **texto plano** en SQLite. Esta es una limitación de seguridad aceptada para esta fase de desarrollo en entorno local controlado.

---

## UI (Operator Console)
- **Integración**: La vista se manejará mediante estado interno de la Operator Console, sin introducir routers adicionales.
- **Campos**: Input para URL (validación visual) e Input de Password para Token.
- **Flujo**:
  - Botón **Test Connection**: Feedback inmediato sobre conectividad sin afectar la config guardada.
  - Botón **Save**: Persiste los datos. Se permite guardar incluso si el test falló (e.g., HA está temporalmente offline pero la config es correcta).

---

## Criterios de Aceptación
1. Al guardar una nueva URL en la UI, el Discovery utiliza la nueva URL inmediatamente sin reiniciar `homepilot`.
2. El API nunca devuelve el token completo.
3. El estado de la UI distingue entre "Configurado" y "Conectado".
4. El sistema mantiene el `env-fallback` si no hay nada en DB, marcando `activeSource: env-fallback`.
