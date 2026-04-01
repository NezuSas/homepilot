# TASK BREAKDOWN: HomePilot Operator Console V1

## Orden Recomendado de Implementación (Fases)
1. **Fase 1: Preparación Backend (Exposición Mínima)** - Definir endpoints REST simples consumiendo Casos de Uso existentes.
2. **Fase 2: Setup Infraestructura UI** - Inicializar workspace frontend (estático y local-first).
3. **Fase 3: Vistas Core de Monitoreo (Lectura)** - Topology, Inbox, Device Status y Activity Logs.
4. **Fase 4: Ejecución y Operatividad técnica (Escritura)** - Asignar dispositivos, disparar comandos y alternar reglas.
5. **Fase 5: Delivery Edge** - Distribución y empaquetado del bundle estático dentro del bootstrap del Edge.

---

## 1. Tareas de Ajustes Backend (API Layer)
*Nota: El core Domain y Application ya funciona. Estas tareas involucran exclusivamente armar Controladores HTTP simples sin autenticación robusta.*

### [BE-01] Implementar Topology API V1
- **Descripción**: Exponer endpoints REST locales para consultar la jerarquía física desde repositorios SQLite.
- **Endpoints sugeridos**: `GET /api/v1/homes`, `GET /api/v1/homes/:homeId/rooms`
- **Dependencias**: Ninguna.

### [BE-02] Implementar Devices API V1
- **Descripción**: Exponer el listado de nodos controlados (Inbox y Asignados).
- **Endpoints sugeridos**: `GET /api/v1/devices` (opcional filtrado `?status=PENDING` para inbox).
- **Dependencias**: `BE-01`.

### [BE-03] Implementar Action Endpoints (Assign & Command)
- **Descripción**: Proveer conectores POST mapeados a los Application Services preexistentes.
- **Endpoints sugeridos**:
  - `POST /api/v1/devices/:id/assign` (body con `roomId`)
  - `POST /api/v1/devices/:id/command` (body con `DeviceCommandV1` literal, ej: `"turn_on"`)
- **Dependencias**: `BE-02`.

### [BE-04] Implementar Automations API V1
- **Descripción**: Exponer catálogo de reglas lógicas y proveer un endpoint de actualización atómica (Patch) para el atributo `enabled`.
- **Endpoints sugeridos**:
  - `GET /api/v1/automations`
  - `PATCH /api/v1/automations/:id/status` (payload: `{ enabled: boolean }`)
- **Dependencias**: Ninguna.

### [BE-05] Implementar Activity Logs API V1
- **Descripción**: Permitir lectura LIFO (Append-only invertido) del historial.
- **Endpoints sugeridos**: `GET /api/v1/devices/:deviceId/logs?limit=50`
- **Dependencias**: Ninguna.

---

## 2. Tareas de Frontend / UI

*Sugerencia Estructural: Directorio en `/apps/operator-console` administrado con Vite (Vanilla TypeScript o React estático).*

### [UI-01] Setup de Bundle Frontend
- **Descripción**: Generar carpeta de aplicación UI que emita archivos estáticos puros (HTML/CSS/JS). Armar un "Console Layout" soberbio (CSS Grid nativo: Sidebar + Content).
- **Archivos**: `/apps/operator-console/package.json`, `index.html`, `/src/layout.css`.
- **Dependencias**: Ninguna.

### [UI-02] Implementar vista: Topology Navigation
- **Descripción**: Mostrar en UI la lectura jerárquica cruda de `BE-01`.
- **Módulos**: `/src/views/TopologyView`
- **Dependencias**: `UI-01`, `BE-01`.

### [UI-03] Implementar vista: Inbox & Devices
- **Descripción**: Grilla dividida. Porción superior: Nodos en modo `PENDING`. Porción inferior: Nodos en modo `ASSIGNED` con estado actualizado.
- **Módulos**: `/src/views/InboxView`
- **Dependencias**: `UI-01`, `BE-02`.

### [UI-04] Integrar acción: Assign Device
- **Descripción**: Añadir a la vista Inbox un `<select>` de Rooms y botón de submit que dispare `POST` a `BE-03`.
- **Dependencias**: `UI-03`, `BE-03`.
- **Criterio Relacionado**: Alineado con **AC2**.

### [UI-05] Implementar vista: Device Manager & Exec Operations
- **Descripción**: Añadir en los Nodos asignados interfaces técnicas de test (Ej. botones `[ON]`, `[OFF]`) para validar Execution inyectando payloads en `BE-03`.
- **Módulos**: `/src/views/DeviceManagerView`
- **Dependencias**: `UI-03`, `BE-03`.
- **Criterio Relacionado**: Alineado con **AC4**.

### [UI-06] Implementar vista: Automations Workbench
- **Descripción**: Grilla tabular listando Reglas Edge. Detallar columnas en formato técnico puro (mostrar triggers JSON literal). Añadir `<input type="checkbox">` de Toggle en cada fila.
- **Módulos**: `/src/views/AutomationsView`
- **Dependencias**: `UI-01`, `BE-04`.
- **Criterio Relacionado**: Alineado con **AC3**.

### [UI-07] Implementar vista: Audit Logs Visualizer
- **Descripción**: Consola de auditoría LIFO con selector de dispositivos integrando llamadas hacia `BE-05`.
- **Módulos**: `/src/views/AuditLogsView`
- **Dependencias**: `UI-01`, `BE-05`.

---

## 3. Integración Final (Wiring)

### [BO-01] Configurar Servidor Estático Edge
- **Descripción**: En la capa entrypoint (`main.ts` / mini web server), montar un middleware estático (como `express.static`) que apunte a `/apps/operator-console/dist`.
- **Módulos**: Configuración del Web Server a implementar / `bootstrap.ts` (solo en aspectos de red).
- **Dependencias**: `UI-01...UI-07` finalizados y construidos.
- **Criterio Relacionado**: Alineado con **AC1**.

---

## 4. Tareas de Testing Integrado UI-Backend

### [QA-01] Validar Operatividad UI
- **Descripción**: Validación visual o mediante tests e2e (Puppeteer/Playwright básico o manual con checklist validado):
  1. Bootstrapt levanta Backend API + Carpeta Dist (Validación **AC1**).
  2. Dispositivo se mapea a Room vía UI, sale del Inbox (Validación **AC2**).
  3. Toggle UI cambia base de datos persistente SQLite (Validación **AC3**).
  4. Presionar `[ON]` en UI graba comando ejecutado en DB y se lee en vista Logs (Validación **AC4**).
- **Módulos**: Repositorio de test integrativo UI o matriz de calidad.
- **Dependencias**: `BO-01`.
