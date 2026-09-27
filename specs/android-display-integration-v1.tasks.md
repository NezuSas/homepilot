# Tareas: Smart Displays Android nativos V1

**Estado:** Fase 0 cerrada; bridge de Fase 1, incremento backend local de Fase 2 y appliance opcional Linux de Fase 5 validados en MiniPC y Droidlogic reales para los casos indicados abajo. Backup cifrado, UI Smart Display, Display/Kiosk Mode, IntentFlow, `launch_app` y retirada legacy pendientes.

## Fase 0 — Contrato y decisiones (esta entrega)

- [x] Documentar alcance, exclusiones, modelo Smart Display y separación de ADB como infraestructura en `android-display-integration-v1.md`.
- [x] Definir contratos propuestos, amenazas, estado, claves persistentes, Display Mode, sesión LAN y criterios AC01–AC13.
- [x] Cerrar topología Linux (API host-network → HTTP bridge en loopback con autenticación), overlay Desktop en red común, persistencia de `~/.android`, exclusión de `open_url`/`reboot`, piloto HTTP LAN y requisito HTTPS local para clientes.
- [x] Verificar API HomePilot host-network → bridge en el piloto Linux mediante adopción, refresh y comando local; la ruta real de `adbkey` y el aislamiento Linux del bridge ya se habían verificado.
- [ ] Verificar API → bridge por DNS de servicio en Docker Desktop; el resultado Linux no acredita esa topología.
- [ ] Definir contenido inicial de allowlist de paquetes y mecanismo de certificados/nombre HTTPS local que funcione sin Internet antes de habilitar displays de clientes.

## Fase 1 — Bridge privado y persistencia de claves

**Depende de:** Fase 0, topología y almacenamiento verificados. **No habilita API pública ni UI.**

- [x] Crear `services/android-display-bridge/` con imagen, daemon ADB solo en su namespace, UID/GID no-root, `HOME` estable, mount administrado de `~/.android` (`adbkey`/`adbkey.pub`) y healthcheck; nunca publicar 5037. Validado en Linux real para el bridge, sin implicar validación del futuro cliente API.
- [x] Definir servidor de contrato interno estricto, secreto de servicio, registro por `sourceId`, validación de IP LAN/puerto y rechazo de shell, campos extra y endpoints arbitrarios. El cliente del API HomePilot pertenece a Fase 2.
- [x] Implementar conexión, estado, metadatos best-effort, locks, timeouts y retries acotados; no repetir acciones no idempotentes. Persistencia de claves y recreación del bridge comprobadas en Linux real.
- [x] Corregir semántica de Fase 1: `lock_screen` → keyevent 223; rechazar `sleep` y `power_toggle` sin alias. Documentar que keyevent 223 no suspendió Droidlogic, keyevent 26 dejó ADB offline y `wake` no está validado físicamente para ese perfil.
- [ ] Probar falta de token, destino ADB no autorizado, comandos/apps/URLs no autorizados (`open_url` y `reboot` rechazados), desconexión, recreación del bridge con autorización ADB conservada, pérdida de claves y logs/API/`lastKnownState` sin claves. Evidencia: AC03, AC04, AC06, AC11, AC13.

## Fase 2 — Dominio, repositorio y adopción manual

**Depende de:** Fase 1. **No habilita todavía Display Mode.**

- [x] Incremento backend local: migración aditiva 029, fuente/observación separadas, cliente HTTP tipado del bridge, driver registrado, `smart_display` fail-closed y rutas administrativas de prueba/adopción/lista/detalle/refresh; reutiliza `/api/v1/devices/:id/command` para `navigate_home`, `navigate_back` y `volume_set`. Validado en hardware real solo para las operaciones indicadas abajo; no declara completo el resto de Fase 2.
- [x] Registrar evidencia del piloto MiniPC Linux: migración 029 aplicada con `integrity_check=ok`; Droidlogic `C-T982-61-4G-A52D` Android 11 adoptada en `192.168.1.37:5555` con `androidId=8d08ff705346cade`; adopción HTTP 201; `Device` nativo `smart_display` con `integrationSource=android-display`; fuente y observación persistidas; refresh conserva identidad y `online`.
- [x] Registrar evidencia de comandos: `navigate_home` por `POST /api/v1/devices/:id/command` → HTTP 200; `sleep` → HTTP 400 `INVALID_COMMAND`. No se probaron `power_toggle`, `reboot`, `lock_screen` ni `wake` sobre la pizarra en este piloto de integración.
- [x] Fijar política operativa NEZU: Smart Displays instaladas con IP fija como endpoint; `device_id` HomePilot como identidad interna; `android_id` como verificación física cuando exista; MAC solo metadata auxiliar futura, nunca identidad primaria.

