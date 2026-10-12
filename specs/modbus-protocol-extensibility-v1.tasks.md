# Tareas: Conexiones PLC preparadas para otros protocolos V1

## Implementación

- [x] `PlcProtocol.ts` (`PLC_PROTOCOLS`, valor por defecto y guarda de tipo) y `protocol` opcional en la conexión, con validación.
- [x] Puerto `PlcTransportRegistry` y `DefaultPlcTransportRegistry`; el servicio obtiene el transporte por protocolo de cada conexión.
- [x] Origen y fabricante del dispositivo desde la conexión y el catálogo; `supports` por catálogo; el enrutador de comandos registra cada protocolo.
- [x] Título «Controladores PLC» y protocolo en la tarjeta de conexión.
- [x] Fixture de pruebas movido a `modbusFixture.ts` para compartirlo sin volver a ejecutar otra suite.

## Verificación

- [x] AC1: `ModbusProtocol.test.ts`.
- [x] AC2: las suites existentes de Modbus y API sin cambios de comportamiento.
- [x] AC3: `ModbusConnectionCard.test.tsx` y `tests/modbus-plc.spec.ts`.
- [x] AC4: suite completa y `verify:quality`.
