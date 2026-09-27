# Tareas: Smart Displays Android nativos V1

**Estado:** Fase 0 cerrada; bridge de Fase 1 implementado y probado con ADB/aislamiento Linux reales. Integración API y fases posteriores pendientes.

## Fase 0 — Contrato y decisiones (esta entrega)

- [x] Documentar alcance, exclusiones, modelo Smart Display y separación de ADB como infraestructura en `android-display-integration-v1.md`.
- [x] Definir contratos propuestos, amenazas, estado, claves persistentes, Display Mode, sesión LAN y criterios AC01–AC13.
- [x] Cerrar topología Linux (API host-network → HTTP bridge en loopback con autenticación), overlay Desktop en red común, persistencia de `~/.android`, exclusión de `open_url`/`reboot`, piloto HTTP LAN y requisito HTTPS local para clientes.
- [ ] Verificar API HomePilot host-network → HTTP bridge en loopback en Linux y API → bridge por DNS de servicio en Desktop cuando exista el cliente interno. La ruta real de `adbkey` y el aislamiento Linux del bridge ya se verificaron; no marcar la integración API como probada todavía.
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

- [ ] Añadir spec de migración/reversión concreta antes de crear tablas `android_display_sources` y `android_display_observations`; repositorios y pruebas de FK, borrado, duplicados y cambio de IP sin cambio de `device_id`.
- [ ] Incorporar `android-display`, `smart_display` y semantic type, capacidad explícita sin fallback legacy, driver y comandos V1; reutilizar `volume_set`.
- [ ] Añadir `RouteHandler` de adopción/prueba/estado/configuración/comandos, con autorización por hogar y rol, contratos de error, auditoría y límites de tiempo.
- [ ] Añadir vista de adopción en Operator Console: nombre, IP, habitación, prueba, autorización pendiente, metadatos y online/offline.
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

- [ ] Incorporar overlay opcional al instalador y mantenimiento sin alterar `bridge_ha`, `native_only` ni `ha_companion` cuando no haya displays.
- [ ] Integrar imagen bridge con builder/lifecycle HomePilot, healthchecks, logging rotado, observabilidad, alerta de indisponibilidad y rollback de imagen.
- [ ] Añadir backup protegido/cifrado y restauración aislada de `~/.android` y secreto interno, separados del backup SQLite; probar pérdida de claves → `needs_authorization` sin pérdida del dispositivo.
- [ ] En Linux real, probar API → bridge, host → bridge por loopback, otro equipo LAN → HTTP bridge rechazado, LAN → 5037 rechazado y ausencia de listener host `*:5037`; verificar autenticación interna. En Desktop, probar DNS de servicio por red compartida con igual contrato/auth y sin puerto publicado.
- [ ] Recrear el contenedor bridge y reiniciar el appliance completo: comprobar que persisten claves/autorización, estado y operación; ejecutar restore aislado y verificar recuperación. Evidencia: AC02, AC03, AC11.
- [ ] Implementar y validar HTTPS local con nombre/certificado confiable y operación sin Internet antes de considerar Display Mode listo para clientes. HTTP LAN permanece etiquetado y restringido al piloto interno. Evidencia: AC10.

## Fase 6 — Migración piloto NEZU y cierre

**Depende de:** AC01–AC11 y autorización operativa explícita; no forma parte de la Fase 0.

- [ ] Registrar manualmente la pizarra piloto `192.168.1.37:5555`; comparar identidad/metadatos y revisar la autorización ADB.
- [ ] Validar comandos y rechazo de apps/comandos/destinos no autorizados, Display Mode con Internet desconectado, escenas/dispositivos permitidos, revocación de sesión y reinicio del appliance/recovery antes del corte.
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
