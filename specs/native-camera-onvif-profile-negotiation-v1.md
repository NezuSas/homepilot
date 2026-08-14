# SPEC: Native Camera ONVIF Profile Negotiation V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-13

## Problema

`OnvifPtzCameraDriver` (Fase 1, [[native-camera-integration-hexagonal-refactor-v1]]) delegaba la
negociación en `node-onvif@0.1.7`, un paquete sin mantenimiento que solo expone `init()` +
`getUdpStreamUrl()` — sin explorar los perfiles de video disponibles (`GetProfiles`), sin elegir
explícitamente uno (`GetStreamUri` con `ProfileToken`), y sin ninguna vía para PTZ. El descubrimiento
WS-Discovery (`OnvifWsDiscoveryProbe`, movido verbatim en Fase 1) seguía parseando SOAP con regex,
con un filtro `.includes('onvif')` que deja pasar falsos positivos (p. ej. smart TVs respondiendo al
probe genérico).

## Alcance

- Ítem A: Nueva dependencia directa `fast-xml-parser` (sin dependencias propias) reemplaza
  `node-onvif`, que se elimina de `package.json`.
- Ítem B: `OnvifSoapEnvelopes.ts` construye los 3 sobres SOAP necesarios (`GetCapabilities`,
  `GetProfiles`, `GetStreamUri`) con autenticación WS-Security `UsernameToken`
  (`PasswordDigest = base64(sha1(nonce ‖ created ‖ password))`), expuesta como función pura
  (`buildPasswordDigest`) para ser determinísticamente testeable.
- Ítem C: `OnvifSoapClient.ts` ejecuta las 3 operaciones reales por HTTP/SOAP, parseando la
  respuesta con `fast-xml-parser` (`removeNSPrefix: true`, ya que ONVIF usa prefijos de namespace
  arbitrarios `tds:`/`trt:`/`tt:`). Detecta credenciales rechazadas (`OnvifUnauthorizedError`) tanto
  por status 401 como por un fault SOAP con "NotAuthorized" en el cuerpo, incluso sin 401.
- Ítem D: Política de selección de perfil (`orderProfilesByPreference`): prioriza H.264 sobre otros
  códecs; entre perfiles del mismo códec, prioriza la resolución más alta que no exceda 1920×1080; si
  ningún perfil cumple el tope, se ordenan igual entre sí por resolución. Implementada como
  comparador por niveles (no una suma ponderada) para que una resolución fuera del tope nunca gane
  por su sola magnitud de píxeles.
- Ítem E: `OnvifPtzCameraDriver.negotiate` reescrito: `GetCapabilities` → `GetProfiles` →
  itera perfiles en el orden de preferencia, probando `GetStreamUri` hasta que uno tenga éxito;
  conserva el fallback a sondeo TCP puro para cualquier fallo no-autenticación, y `unauthorized`
  inmediato para credenciales rechazadas — mismo contrato de `NativeCameraNegotiation` que la Fase 1.
- Ítem F: `OnvifWsDiscoveryProbe` conserva su lógica UDP/multicast intacta (Fase 1 no la tocó); solo
  el filtro de relevancia ONVIF sigue siendo el substring `.includes('onvif')` heredado — **no** se
  tocó en esta fase (ver Fuera de alcance).
- Ítem G: Migración aditiva `027_add_onvif_profile_to_native_camera_sources.sql`: columnas nullable
  `profile_token`, `ptz_configuration_token`, y `ptz_supported` (default 0). `NativeCameraSource` y
  `NativeCameraSourceRepository`/`SQLiteNativeCameraSourceRepository` extendidos con los tres campos;
  `NativeCameraService.create`/`update` persisten `profileToken`/`ptzConfigurationToken` desde el
  resultado de la negociación (`ptzSupported` se deja en `false`, sin usar todavía — Fase 3).

## Fuera de alcance

- No se reemplaza el filtro de relevancia `.includes('onvif')` en `OnvifWsDiscoveryProbe` — sigue
  siendo un punto débil conocido y documentado, pero tocarlo no formaba parte del pedido original de
  "negociación de perfiles" y el mecanismo de descubrimiento UDP/regex quedó fuera del alcance
  aprobado para esta fase.
- No se implementan aún los comandos PTZ (`ContinuousMove`/`Stop`) ni la capacidad `camera_ptz`
  (Fase 3: `specs/native-camera-ptz-control-v1.md`). `ptzConfigurationToken` se persiste cuando el
  perfil elegido lo reporta, pero no se usa todavía.
- No se agrega reintento/circuito de resiliencia sobre las llamadas SOAP: un fallo de cualquier
  operación cae directamente al fallback TCP existente, igual que antes.

