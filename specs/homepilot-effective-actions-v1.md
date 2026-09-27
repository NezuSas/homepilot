# HomePilot effectiveActions v1

**Estado:** Implementado

## Alcance

Esta fase establece una función pura para calcular acciones efectivas a partir
de un manifest de Board producido por IntentFlow y un `Device` local de
HomePilot. No recibe el manifest por red, no lo persiste y no ejecuta comandos.

La regla es una intersección: acciones presentes en el manifest, comandos
declarados por las capacidades locales del Device y política operativa local.
Una acción comercial no puede ampliar las capacidades de HomePilot. En V1,
el Device debe coincidir por UUID, tener estado `ASSIGNED` y una habitación
asignada. Un Device `PENDING` o sin habitación produce cero acciones efectivas.
La resolución no usa IP, MAC, identificador Android, ADB, hostname ni nombre.

## Contrato externo y validación runtime

`packages/cloud-gateway/application/BoardManifestV1.ts` define el contrato
`homepilot.board-manifest.v1` y valida datos externos en tiempo de ejecución.
El objeto raíz acepta exactamente `schemaVersion`, `revision`, `boardId`,
`installationId`, `homePilotDeviceId`, `planId` y `actions`.

- `schemaVersion` debe ser exactamente `homepilot.board-manifest.v1`.
- `revision` debe ser SHA-256 hexadecimal de 64 caracteres.
- `boardId` y `planId` deben ser enteros positivos seguros.
- `installationId` y `homePilotDeviceId` deben ser UUID válidos.
- `actions` debe ser un array sin claves de acción duplicadas.
- Cada acción acepta exactamente `key`, `displayName`, `semanticAction`,
  `controlType`, `implementationType`, `implementationConfig`, `visibility`,
  `safetyLevel` y `requiresConfirmation`, con tipos y valores cerrados.
- `semanticAction` debe ser un `DeviceCommandV1` reconocido;
  `implementationType` debe ser `homepilot`.
- `controlType` admite `button` o `slider`; `visibility`, `visible` o `hidden`;
  `safetyLevel`, `normal` o `sensitive`.
- `implementationConfig` debe ser un objeto plano vacío. Ninguna configuración
  remota de shell, ADB, paquetes, URL, keyevent u otro comando se consume.
- Una acción `sensitive` sin `requiresConfirmation=true` invalida todo el
  manifest. Las claves inesperadas también invalidan el manifest completo.

El parser devuelve solo una copia de campos validados y falla cerrado con
`BOARD_MANIFEST_INVALID` cuando el contrato no es válido. Esta validación de
estructura no autentica al emisor: autenticación y transporte son fases
posteriores.

## Resolver local

`packages/cloud-gateway/application/EffectiveActionsResolver.ts` expone
`resolveEffectiveActions(manifest, device)`.

1. Valida el manifest completo antes de resolver.
2. Rechaza `homePilotDeviceId` distinto de `device.id` con
   `EFFECTIVE_ACTIONS_DEVICE_MISMATCH`.
3. Retorna `[]` si el Device no está `ASSIGNED` o no tiene `roomId`.
4. Usa `resolveCapabilitiesForDevice` y `CAPABILITY_DEFINITIONS` como autoridad
   de comandos soportados. No usa el fallback legacy de ejecución.
5. Deriva `controlType` de cada comando local: sin parámetros es `button`;
   con exactamente un parámetro numérico obligatorio y `min`/`max` numéricos
   definidos es `slider`; los demás esquemas no son representables en V1.
   El `controlType` remoto no es autoridad: una acción solo se conserva si
   coincide exactamente con el control derivado localmente. No se corrige
   silenciosamente un control remoto incorrecto.
6. Ordena las acciones admitidas de forma determinística por `key`.

`EffectiveAction` conserva `key`, `displayName`, `semanticAction`,
`controlType`, `visibility`, `safetyLevel` y `requiresConfirmation`. No incluye
`implementationConfig`, datos físicos ni secretos. `visibility` se conserva
para una UI futura, pero nunca concede una capacidad.

En Smart Display, la capacidad local permite exclusivamente `navigate_home`,
`navigate_back` y `volume_set`. El comando `volume_set` mantiene el esquema
local existente `volume: integer 0..100`; el manifest define la acción pero no
transporta valores de ejecución. El driver conserva su validación final de
fuente, estado de conexión e identidad física al ejecutar en fases posteriores.
No se modificó el driver ni se duplicó su lista de acciones: el resolver lee
`CAPABILITY_DEFINITIONS` existente.

## Fuera de alcance

No se implementan autenticación service-to-service HomePilot→IntentFlow,
descarga o sincronización del manifest, caché SQLite, TTL o gracia offline,
revocación push, endpoint o UI de `effectiveActions`, ejecución desde
IntentFlow ni retirada del ADB legacy. Tampoco se modifica el pipeline actual
de comandos de dispositivos. No se declara validación E2E de este manifest.
La futura sincronización S2S debe verificar que `manifest.installationId`
coincida con el `installationId` esperado localmente antes de resolver acciones;
esta fase no dispone todavía de esa vinculación de identidad.

## Criterios de aceptación

- [x] **AC1.** Un manifest válido con las tres acciones Smart Display produce tres `EffectiveAction` ordenadas por `key`.
- [x] **AC2.** Schema, revision, IDs, estructura, tipos, claves extra o duplicadas y acciones desconocidas inválidas fallan cerrado.
- [x] **AC3.** `implementationType` distinto de `homepilot` o `implementationConfig` no vacío invalidan el manifest.
- [x] **AC4.** Una acción `sensitive` sin confirmación invalida el manifest.
- [x] **AC5.** Un UUID de Device distinto se rechaza; un Device no asignado produce cero acciones.
- [x] **AC6.** Una acción globalmente conocida pero no soportada por las capacidades del Device se excluye.
- [x] **AC7.** La salida no contiene configuración remota, IP, MAC, Android ID, ADB ni secretos.
- [x] **AC8.** La resolución es pura, determinística y no ejecuta comandos.
- [x] **AC9.** `controlType` debe coincidir con la forma local representable por `button` o `slider`; una discrepancia o un esquema no representable excluye la acción.

Los tests se escribieron, pero no se ejecutaron por restricción expresa de esta tarea.
