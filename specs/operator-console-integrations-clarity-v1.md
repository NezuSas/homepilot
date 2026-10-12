# SPEC: Claridad en las pantallas de integraciones V1

**Estado:** Implementado
**Fecha:** 2026-10-12
**Dependencias:** `native-camera-local-integration-v1.md`, `modbus-tcp-local-integration-v1.md`, `operator-console-v1.md`

## Problema

Una revisión de las pantallas de integraciones (Home Assistant, Modbus, Descubrimiento, Cámaras, Diagnósticos) con ojos de cliente, sobre los datos reales de una instalación de oficina, encontró cinco defectos que hacen el sistema menos claro y menos de fiar:

- La tarjeta de una cámara ONVIF mostraba su ruta con el usuario y la contraseña dentro, justo bajo un aviso que dice que las credenciales no se exponen en el navegador.
- La dirección de Home Assistant se veía en MAYÚSCULAS, porque la fuente técnica solo tiene mayúsculas, aunque una URL distingue mayúsculas de minúsculas.
- Un PLC que no responde aparecía como «22 variables con error» en rojo, sin explicar la causa ni qué revisar.
- Con muchos dispositivos nuevos había que asignar habitación uno por uno, con una lista de nombres como «Interruptor Sonoff (0FE8D5)».
- Varios textos usaban jerga («SLA», «Delta de Estado», «Sondas de Subsistema Core», «Payload»), anglicismos («Testear Conexión») y mayúsculas de título que el resto de la consola no usa.

## Alcance

- Ocultar en la API las credenciales de las rutas RTSP (criterio 19 de `native-camera-local-integration-v1.md`).
- Mostrar direcciones y tokens con una fuente monoespaciada legible.
- Explicar el estado de una conexión Modbus que no responde.
- Asignar de una vez una habitación a todos los dispositivos pendientes disponibles.
- Unificar la redacción de las pantallas de integraciones y diagnóstico.

Fuera de alcance: cambiar la fuente técnica `Disket Mono` para el resto de metadatos, el menú lateral, la lógica de diagnóstico y los datos de Modbus.

## Requisitos

- **REQ-01:** Las credenciales dentro de la ruta RTSP de una cámara nunca llegan al navegador (ver criterio 19 de `native-camera-local-integration-v1.md`).
- **REQ-02:** Los campos de dirección y token de Home Assistant usan la fuente `font-data` (monoespaciada de sistema) y muestran las minúsculas. `Disket Mono` se conserva para el resto de metadatos técnicos.
- **REQ-03:** La tarjeta de una conexión Modbus muestra su estado como una etiqueta de color (verde conectada, ámbar reconectando, roja sin conexión, gris deshabilitada). Si está habilitada y no responde, una frase indica la causa traducida cuando se conoce, o «No se puede contactar con el PLC en {dirección}. Revisa que esté encendido y conectado a la misma red.», más la última lectura correcta o que aún no se leyó nada. Mientras no responde no se muestra «Variables con error», sino «Sin lectura mientras el PLC no responda». Con el PLC conectado, los conteos no cambian. Nunca se muestra el texto crudo del transporte.
- **REQ-04:** Descubrimiento nombra la acción de cada tarjeta «Asignar» y su selector «Elegir habitación». Cuando hay más de un dispositivo pendiente, una barra permite elegir una habitación y asignarla a todos los disponibles de la lista visible. Los dispositivos no disponibles se omiten sin contarse como fallos, un fallo no detiene a los demás, se envían de uno en uno y el resultado (asignados, omitidos, fallidos) queda visible aunque la lista se vacíe, hasta que el usuario lo cierre.
- **REQ-05:** La redacción en español de Home Assistant, Diagnósticos, Descubrimiento y Cámaras usa mayúscula solo al inicio de frase, evita anglicismos y jerga («SLA», «Delta», «Sondas», «Payload», «Testear») y explica los estados con frases corrientes. Las claves de traducción no cambian.
- **REQ-06:** La tarjeta de una cámara guardada es una fila compacta con lo que la persona necesita para reconocerla: nombre, dirección y tipo en una línea, y las acciones editar y eliminar. El estado solo aparece cuando la cámara está inactiva (una etiqueta «Inactiva»); «Activa» se da por supuesto. El puerto y la ruta RTSP no se repiten en cada tarjeta: se consultan al editar. El tipo de cámara puede ocupar una segunda línea en vez de cortarse. La cuadrícula acomoda más cámaras por fila.
- **REQ-07:** El origen de un dispositivo se muestra con el nombre de su integración (Home Assistant, Sonoff, Cámara IP, Modbus TCP, Android) y un icono neutro por tipo (puente, red local, cámara, PLC, pantalla), en la ficha del dispositivo y en las tarjetas de Descubrimiento. Nunca se usan logotipos de terceros. Un origen desconocido se muestra con su identificador, sin ocultarlo. El nombre, el tipo y la pregunta «¿es un punto de PLC?» salen de un único catálogo (`integrationCatalog.ts`); el código genérico pregunta al catálogo en vez de comparar identificadores, de modo que un protocolo nuevo es una entrada más.
- **REQ-08:** Un valor binario apagado, como una entrada de PLC en reposo, se muestra en neutro y solo el encendido destaca en verde; el rojo se reserva para fallos. El instrumento sigue sin ser interactivo.

