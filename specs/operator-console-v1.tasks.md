# TASK BREAKDOWN: HomePilot Operator Console V1

## Orden Recomendado de Implementación (Fases)
1. **Fase 1: Preparación Backend (Exposición Mínima)** - Definir endpoints REST simples consumiendo Casos de Uso existentes.
2. **Fase 2: Setup Infraestructura UI** - Inicializar workspace frontend (estático y local-first).
3. **Fase 3: Vistas Core de Monitoreo (Lectura)** - Topology, Inbox, Device Status y Activity Logs.
4. **Fase 4: Ejecución y Operatividad técnica (Escritura)** - Asignar dispositivos, disparar comandos y alternar reglas.
5. **Fase 5: Delivery Edge** - Distribución y empaquetado del bundle estático dentro del bootstrap del Edge.

## Optimización de llamadas al navegar

- [x] Compartir la lectura del catálogo de tableros entre sidebar y vista, con frescura breve, aislamiento por sesión e invalidación tras mutaciones.
- [x] Abrir Asistente sin escaneo completo automático; mantener la consulta de hallazgos y el escaneo manual.
- [x] Probar concurrencia, navegación repetida, cambio de sesión y actualización tras edición; `verify:quality` pasa, incluidas 47 pruebas responsive.
- [x] Reutilizar brevemente escenas y automatizaciones entre vistas, invalidar después de escrituras y cubrir concurrencia, cambio de sesión y solicitudes antiguas; `verify:quality` pasa.

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
### [UI-08] Jerarquía visual residencial en Inicio
- **Descripción**: Integrar un activo ambiental local en el saludo de Inicio y ajustar la jerarquía de contexto, rutinas y sugerencias sin alterar sus acciones ni contratos.
- **Módulos**: `/src/views/DashboardView.tsx`, `HomeClimateSummary.tsx`, `DashboardRoutinesSection.tsx`, `DashboardInsightsSection.tsx` y `/public/home-dashboard-ambient.png`.
- **Criterio Relacionado**: Alineado con **AC25**.

### [UI-09] Temperatura actual de la ciudad configurada
- **Descripción**: El resumen de Inicio obtiene la temperatura exterior de la ciudad configurada mediante la fuente meteorológica ya utilizada por el tablero. Cuando no responde, conserva un estado explícito no disponible.
- **Módulos**: `HomeClimateSummary.tsx`, `homeClimateWeather.ts` y su prueba unitaria.
- **Criterio Relacionado**: Alineado con **AC22**.

- [x] Integrar la lectura meteorológica existente de la ciudad configurada en `HomeClimateSummary`, para que el encabezado no dependa de que haya un sensor físico de temperatura descubierto.

- [x] Aislar el listado de escenas y automatizaciones por hogar propietario; Inicio delega la selección al endpoint autorizado y la cobertura de integración rechaza hogares ajenos.

### [UI-10] Reutilizar topología entre Espacios y Rutinas
- **Descripción**: Consumir el snapshot compartido de hogares, dispositivos y habitaciones en ambas vistas, refrescarlo después de mutaciones de topología y evitar mostrar habitaciones de hogares no autorizados. Verificar la navegación con una prueba de solicitudes duplicadas.
- **Módulos**: `TopologyView.tsx`, `ScenesView.tsx`, `AutomationsView.tsx`, `RoutinesView.tsx`, `AppViewRouter.tsx` y prueba responsive.
- **Criterio Relacionado**: Alineado con **AC30**.

### [BE-Home-01] Persistir personalización global de Inicio
- **Descripción**: Guardar tres frases y exponer lectura autenticada y escritura exclusiva de Admin, con límite de 1000 caracteres. Reutilizar el servicio y volumen persistente de medios para hasta cinco imágenes validadas; mantener slots deterministas y contiguos al añadir, reemplazar o eliminar, sin archivos huérfanos.
- **Módulos**: persistencia global existente de variables de sistema (sin migración nueva), `MediaService` y rutas de settings.
- **Criterio Relacionado**: **AC31–AC32**.

### [UI-Home-01] Personalización administrativa y hero de Inicio
- **Descripción**: Ocultar «Mi Hogar», ofrecer en Sistema la edición Admin de frases con contador, feedback async y textarea adaptable, y la gestión de imágenes con posición, preview, confirmación modular y progreso. Compartir la regla horaria del saludo y la frase, resolver frases vacías por prioridad entre periodos; conservar fallback ambiental, caché privada de imágenes con URL versionada, carrusel de diez segundos y contenido superior legible y responsive.
- **Módulos**: navegación de Sistema, vista de personalización, `DashboardView.tsx` y estilos acotados.
- **Dependencias**: `BE-Home-01`.
- **Criterio Relacionado**: **AC31–AC33**.

### [UI-Home-02] Retorno a Inicio por inactividad
- **Descripción**: Escuchar solo interacciones humanas y navegar por SPA a Inicio tras 120 segundos fuera de esa vista, considerando las protecciones de edición/modal existentes sin añadir un framework global nuevo.
- **Módulos**: shell/router de Operator Console y prueba de navegación.
- **Criterio Relacionado**: **AC34**.

### [QA-Home-01] Regresión de personalización de Inicio
- **Descripción**: Cubrir frases y límites, feedback de éxito/error/ocupado, RBAC de lectura/escritura, confirmación de borrado, slots persistentes y compactación sin huérfanos, versiones/caché HTTP, fallback de frases y carrusel de diez segundos, temporizador de inactividad, accesibilidad y geometría responsive; ejecutar validaciones de spec, tests, typecheck y builds aplicables.
- **Dependencias**: `BE-Home-01`, `UI-Home-01`, `UI-Home-02`.
- **Criterio Relacionado**: **AC31–AC34**.