## Requisitos funcionales

- **REQ-01**: `buildPasswordDigest(nonce, created, password)` es una función pura, determinística.
- **REQ-02**: `OnvifSoapClient.getProfiles` maneja correctamente tanto un único `<Profiles>` (objeto)
  como múltiples (array) — el bug de forma más probable al migrar desde XML.
- **REQ-03**: Un fallo de autenticación ONVIF (401 o fault SOAP "NotAuthorized") se traduce a
  `{outcome:'unauthorized'}` sin intentar el fallback TCP.
- **REQ-04**: Cualquier otro fallo ONVIF (red, perfil sin stream URI válido, respuesta sin Media
  XAddr) cae al mismo fallback TCP puro que en la Fase 1.
- **REQ-05**: `orderProfilesByPreference` nunca permite que una resolución que excede 1920×1080 gane
  sobre una que cumple el tope, sin importar la diferencia de píxeles.
- **REQ-06**: Filas existentes de `native_camera_sources` (creadas antes de esta migración) siguen
  siendo válidas sin backfill; `ptz_supported` por defecto es `0`.

## Requisitos no funcionales

- **NFR-01**: Regresión cero: los tests de Fase 1 (`NativeCameraRoutes.test.ts`,
  `CameraRoutes.test.ts`, `NativeCameraService.test.ts`, `SQLiteNativeCameraSourceRepository.test.ts`)
  siguen pasando (extendidos solo con las 3 columnas nuevas en sus fixtures/esquemas inline).
- **NFR-02**: Ningún uso de `as any`/`: any` para interactuar con la salida de `fast-xml-parser` —
  se usa un helper `dig()` tipado con `unknown` en vez de castear a `any`.

## Criterios de aceptación

- [x] AC1: `buildPasswordDigest` produce el mismo resultado que un cálculo independiente de
      sha1(nonce‖created‖password) en base64, y cambia si cualquiera de los tres insumos cambia.
- [x] AC2: `getProfiles` sobre una respuesta con un único perfil y sobre una con múltiples perfiles
      produce el mismo tipo de resultado (array), incluyendo el token de configuración PTZ cuando el
      perfil lo reporta.
- [x] AC3: Una respuesta 401 y una respuesta 500 con fault "NotAuthorized" en el cuerpo producen
      ambas `OnvifUnauthorizedError`.
- [x] AC4: `OnvifPtzCameraDriver.negotiate` prueba el siguiente perfil cuando `GetStreamUri` falla
      para el preferido, y solo cae a TCP cuando ningún perfil produce una URI de stream utilizable.
- [x] AC5: Credenciales rechazadas nunca disparan el sondeo TCP (`networkProbe.isReachable` no se
      llama).
- [x] AC6: `orderProfilesByPreference` prioriza H.264 sobre otros códecs, prioriza perfiles dentro
      del tope 1920×1080 sobre los que lo exceden (incluso si estos tienen más píxeles), y entre
      perfiles del mismo nivel prioriza mayor resolución.
- [x] AC7: Un ProbeMatch de smart-TV (sin la palabra "onvif" en el payload) sigue siendo ignorado —
      regresión de comportamiento heredado de la Fase 1, sin cambios en esta fase.
- [x] AC8: Migración 027 aplicada sobre una base de datos con filas preexistentes no rompe ninguna
      lectura/escritura existente; `ptz_supported` es `0` por defecto.
- [x] AC9: Suite completa sin regresiones (151 suites, 1259 tests), typecheck y build limpios,
      imagen Docker reconstruida sin `node-onvif` arranca correctamente y aplica la migración 027.

## Notas técnicas y arquitectura

`packages/integrations/native-camera/infrastructure/onvif/{OnvifSoapEnvelopes,OnvifSoapClient}.ts` —
nuevos. `OnvifPtzCameraDriver.ts` reescrito para usar `OnvifSoapClient` en vez de `node-onvif`,
conservando la misma firma de constructor (el `soapClient` es un parámetro opcional con default,
transparente para el assembler de Fase 1). `migrations/027_add_onvif_profile_to_native_camera_sources.sql`.

## Preguntas abiertas y TODOs

- TODO (Fase 3): usar `ptzConfigurationToken`/`ptzSupported` para exponer control PTZ real
  (`ContinuousMove`/`Stop`) y la capacidad `camera_ptz`.
- TODO: si se reporta el mismo problema de falsos positivos de descubrimiento (`OnvifWsDiscoveryProbe`)
  que motivó esta fase, reemplazar el filtro `.includes('onvif')` por una verificación real de
  `Scopes`/`Types` ONVIF — quedó fuera de alcance aquí a propósito.