## Criterios de aceptación

- [x] **AC1:** `StreamPathSecrets.test.ts`, `NativeCameraService.test.ts` y `NativeCameraRoutes.test.ts` cubren el enmascarado, la restauración al editar y que la respuesta de la API no contiene el secreto.
- [x] **AC2:** `HomeAssistantSettingsView` usa `font-data` en la dirección y la hoja de estilos define `--font-data` sin la fuente técnica.
- [x] **AC3:** `ModbusConnectionCard.test.tsx` cubre los cuatro estados de la etiqueta, la frase de causa, la ausencia de «Variables con error» sin conexión y que los conteos se conservan con el PLC conectado.
- [x] **AC4:** `bulkAssign.test.ts` y `BulkAssignBar.test.tsx` cubren la asignación en orden, las omisiones, los fallos aislados y el resumen.
- [x] **AC5:** En la consola real, la asignación en bloque asigna solo los dispositivos disponibles, omite los no disponibles y deja el resultado visible, y las pruebas existentes de Descubrimiento siguen pasando.
- [x] **AC6:** La validación de traducciones pasa y las pruebas de la consola usan los textos nuevos.
- [x] **AC7:** `CompactSystemPresentation.test.tsx` cubre que la tarjeta nombra sus acciones, muestra nombre y dirección, no repite puerto ni ruta, oculta «Activa» y muestra «Inactiva» cuando corresponde.
- [x] **AC8:** `integrationCatalog.test.ts` y `IntegrationBadge.test.tsx` cubren los nombres, los tipos, los alias, el origen desconocido, que no se dibuja ninguna imagen y que solo el tipo PLC responde afirmativamente; las pruebas de capacidades, comandos y tiempo real de Modbus siguen pasando con el predicado neutral.
- [x] **AC9:** `SensorMetricCard.test.tsx` cubre que un binario apagado no usa el color de peligro y que el encendido sigue en verde.

## Estrategia de compatibilidad y reversión

Sin migraciones ni cambios de contrato: la API solo deja de devolver valores secretos dentro de `rtspPath` y la edición restaura el secreto guardado cuando recibe la máscara. Revertir el código vuelve a mostrar los textos y la fuente anteriores, y los datos guardados no cambian.

## Evidencia

- `packages/integrations/native-camera/application/streamPathSecrets.ts`, `NativeCameraService.ts` y `apps/api/routes/NativeCameraRoutes.ts`.
- `components/ModbusConnectionCard.tsx` y `lib/plcUi.ts` (`plcConnectionTone`).
- `components/BulkAssignBar.tsx`, `lib/bulkAssign.ts`, `components/InboxDeviceTile.tsx` y `views/InboxView.tsx`.
- `packages/devices/domain/integrationCatalog.ts`, `components/IntegrationBadge.tsx`, `DeviceInspectorInfoSections.tsx` e `InboxDeviceTile.tsx`.
- `components/NativeCameraSettingsCard.tsx` y `views/NativeCamerasView.tsx` (tarjeta compacta).
- `locales/es/common.json` y `locales/en/common.json`, `index.css` (`--font-data`) y `tailwind.config.js`.
