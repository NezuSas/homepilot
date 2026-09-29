# HomePilot device-bound Edge identity v1

**Estado:** Aprobado

## Objetivo y alcance

HomePilot demuestra posesión de una clave P-256 no exportable de la MiniPC ante Directory para obtener Edge service tokens. El contrato de red es `nezu-homepilot-directory-main-integration/specs/edge-device-binding-v1.md`. No cambia IntentFlow, los scopes existentes ni el flujo legacy de instalaciones sin binding.

## Arquitectura y persistencia

- `DeviceIdentityProvider` aísla generación, clave pública, key ID, algoritmo, firma P1363 y autoverificación. Producción Linux usa TPM 2.0; desarrollo y CI pueden usar software, expresamente **NOT CLONE RESISTANT**. Software nunca es fallback automático para una instalación bound de producción.
- Una tabla singleton de la SQLite existente, no una base nueva, persiste `bindingState`, `keyId`, `publicKey` SPKI PEM, `algorithm`, `boundAt`, `homeId` y `edgeId`. Una instalación histórica sin fila es `unbound`. Solo el provisioning explícito puede insertar `bound`; no hay transición de `bound` a `unbound` ni sustitución de clave en v1. `.env` no decide el estado.
- El modelo de amenaza protege una copia de imágenes, configuración, datos y credencial Edge hacia otra MiniPC sin la clave TPM original. No protege frente a root que altere binarios o SQLite deliberadamente.

## Provisioning explícito

El operador inicia enrollment una sola vez mediante una operación administrativa local. HomePilot obtiene/genera la clave TPM, envía exactamente `{keyId,algorithm:"ES256",publicKey}` con la credencial Edge provisionada a `POST /directory/edge-device/enroll` y, solo tras HTTP 201 válido, registra `bound` junto a la identidad Home/Edge. `DEVICE_ALREADY_BOUND` y discrepancias se propagan como error seguro; no hay rebind automático. Ante respuesta remota exitosa y fallo de persistencia local, se requiere recuperación administrativa.

## Tokens y contrato Directory

`unbound` conserva el POST actual. `bound` obtiene challenge de `POST /directory/edge-device/challenge`, valida `challengeId`, nonce base64url de 32 bytes, scope y TTL 60; firma SHA-256 de seis líneas UTF-8 terminadas en LF: versión `homepilot.edge-device-proof.v1`, homeId, edgeId, challengeId, nonce y scope. La firma ES256 IEEE P1363 de 64 bytes se codifica base64url sin padding. Envía `{scope,deviceProof:{challengeId,keyId,signature}}` al endpoint existente; el token emitido conserva formato y TTL 120 s. Los consumidores solo solicitan un token por scope.

## Arranque, readiness y offline

En arranque, una fila `bound` exige firma de un nonce local aleatorio y verificación con la clave pública persistida, sin Directory. Fallo de proveedor, clave ausente o mismatch produce `DEVICE_IDENTITY_INVALID`: API disponible solo para `/health` de diagnóstico, operaciones normales y canal Cloud bloqueados, readiness `NOT READY`. Éxito produce `READY`, aun sin Internet; Dashboard y funciones locales permanecen operables. Una caída de Directory afecta únicamente nuevas funciones que necesiten service token.

## Seguridad

No se serializa ni registra clave privada, firma, nonce, credencial Edge o service token. El TPM mantiene la clave no exportable; HomePilot persiste solo handle/referencia TPM, clave pública y metadatos públicos. El contenedor de producción requiere Linux, TPM 2.0, acceso al dispositivo `/dev/tpmrm0` y `tpm2-tools` encapsulado en el provider. Sin TPM en producción bound no hay fallback a software/legacy. No se usan MAC, serial CPU ni machine-id como secreto.

## Criterios de aceptación

- [x] AC1: legacy conserva el intercambio actual sin challenge.
- [x] AC2: enrollment explícito liga la clave una vez y persiste `bound`; no hay rebinding.
- [x] AC3: bound solicita challenge, firma bytes canónicos exactos P1363 y obtiene token con ambos scopes actuales.
- [x] AC4: rechazo de proof/challenge o falta de TPM falla cerrado y sin filtrar secretos.
- [x] AC5: arranque local válido es READY offline; ausencia o clave equivocada es `DEVICE_IDENTITY_INVALID` y NOT READY.
- [x] AC6: una copia completa a otra MiniPC sin la clave TPM no puede operar normalmente ni obtener nuevos service tokens.
- [x] AC7: tests con provider simulado, tests Directory/client/startup y typecheck/build pasan sin TPM físico.