### [BE-Home-02] Favoritos de escenas y automatizaciones por usuario
- **Descripción**: Persistir ambos tipos de favoritos en claves independientes del repositorio SQLite por usuario, con validación de acceso, lectura entre dispositivos y migración puntual por unión de IDs legacy válidos. Aislar usuarios y conservar RBAC.
- **Módulos**: preferencias persistentes, rutas API de escenas y automatizaciones, migración no destructiva y pruebas de autorización y reinicio de repositorio.
- **Criterio Relacionado**: **AC23, AC36**.

### [UI-Home-03] Navegación e indicadores modulares de Inicio
- **Descripción**: Reiniciar el scroll al navegar por Sidebar, ampliar frases a 1000 caracteres, reutilizar la fuente de hora/fecha y clima de Clock en el reloj digital y chips informativos, y diferenciar el botón de acceso al Dashboard de los indicadores estáticos.
- **Módulos**: shell, personalización, Clock, hero de Inicio y pruebas responsive.
- **Criterio Relacionado**: **AC31, AC35, AC38–AC39**.

### [UI-Dashboard-03] Slots responsive de Sections
- **Descripción**: Mantener la grilla y permisos existentes con slots vacíos persistentes por perfil de columnas; drag sobre vacío mueve, sobre ocupado intercambia; conservar compatibilidad histórica, transferencia y revisiones.
- **Módulos**: modelo de pestaña, canvas, persistencia JSON y pruebas de layout/importación.
- **Criterio Relacionado**: **AC37**.

### [QA-Home-02] Regresión de navegación, favoritos, slots e Inicio
- **Descripción**: Validar scroll, límites 1000/1001, favoritos de escenas y automatizaciones cross-device y migración, slots por 1–4 columnas, permisos, hero modular, Clock intacto, E2E responsive, trazabilidad y builds.
- **Dependencias**: `BE-Home-02`, `UI-Home-03`, `UI-Dashboard-03`.
- **Criterio Relacionado**: **AC31, AC35–AC39**.

### [UI-Home-04] Composición y ejecución compacta de Inicio
- **Descripción**: Presentar saludo y nombre en dos líneas; sustituir Hora/Clima cuadrados por reloj digital de fichas con flip por minuto y separador intermitente por segundo. Mostrar ciudad, fecha y clima en chips compactos; mantener frase a la izquierda e «Ir a tablero» a la derecha. Incorporar branding discreto HomePilot/NEZU en hero y Sidebar. Presentar favoritas con solo icono y nombre mediante el tile de acción momentánea compartido con Dashboard; ejecutar automatizaciones sin alterar su habilitación.
- **Módulos**: hero, reloj digital de Inicio, HomeContextIndicator, DashboardRoutinesSection y SectionActionCard.
- **Criterio Relacionado**: **AC40–AC41**.

### [UI-Dashboard-04] Section de un solo slot
- **Descripción**: Quitar el selector de ancho y normalizar el span exterior de Sections actuales e históricas a 1 en UI, dominio, importación y restauración, conservando tarjetas internas y mapas de slots vacíos.
- **Módulos**: editor/canvas, mutaciones de Dashboard y servicio de transferencia.
- **Criterio Relacionado**: **AC42**.

### [QA-Home-03] Regresión focalizada y validación final
- **Descripción**: Validar hero, favoritas, iconos y slots con tests y responsive focalizados; para este polish no ejecutar la suite responsive completa salvo regresión transversal, junto a trazabilidad, i18n, typecheck, lint y builds.
- **Dependencias**: `UI-Home-04`, `UI-Dashboard-04`.
- **Criterio Relacionado**: **AC40–AC42**.

### [BE-Home-03] Iconos durables de Escenas y Automatizaciones
- **Descripción**: Añadir `icon` opcional al dominio y API de Escena/Automatización; persistir Escena en su JSON existente y Automatización mediante migración SQLite aditiva, sin alterar registros históricos ni ejecución.
- **Criterio Relacionado**: **AC43**.

### [UI-Home-05] Selección y uso unificado de iconos
- **Descripción**: Reutilizar el IconPicker existente en crear/editar, mostrar el icono persistido en listas, botones de acción enlazados del Dashboard y favoritas; usar fallback estable para históricos y conservar la tarjeta momentánea compartida.
- **Dependencias**: `BE-Home-03`.
- **Criterio Relacionado**: **AC43–AC44**.

### [QA-Home-04] Regresión focalizada de iconos y composición
- **Descripción**: Verificar creación, edición, persistencia y fallback de iconos; hero/branding, favoritas momentáneas y responsive de Inicio en escenarios focalizados, además de typecheck, lint y builds.
- **Dependencias**: `BE-Home-03`, `UI-Home-05`.
- **Criterio Relacionado**: **AC40**, **AC43–AC44**.

### [QA-Home-05] Reloj digital y chips del hero
- **Descripción**: Verificar saludo en dos líneas, hora accesible y actualizada, flip de cifras al cambiar el minuto, parpadeo del separador y respeto de movimiento reducido; comprobar los chips de ciudad, fecha y clima, el fallback meteorológico, la frase configurable completa y la composición responsive sin desbordamiento.
- **Módulos**: `DashboardView`, reloj digital de Inicio, `HomeClimateSummary` y pruebas del hero.
- **Criterio Relacionado**: **AC22, AC25, AC31, AC38–AC40**.
