# Tareas: Matter Camera Bridged Recognition V1

## Implementación

- [x] AC1/AC2: `HomeAssistantClient.getEntityRegistryEntry` (WebSocket de un solo uso, nunca
      rechaza, siempre resuelve `{platform}` o `null`).
- [x] `HomeAssistantClientPort.getEntityRegistryEntry?` — método opcional agregado al puerto.
- [x] AC3/AC4: `HomeAssistantImportService.importDevice` — `vendor = platform || 'Home Assistant'`,
      `lastKnownState.haPlatform` espejado, envuelto en `try/catch` que nunca bloquea el import.
- [x] AC5: `CameraDeviceTile.tsx` — chip `StatusPill` "Matter" condicionado a `vendor === 'matter'`;
      claves i18n `camera.matter_badge` en `es`/`en`.
- [x] Cero cambios en `packages/integrations/native-camera`, cero migración, cero `source_type`
      nuevo (verificado).

## Verificación

- [x] AC1/AC2: `HomeAssistantClient.entity_registry.test.ts` (nuevo, 5 tests: resolución exitosa,
      `auth_invalid` → null, `success:false` → null, error de socket → null, resultado sin
      `platform` → null) usando un mock del módulo `ws` con un socket falso basado en `EventEmitter`.
- [x] AC3/AC4: 2 tests nuevos en `HomeAssistantImportService.test.ts` (plataforma `matter` →
      vendor/lastKnownState correctos; fallo del registro → import exitoso con vendor legado) + los
      6 tests preexistentes sin modificar (regresión: el mock no implementa el método opcional).
- [x] AC6: `npx tsc --noEmit`, `npm run build`, `npm run build --prefix apps/operator-console`,
      suite completa (153 suites, 1283 tests) sin regresiones; `check:spec-coverage` (conteo
      actualizado a 608), `check:architecture-boundaries`, `check:no-production-any`,
      `check:bdd-traceability`, `check:module-test-coverage`, `check:i18n`, `check:ui-primitives`,
      `check:tuya-policy`, `check:docker-profiles` — todos en verde.
- [x] AC7: `docker build` + `docker run` — arranque correcto, `/health` en verde. Contenedor, imagen
      y volumen de prueba eliminados al finalizar.
