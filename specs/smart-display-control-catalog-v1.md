# Catálogo comercial y acciones Dashboard para Smart Displays V1

**Estado:** Implementado

## Alcance

El manifest `homepilot.board-manifest.v1` conserva sus campos obligatorios y puede incluir `entitlement` opcional con plan y comandos comerciales estrictamente tipados. El parser rechaza claves desconocidas y cualquier configuración ADB raw. El snapshot SQLite guarda la versión parseada sin cambiar esquema.

`DeviceControlCatalogProvider` presenta el plan y los comandos autorizados por el manifest. HomePilot reemplaza a Home Assistant como controlador de las pizarras. `implementationType` determina la ruta (`executionRoute`), no si un comando es usable: `homepilot` exige una acción efectiva local coincidente y usa el pipeline físico HomePilot; `legacy_adb` usa IntentFlow S2S, sin acción efectiva local ni ADB raw en HomePilot. IntentFlow conserva la autoridad final de entitlement y ejecución ADB. Los manifests anteriores muestran `Plan <id>` y forman el catálogo desde `actions`. Un manifest expirado no ofrece ejecución.

Las rutas autenticadas comprueban pertenencia al hogar. `GET /api/v1/devices/:id/control-catalog` devuelve solo el catálogo de presentación. `GET /api/v1/dashboard-action-targets` agrupa acciones elegibles de los hogares accesibles sin solicitudes HTTP por dispositivo. Un comando `button` visible, sin confirmación y con ruta de ejecución puede ser target Dashboard, incluso `legacy_adb`. `POST /api/v1/devices/:id/actions/:actionKey/execute` admite solo `{}`, revalida el catálogo vigente y resuelve la ruta en el servidor: local con `executeDeviceCommandUseCase` o remota con IntentFlow S2S. La denegación no tiene fallback.

El Gestor de Dispositivos presenta en una sección los comandos visibles incluidos en el plan sin exponer la ruta técnica. Dashboard conserva `kind=action` y serializa los targets como `device-action:<deviceId>:<actionKey>` dentro del `entityId` existente; no requiere migración. El navegador no recibe `boardId`, token, ADB raw ni `executionRoute`. `SectionActionCard` conserva su feedback transitorio. Los `slider`, incluido `hp_volume_set`, quedan fuera de esta feature y no se convierten en botones.

Para la ruta remota, HomePilot obtiene de Directory un Edge Service Token de scope `homepilot.command.execute`, distinto del token `homepilot.manifest.read` del sync. El token de ejecución permanece solo en memoria, se reutiliza dentro de una ventana menor que su TTL y se invalida ante 401, con un máximo de un reintento. HomePilot envía únicamente `boardId` del manifest vigente y `commandKey` a IntentFlow; nunca envía comandos ADB raw ni credenciales al browser.

## Criterios de aceptación

- [x] Manifest V1 antiguo válido; `entitlement` opcional, estricto y sin payload ADB raw.
- [x] Plan y comandos comerciales disponibles desde el snapshot SQLite.
- [x] `executionRoute=homepilot` exige acción efectiva local coincidente; `executionRoute=intentflow` permite comandos `legacy_adb` autorizados sin acción efectiva local.
- [x] Botones visibles, sin confirmación y con ruta vigente son elegibles para Dashboard; sliders, ocultos, confirmables y manifests expirados no lo son.
- [x] Catálogo y listado batch exigen auth/ownership y no entregan manifest ni configuración interna.
- [x] Ejecución por `actionKey` revalida ownership, catálogo y ruta; la ruta local conserva el pipeline físico y la remota usa IntentFlow S2S sin fallback.
- [x] Directory emite token `homepilot.command.execute` separado del `manifest.read`; caché efímera con margen de expiración y solo un retry ante 401.
- [x] Gestor muestra catálogo y plan sin controles de ejecución; Dashboard usa la tarjeta Action existente.
- [x] Target persistible `device-action:<deviceId>:<actionKey>` sin datos técnicos; revocación produce 403 sin fallback.
- [x] El browser solo recibe presentación y el target opaco; no recibe `boardId`, token, ADB raw ni `executionRoute`.
- [x] Traducciones ES/EN y pruebas de regresión escritas.

Las pruebas y validaciones no se ejecutaron por restricción explícita de esta tarea.
