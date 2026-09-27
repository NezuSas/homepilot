# HomePilot IntentFlow Manifest Sync V1

**Estado:** Implementado

## Alcance

HomePilot obtiene un Edge Service Token efímero de Directory usando la credencial Edge ya provisionada, descarga por HTTPS un bundle de manifests de IntentFlow, valida íntegramente su contrato y sustituye de forma atómica el snapshot SQLite. El primer bundle autenticado fija `installationId`; los siguientes deben coincidir. Ningún token efímero se persiste.

El sincronizador arranca inmediatamente y repite cada 60 segundos sin solapamiento. Un fallo conserva el último snapshot. El provider calcula acciones mediante `resolveEffectiveActions` únicamente con caché FRESH (hasta cinco minutos) u OFFLINE_GRACE (hasta 24 horas); después devuelve `[]`. Un bundle válido vacío revoca todas las acciones cacheadas.

`HOMEPILOT_INTENTFLOW_BASE_URL` ausente deshabilita esta integración sin impedir el arranque. No se añaden endpoints, UI ni ejecución remota de comandos.

## Criterios de aceptación

- [x] Directory se deriva exclusivamente de WSS provisionado y recibe la credencial Edge solo en Authorization.
- [x] El token de servicio se conserva únicamente en memoria y se solicita en cada sincronización.
- [x] IntentFlow se consulta por HTTPS con timeout de 10 segundos y sin retries internos.
- [x] El bundle exige raíz exacta, identidades coincidentes y unicidad de Board y Device; un error invalida el conjunto.
- [x] SQLite fija la instalación en el primer sync válido y reemplaza estado y manifests en una transacción.
- [x] Un fallo no altera caché, pin ni last_success_at; un bundle vacío válido borra los manifests.
- [x] Las lecturas revalidan el manifest antes de entregarlo al resolver local.
- [x] El servicio arranca sin solapamiento y se detiene limpiando el timer.
- [x] Sin URL configurada, HomePilot conserva el comportamiento local existente.

Las pruebas se escriben, pero no se ejecutan en esta tarea por instrucción expresa. Las casillas documentan implementación, no validación E2E.
