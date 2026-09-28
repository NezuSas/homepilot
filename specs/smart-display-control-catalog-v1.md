# Catálogo comercial y acciones Dashboard para Smart Displays V1

**Estado:** Implementado

## Alcance

El manifest `homepilot.board-manifest.v1` conserva sus campos obligatorios y puede incluir `entitlement` opcional con plan y comandos comerciales estrictamente tipados. El parser rechaza claves desconocidas y cualquier configuración ADB raw. El snapshot SQLite guarda la versión parseada sin cambiar esquema.

`DeviceControlCatalogProvider` presenta el plan, el catálogo completo y la intersección con `resolveEffectiveActions`. El catálogo puede mostrar comandos legacy como incluidos, pero nunca marcarlos ejecutables localmente por su tipo de implementación. Los manifests anteriores muestran `Plan <id>` y forman el catálogo desde `actions`. Un manifest expirado no ofrece ejecución.

Las rutas autenticadas comprueban pertenencia al hogar. `GET /api/v1/devices/:id/control-catalog` devuelve solo el catálogo de presentación. `GET /api/v1/dashboard-action-targets` agrupa acciones elegibles de los hogares accesibles sin solicitudes HTTP por dispositivo. `POST /api/v1/devices/:id/actions/:actionKey/execute` resuelve la acción efectiva por key en el servidor y reutiliza `executeDeviceCommandUseCase`; solo admite acciones visibles de botón que no requieren confirmación. La denegación no tiene fallback.

El Gestor de Dispositivos presenta plan y catálogo sin ejecutar. Dashboard conserva `kind=action` y serializa los targets como `device-action:<deviceId>:<actionKey>` dentro del `entityId` existente; no requiere migración. `SectionActionCard` conserva su feedback transitorio. `volume_set` no es elegible para Action Card.

## Criterios de aceptación

- [x] Manifest V1 antiguo válido; `entitlement` opcional, estricto y sin payload ADB raw.
- [x] Plan y comandos comerciales disponibles desde el snapshot SQLite.
- [x] Solo acciones efectivas locales coincidentes se declaran ejecutables; slider, ocultas y con confirmación no son elegibles como botones Dashboard.
- [x] Catálogo y listado batch exigen auth/ownership y no entregan manifest ni configuración interna.
- [x] Ejecución por `actionKey` toma `semanticAction` del servidor y reutiliza el pipeline físico existente.
- [x] Gestor muestra catálogo y plan sin controles de ejecución; Dashboard usa la tarjeta Action existente.
- [x] Target persistible validado y revocación produce error sin fallback.
- [x] Traducciones ES/EN y pruebas de regresión escritas.

Las pruebas y validaciones no se ejecutaron por restricción explícita de esta tarea.