- [ ] Completar la cobertura de reversión operativa y los casos pendientes de repositorios: FK, borrado, duplicados y cambio de IP sin cambio de `device_id`. Las tablas del incremento local ya fueron creadas por la migración 029; no tratarlas como futuras.
- [ ] Incorporar `android-display`, `smart_display` y semantic type, capacidad explícita sin fallback legacy, driver y comandos V1; reutilizar `volume_set`.
- [ ] Añadir `RouteHandler` de adopción/prueba/estado/configuración/comandos, con autorización por hogar y rol, contratos de error, auditoría y límites de tiempo.
- [x] Añadir UI administrativa V1 en Sistema para listar, probar y adoptar por nombre/IP/puerto fijo, mostrar autorización pendiente, metadatos y estado; reutilizar `DeviceInspector` para asignación a habitación y el pipeline existente para `navigate_home`, `navigate_back` y `volume_set`. No habilitar acciones de energía, shell ni `launch_app`.
- [ ] Probar AC01, AC04–AC06, AC13 y no regresión de drivers actuales. No habilitar `reboot`.

## Fase 3 — Identidad de display y Display Mode read-only

**Depende de:** Fase 2. HTTP LAN se habilita únicamente para el piloto interno NEZU; clientes requieren HTTPS local antes de considerarse listos. **Bloquea interacción hasta completar autorización.**

- [ ] Crear repositorio y flujo de enrollment one-shot, sesión display revocable de scope hogar/dashboard/display, expiración, cookies HttpOnly/host-only/SameSite y política Secure según HTTPS confiable.
- [ ] Crear proyección de dashboard y datos limitada al principal display; auditar cada widget y bloquear/omitir los que requieren endpoints administrativos.
- [ ] Montar `/display/:displayId` con `DashboardCanvas`, tabs y widgets existentes; carcasa sin controles de edición/admin, responsive y táctil.
- [ ] Probar refresh, tab por defecto/fallback, expiración y revocación efectiva de sesión display, aislamiento entre hogares, CSRF, rutas administrativas denegadas e Internet ausente con LAN activa. Evidencia: AC07, AC08, AC10, AC13.

## Fase 4 — Interacción limitada V1

**Depende de:** Fase 3 read-only validada.

- [ ] Definir grants explícitos por display/target/acción para dispositivos y escenas; ninguna autorización derivada de ocultar UI.
- [ ] Conectar widgets aprobados a APIs de display para acciones, con Origin/CSRF, ownership, rate limit, auditoría, confirmaciones donde apliquen y feedback de fallo real.
- [ ] Completar `show_dashboard` por IDs internos y URL local construida por HomePilot; probar `launch_app` dentro/fuera de allowlist y rechazo explícito de URL arbitraria, `open_url`, `reboot` y comandos no autorizados.
- [ ] Pruebas positivas y negativas de AC04, AC09, AC10 y AC13, incluida petición directa a recursos fuera del scope.

## Fase 5 — Appliance opcional y recovery

**Depende de:** Fases 1–4 y topología verificada en Fase 0.

