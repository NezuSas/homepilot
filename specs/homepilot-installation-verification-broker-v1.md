# HomePilot Installation Verification Broker v1

**Estado:** Implementado

## Alcance

HomePilot actúa únicamente como broker efímero de una atestación de identidad Edge.
El operador crea primero en IntentFlow un challenge de instalación (vigencia de
cinco minutos). El navegador autenticado llama a HomePilot localmente para que
presente ese challenge a Directory usando la credencial Edge existente. Directory
devuelve una atestación firmada de 90 segundos; HomePilot la entrega sin verificar
su firma. El navegador autenticado en IntentFlow presenta luego la prueba a
`POST /api/homepilot-installations/{id}/verify-attestation/`.

Este flujo no vincula todavía Boards, Devices ni comandos. HomePilot no llama a
IntentFlow y no tiene sus credenciales. No se crea otro pairing, token, WebSocket
ni archivo de configuración cloud. La operación local de HomePilot no depende
de que Directory esté disponible.

## Contrato local

`POST /api/v1/system/installation-verification/attest` exige AuthGuard y rol
`admin`. Solicitud JSON exacta:

```json
{
  "installationId": "098ced36-2143-4ca2-a1fb-3afdc32117b7",
  "challengeId": "e974d0f6-60b2-4ed0-b759-f8713156d37f",
  "nonce": "43 caracteres base64url sin padding"
}
```

Ambos identificadores son UUID. `nonce` debe codificar exactamente 32 bytes y
tener exactamente 43 caracteres base64url, sin padding. Se rechazan campos
adicionales, incluidos URL, token, `homeId` o `edgeId`. Respuesta exitosa:

```json
{ "attestation": "<payload64>.<signature64>", "expiresIn": 90 }
```

La respuesta lleva `Cache-Control: no-store` y no contiene credencial, URL,
`homeId`, `edgeId`, payload decodificado ni metadatos internos. HomePilot no
almacena el challenge o la atestación en SQLite ni en archivos.

## Identidad cloud y transporte

El proveedor compartido lee el mismo `cloud-gateway.json` (o las variables de
entorno equivalentes) que ya usa `CloudGatewayConnector`: `url`, `token`,
`homeId`, `edgeId`. No cambia su formato ni su lifecycle. Solo se usa la URL
provisionada; el caller no elige el destino. Una URL `wss:` sin credenciales,
query ni fragment se convierte al origin `https:` conservando host y puerto,
y se fija el path `/directory/edge-attestation`.

HomePilot envía únicamente `{installationId, challengeId, nonce}` con
`Authorization: Bearer <Edge credential>` y `Content-Type: application/json`.
Directory deriva de esa credencial el Home y Edge autoritativos. Hay timeout
de 10 segundos mediante `AbortController` y ningún reintento automático.

HomePilot acepta solo un objeto JSON con exactamente `attestation` y
`expiresIn=90`. La atestación debe tener dos segmentos base64url sin padding.
No se decodifica el payload ni se verifica Ed25519: esa comprobación, junto con
challenge one-shot, expiración, nonce e identidad Directory, pertenece a
IntentFlow. HomePilot no posee clave pública ni privada de atestación.

## Errores públicos estables

| Código | Condición | HTTP |
| --- | --- | --- |
| `INSTALLATION_VERIFICATION_CLOUD_NOT_PAIRED` | Configuración Edge ausente o inválida | 503 |
| `INSTALLATION_VERIFICATION_INPUT_INVALID` | JSON, UUID, nonce o campos no válidos | 400 |
| `INSTALLATION_VERIFICATION_DIRECTORY_UNAVAILABLE` | Red o Directory 5xx | 502 |
| `INSTALLATION_VERIFICATION_DIRECTORY_REJECTED` | Directory rechaza la petición, incluidos 401/403 | 502 |
| `INSTALLATION_VERIFICATION_DIRECTORY_RESPONSE_INVALID` | Respuesta inesperada o malformada | 502 |
| `INSTALLATION_VERIFICATION_TIMEOUT` | Tiempo límite de 10 segundos | 504 |

Los errores no incluyen cuerpos remotos, credenciales, hashes, stack traces ni
datos criptográficos. El protocolo Cloud Gateway y Android Display no cambian.

## Auditoría y decisiones diferidas

No se añade todavía un evento al activity log: su contrato actual está
orientado a actividad de dispositivos y requeriría decidir una identidad
`deviceId` artificial para una operación de sistema. Esta fase no amplía ese
contrato solo para registrar el broker. Una auditoría de sistema futura podría
guardar fecha y resultado sanitizado, nunca nonce ni atestación.

Quedan fuera de alcance UI, pairing nuevo, llamada HomePilot→IntentFlow,
BoardDeviceLink, manifiestos, comandos, sincronización y cambios en Directory.

## Criterios de aceptación

- [x] **AC1.** Solo un administrador autenticado puede solicitar una atestación mediante el endpoint local.
- [x] **AC2.** HomePilot reutiliza la credencial Edge provisionada; no crea otra credencial ni otro pairing.
- [x] **AC3.** El caller solo puede enviar `installationId`, `challengeId` y `nonce`, con UUID y nonce validados localmente.
- [x] **AC4.** El caller no puede suministrar Directory URL, token, `homeId` ni `edgeId`.
- [x] **AC5.** La URL Gateway WSS se convierte internamente al origin HTTPS de Directory, conservando host y puerto y rechazando userinfo, query y fragment.
- [x] **AC6.** La petición a Directory contiene exactamente los tres campos del challenge y `Authorization: Bearer` con el token Edge existente.
- [x] **AC7.** La solicitud tiene timeout de 10 segundos y no realiza reintentos automáticos.
- [x] **AC8.** Rechazos 4xx de Directory, fallos 5xx o de red, timeout y respuestas inválidas se convierten en errores estables y sanitizados.
- [x] **AC9.** La respuesta de Directory exige exactamente `attestation` y `expiresIn=90`, con formato compacto de dos segmentos base64url.
- [x] **AC10.** HomePilot no verifica la firma Ed25519; IntentFlow conserva esa responsabilidad.
- [x] **AC11.** HomePilot no persiste localmente el challenge ni la atestación.
- [x] **AC12.** El endpoint responde `Cache-Control: no-store` y no devuelve token, `homeId` ni `edgeId`.
- [x] **AC13.** `CloudGatewayConnector` continúa leyendo la misma configuración cloud mediante `CloudEdgeConfigProvider`.

Estos criterios describen la implementación local; la validación física completa
IntentFlow → HomePilot → Directory → IntentFlow permanece pendiente.
