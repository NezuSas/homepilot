# Tareas: Native Camera ONVIF Profile Negotiation V1

## Implementación

- [x] AC1: `OnvifSoapEnvelopes.ts` — `buildPasswordDigest` (función pura), `buildGetCapabilitiesEnvelope`,
      `buildGetProfilesEnvelope`, `buildGetStreamUriEnvelope` con WS-Security `UsernameToken`.
- [x] AC2/AC3: `OnvifSoapClient.ts` — `getMediaServiceUrl`/`getProfiles`/`getStreamUri` vía
      `fast-xml-parser` (`removeNSPrefix: true`), helper `dig()` sin `any`, `asArray()` para
      normalizar nodos únicos vs. múltiples, `OnvifUnauthorizedError` en 401 o fault SOAP.
- [x] AC6: `orderProfilesByPreference` — comparador por niveles (encoding → tope de resolución →
      píxeles), no una suma ponderada.
- [x] AC4/AC5: `OnvifPtzCameraDriver.negotiate` reescrito para usar `OnvifSoapClient` en vez de
      `node-onvif`; itera perfiles ordenados, cae a TCP solo cuando ningún perfil produce una URI
      utilizable; `unauthorized` nunca dispara el fallback TCP.
- [x] `package.json` — `node-onvif` eliminado, `fast-xml-parser` agregado como dependencia directa.
- [x] AC8: `migrations/027_add_onvif_profile_to_native_camera_sources.sql` (3 columnas
      nullable/con default); `NativeCameraSource`, `NativeCameraSourceRepository`,
      `SQLiteNativeCameraSourceRepository` extendidos; `NativeCameraService.create`/`update`
      persisten `profileToken`/`ptzConfigurationToken` desde la negociación.

## Verificación

- [x] AC1: `OnvifSoapEnvelopes.test.ts` (7 tests: digest determinista, cambia con cada insumo,
      contenido de los 3 sobres, escape de XML).
- [x] AC2/AC3: `OnvifSoapClient.test.ts` (11 tests: perfil único vs. array — el caso crítico
      señalado en el plan —, token PTZ, 401, fault SOAP sin 401, ausencia de Media XAddr, lista
      vacía de perfiles, 3 tests de `orderProfilesByPreference`).
- [x] AC4/AC5: `OnvifPtzCameraDriver.test.ts` (7 tests: éxito directo, fallback al siguiente perfil,
      unauthorized sin TCP, fallback TCP por error no-auth, fallback TCP por ningún perfil utilizable,
      unreachable cuando TCP también falla, descubrimiento delegado).
- [x] AC8: `SQLiteNativeCameraSourceRepository.test.ts` y `NativeCameraRoutes.test.ts` actualizados
      con las 3 columnas nuevas en sus esquemas SQLite inline y fixtures.
- [x] AC9: `npx tsc --noEmit`, `npm run build`, suite completa (151 suites, 1259 tests) sin
      regresiones; `check:spec-coverage` (conteo actualizado a 604), `check:architecture-boundaries`,
      `check:no-production-any`, `check:bdd-traceability`, `check:module-test-coverage` — todos en
      verde; `docker build` (confirmado: 5 paquetes menos en el árbol tras quitar `node-onvif`) +
      `docker run` — arranque correcto, migración 027 aplicada (columnas confirmadas vía
      `PRAGMA table_info`), `/health` en verde. Contenedor, imagen y volumen de prueba eliminados al
      finalizar.