- [x] Incorporar feature flag persistente y overlay opcional al instalador y mantenimiento sin alterar `bridge_ha`, `native_only` ni `ha_companion` cuando no haya displays; token generado una vez, CIDR privado validado y ADB home persistente protegido.
- [x] Integrar imagen bridge habilitada con builder/lifecycle HomePilot, healthcheck, logging rotado y rollback de imagen, incluida candidatura al GC etiquetado y explícito.
- [x] Registrar validación en appliance Linux real: feature flag persistente, `.env` modo `0600`, token interno generado una vez y reutilizado con SHA-256 idéntico tras deploy y reboot; ADB home UID/GID `10001`, `.android` `0700`, `adbkey` `0600`, `adbkey.pub` `0644` y hashes de ambas claves idénticos tras deploy y reboot.
- [x] Registrar mantenimiento y deploy reales: overlay `docker-compose.android-display.yml` seleccionado automáticamente, bridge en lifecycle active/rollback/pending, deploy estándar completo, API y bridge healthy, HTTP del bridge solo en `127.0.0.1:5002`, sin publicación TCP `5037` y URL/token correctos recibidos por API.
- [x] Registrar reboot completo de MiniPC: servicios HomePilot regresan automáticamente, Droidlogic vuelve `online` con el mismo `androidId=8d08ff705346cade`, refresh correcto y `navigate_home` HTTP 200. Esto no valida `reboot`, `power_toggle`, `lock_screen` ni `wake` de la pizarra.
- [x] Documentar los defectos encontrados y corregidos durante validación Linux: `wizard` sin inicializar bajo `set -u` e inspección no privilegiada del ADB home `10001:10001/0700` que confundía `EACCES` con inexistencia. Confirmar preservación de identidad y token tras las correcciones.
- [ ] Completar observabilidad y alerta de indisponibilidad más allá de la verificación operativa actual.
- [ ] Añadir backup protegido/cifrado y restauración aislada de `~/.android` y secreto interno, separados del backup SQLite; probar pérdida de claves → `needs_authorization` sin pérdida del dispositivo.
- [ ] Completar pruebas de aislamiento desde otro equipo LAN hacia HTTP del bridge y TCP `5037`, comprobar ausencia de listener host `*:5037` y verificar autenticación interna. En Desktop, probar DNS de servicio por red compartida con igual contrato/auth y sin puerto publicado. La publicación solo en loopback y la ausencia de publicación `5037` ya están verificadas en el deploy Linux, pero no cierran esta matriz.
- [ ] Verificar por separado recreación del contenedor bridge con la identidad preservada y ejecutar restore aislado de claves/secretos cuando exista backup cifrado; el reboot completo de la MiniPC ya está validado, pero no demuestra recuperación desde backup. Evidencia parcial: AC02, AC03, AC11.
- [ ] Implementar y validar HTTPS local con nombre/certificado confiable y operación sin Internet antes de considerar Display Mode listo para clientes. HTTP LAN permanece etiquetado y restringido al piloto interno. Evidencia: AC10.

## Fase 6 — Migración piloto NEZU y cierre

**Depende de:** AC01–AC11 y autorización operativa explícita; no forma parte de la Fase 0.

- [x] Registrar manualmente la pizarra piloto `192.168.1.37:5555` y validar identidad/metadatos, persistencia y refresh en MiniPC Linux; adopción HTTP 201. Esta verificación no equivale al cierre de la migración legacy.
- [x] Confirmar tras reboot completo del appliance que Droidlogic vuelve `online`, conserva `androidId`, responde a refresh y permite `navigate_home` HTTP 200.
- [ ] Completar validación de comandos y rechazo de apps/comandos/destinos no autorizados, Display Mode con Internet desconectado, escenas/dispositivos permitidos, revocación de sesión y recovery desde backup antes del corte.
- [ ] Documentar punto de reversión y retirar bridge/daemon ADB históricos únicamente tras aceptación; confirmar que host no escucha `*:5037` ni depende de `has_template` para displays.
- [ ] Ejecutar matriz de calidad correspondiente (`check:spec-coverage`, BDD, cobertura modular, tests, typecheck, build, responsive, perfiles Docker y `verify:quality`) y registrar evidencia AC01–AC13. No adelantar release sin aprobación.

## Archivos probables por fase (no creados salvo esta spec y tareas)

| Fase | Áreas previstas |
| --- | --- |
| 1 | `services/android-display-bridge/`, cliente interno de `packages/integrations/android-display/`, tests del bridge. |
| 2 | `packages/devices/domain/{types,commands,capabilities,deviceProfiles,CapabilityResolver,CommandCapabilityValidator}.ts`, `packages/integrations/android-display/`, repositorios de `packages/devices/`, `apps/api/routes/`, `migrations/`, UI de adopción. |
| 3 | `packages/auth/`, nuevas rutas de display en `apps/api/routes/`, `apps/operator-console/src/App.tsx`, `apps/operator-console/src/views/dashboards/` y pruebas de widgets/permisos. |
| 4 | API de acciones de display, políticas de grants, `apps/operator-console/src/views/dashboards/widgets/` y pruebas de autorización. |
| 5 | Overlay Compose opcional, `scripts/install-edge-office.sh`, `scripts/homepilot-maintenance.sh`, helpers de backup/lifecycle y guía técnica. |
| 6 | Runbook de migración, checklist de seguridad/red y evidencia de validación; retirada legacy solo en ejecución autorizada. |
