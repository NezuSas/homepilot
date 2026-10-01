# Tareas — catálogo de Smart Display V1

- [x] Extender manifest V1 opcionalmente con entitlement estricto y persistencia de snapshot existente.
- [x] Resolver catálogo comercial y acciones efectivas de forma fail-closed.
- [x] Exponer catálogo, effective actions enriquecidas y targets batch con ownership.
- [x] Ejecutar Action Card por actionKey con el pipeline local existente o IntentFlow S2S según la ruta resuelta.
- [x] Sustituir control remoto del Gestor por catálogo informativo.
- [x] Añadir target `device-action` a la asignación persistida y al flujo de feedback existente.
- [x] Escribir pruebas de parser, provider, rutas, UI y target.
- [x] Separar scope Directory `command.execute` de `manifest.read` y añadir caché efímera segura del token de ejecución.
- [x] Crear cliente tipado IntentFlow S2S con respuesta y errores sanitizados, un retry máximo solo para 401 con token cacheado.
- [x] Resolver `executionRoute` en catálogo y habilitar botones remotos elegibles sin EffectiveAction local.
- [x] Revalidar catálogo y ownership en ejecución por `actionKey`; conservar pipeline local o llamar a IntentFlow según la ruta.
- [x] Mantener target Dashboard y frontend sin boardId, token, ruta técnica ni ADB raw.
- [x] Escribir pruebas para revocación, expiración, errores, duplicados por key y ausencia de fallback.
- [x] Dejar `hp_volume_set` para un widget Slider posterior, sin convertirlo en botón.
- [ ] Ejecutar pruebas, calidad y validación física en tarea autorizada.

## Extensión local de presentación en Espacios

- [x] Compartir el parser estricto y el hook de carga entre catálogo informativo y controlador de habitación, sin duplicar contratos ni crear stores.
- [x] Reutilizar SectionActionCard, su feedback momentáneo y executeDeviceActionTarget para botones autorizados; búsqueda y scroll para catálogos extensos.
- [x] Conservar ocultos, sliders y comandos no elegibles fuera de ejecución directa; no cambiar backend ni entitlement.
- [x] Validar presentación, transporte y separación del Gestor con los tests focalizados: 66/66 Jest (11 suites) y 37/37 responsive, con confirmación final 3/3. Typecheck, lint, builds y trazabilidad PASS.
- [ ] Verificar físicamente la pizarra y cámara en MiniPC; los tests locales usan servicios simulados y no sustituyen esa validación.
