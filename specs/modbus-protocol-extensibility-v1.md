# SPEC: Conexiones PLC preparadas para otros protocolos V1

**Estado:** Aprobado
**Fecha:** 2026-10-12
**Dependencias:** `modbus-tcp-local-integration-v1.md`, `operator-console-integrations-clarity-v1.md` (catálogo de integraciones)

## Problema

Hoy el único protocolo es Modbus TCP, pero el código lo da por hecho en varios sitios: el servicio recibe directamente el cliente TCP, los dispositivos se crean con el origen `modbus-tcp` escrito a mano, el enrutador de comandos registra solo esa clave y la pantalla se llama «Modbus TCP». Añadir otro protocolo (por ejemplo Modbus RTU mediante una pasarela serie) obligaría a buscar y cambiar todo eso a la vez.

## Alcance

Dejar el punto de extensión listo sin cambiar lo que hace el sistema hoy:

- Cada conexión guarda el protocolo que habla.
- El servicio obtiene el transporte de un registro por protocolo, en lugar de recibir uno fijo.
- El origen, el fabricante y el registro de comandos de los dispositivos salen del protocolo de su conexión y del catálogo de integraciones.
- La pantalla se llama «Controladores PLC» y cada conexión muestra su protocolo.

Fuera de alcance: un segundo protocolo real; un modelo de direcciones distinto del de registros (nodos OPC UA, temas MQTT, bloques S7), que exige ampliar antes el modelo de variables; renombrar las tablas `modbus_*`, las rutas `/api/v1/modbus/*`, `externalId` (`modbus:<id>`) ni la ruta `/system/modbus`; un selector de protocolo en el formulario, que solo tiene sentido cuando haya más de uno; migraciones.

## Requisitos

- **REQ-01:** `PLC_PROTOCOLS` lista los protocolos que el sistema sabe hablar (hoy `modbus-tcp`). Cada uno tiene una entrada de tipo PLC en el catálogo de integraciones.
- **REQ-02:** Una conexión puede indicar `protocol`. Si falta o es nulo es `modbus-tcp`, como toda conexión guardada antes; un valor desconocido se rechaza con `INVALID_CONFIG`. Al guardar, el protocolo se almacena junto a la configuración, sin migración (la configuración ya es un JSON).
- **REQ-03:** El servicio obtiene el transporte de un `PlcTransportRegistry` según el protocolo de cada conexión. Pedir un protocolo sin transporte registrado es un error de configuración, nunca un respaldo silencioso.
- **REQ-04:** Un dispositivo nuevo de una variable toma como `integrationSource` el protocolo de su conexión y como fabricante su nombre del catálogo; `supports` y las comprobaciones de enlace usan el catálogo y la conexión en vez del identificador escrito a mano. El enrutador de comandos registra el servicio para cada protocolo de `PLC_PROTOCOLS`.
- **REQ-05:** El comportamiento actual no cambia: las lecturas, la sondeo, los comandos, los permisos, la API y los datos guardados son los mismos para Modbus TCP.
- **REQ-06:** La pantalla se titula «Controladores PLC» (y «PLC controllers») y la tarjeta de cada conexión muestra el protocolo y el modelo en una línea y la dirección en la siguiente, para que ninguna se parta a medias.

## Criterios de aceptación

- [x] **AC1:** `ModbusProtocol.test.ts` cubre el valor por defecto, el protocolo conocido, los valores rechazados, la coherencia con el catálogo, el registro con y sin transporte, una conexión guardada antes del cambio, el almacenamiento del protocolo, el origen y el fabricante del dispositivo creado y que el servicio pide el transporte por protocolo.
- [x] **AC2:** Las pruebas existentes de servicio, cliente, perfiles, conversión y rutas siguen pasando sin cambiar su comportamiento esperado.
- [x] **AC3:** `ModbusConnectionCard.test.tsx` cubre el protocolo en la tarjeta y los e2e de Modbus usan el título nuevo.
- [x] **AC4:** La validación completa del repositorio pasa.

## Estrategia de compatibilidad y reversión

Sin migraciones ni cambios de contrato: `protocol` es opcional en la entrada y las conexiones antiguas lo reciben al leerse. Revertir el código deja la configuración guardada válida (el campo extra se ignora al leer con el código anterior).

## Para cuando llegue otro protocolo

Un transporte nuevo que cumpla `ModbusTransport`, su identificador en `PLC_PROTOCOLS`, una entrada en el catálogo, su registro en `buildModbusModule` y un selector de protocolo en el formulario de conexión. Si el protocolo no usa direcciones de registro, antes hay que ampliar el modelo de variable.

## Evidencia

- `packages/integrations/modbus/domain/PlcProtocol.ts`, `Modbus.ts`, `application/ModbusPorts.ts` y `ModbusService.ts`, `infrastructure/DefaultPlcTransportRegistry.ts`.
- `infrastructure/assemblers/buildModbusModule.ts` y `buildCommandRouter.ts`.
- `components/ModbusConnectionCard.tsx` y `locales/*/common.json` (`modbus.title`).
- Pruebas: `__tests__/ModbusProtocol.test.ts`, `modbusFixture.ts`, `ModbusConnectionCard.test.tsx` y `tests/modbus-plc.spec.ts`.
