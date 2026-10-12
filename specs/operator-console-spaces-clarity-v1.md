# SPEC: Claridad de la pantalla Espacios V1

**Estado:** Aprobado
**Fecha:** 2026-10-12
**Dependencias:** `operator-console-v1.md`, `operator-console-estancia-viva-design-v1.md` (retira su escena de habitación), `operator-console-integrations-clarity-v1.md`

## Problema

Revisando Espacios con los datos reales de la oficina como lo haría una persona cliente:

- La ilustración de una sala (ventana, cuadro, sofá, planta, lámpara) ocupa la primera pantalla del detalle y es la misma en el Cuarto de Máquinas, con 22 puntos de PLC, que en el Patio, con tres cámaras. No informa y en la mayoría de los espacios es falsa.
- Todas las tarjetas de espacio llevan la misma bombilla y un «22 DISPOSITIVOS» casi ilegible.
- Sobra un título con el nombre del hogar y un lápiz para renombrarlo, una acción casi nunca usada, además de un campo «Añadir Estancia» siempre visible y de dos buscadores aunque haya cinco espacios.
- Al elegir un espacio, el detalle se abre debajo de toda la lista, sin señal de que algo pasó, sobre todo en móvil.
- Los comandos de un solo toque («ON/OFF TV», «Volumen+») aparecen mezclados con luces o bajo «Desconocido», y cada uno repite «Acción momentánea».
- El menú dice «Espacios» pero los botones dicen «Estancia».

## Alcance

Solo presentación en `apps/operator-console`: cabecera, tarjetas y detalle de Espacios, agrupación de dispositivos y textos. Los dispositivos, comandos, permisos y el modo de crear, renombrar y eliminar no cambian.

Fuera de alcance: elegir el tipo de espacio o una foto (requiere guardar datos nuevos y una spec propia), miniaturas de cámara en la tarjeta, el aspecto del instrumento binario de los sensores (compartido con los tableros) y cualquier cambio de API, stores globales, migraciones o persistencia.

## Requisitos

- **REQ-01:** El detalle de un espacio no dibuja ilustración. Su cabecera muestra un icono según lo que contiene, el nombre y un resumen en texto.
- **REQ-02:** El resumen nombra solo las categorías que el espacio tiene, con su total. «N encendidos» solo aparece si algún dispositivo informa encendido o apagado. Los dispositivos que no responden se nombran con un icono y texto («N sin respuesta») y nunca se cuentan como apagados. Un espacio sin dispositivos dice «Sin dispositivos».
- **REQ-03:** La tarjeta de un espacio muestra un icono según su contenido, el nombre y las tres primeras categorías. El icono es de PLC cuando la mitad o más de sus dispositivos son puntos de PLC; si no, el de la categoría con más dispositivos, sin que sensores, acciones u «otros» decidan salvo que sean lo único que hay. El icono se tiñe cuando algo está encendido.
- **REQ-04:** La cabecera del hogar es una línea discreta («Oficina · 5 espacios»). Renombrar el hogar está en el menú «Opciones del hogar», solo para quien puede gestionarlo. No hay título duplicado ni texto de ayuda.
- **REQ-05:** «Añadir espacio» es un botón que abre el formulario (nombre, «Crear» y cancelar). El formulario se cierra al crear el espacio y se mantiene abierto si falla.
- **REQ-06:** El buscador de espacios aparece solo cuando hay más de 6 espacios y el de dispositivos solo cuando el espacio tiene 8 o más.
- **REQ-07:** Al elegir un espacio, la vista se desplaza hasta su detalle, sin animación cuando la persona pide movimiento reducido.
- **REQ-08:** Los comandos momentáneos (`press`, `activate`) se agrupan en «Acciones», salvo cámaras, persianas y pantallas, y su ficha no repite «Acción momentánea».
- **REQ-09:** Eliminar el espacio es un botón con icono en la cabecera del detalle, que conserva la confirmación existente; renombrar sigue junto al nombre.
- **REQ-10:** Los textos de Espacios usan «espacio» y no «estancia» (y «space» en inglés), con mayúscula solo inicial.
- **REQ-11:** El resumen del detalle ocupa todo el ancho bajo la cabecera, no la columna del nombre, para que en móvil no se parta palabra por palabra.
- **REQ-12:** Una cámara que tarda en conectar muestra «Conectando cámara…» sobre el recuadro, en vez de un rectángulo oscuro sin explicación.

## Criterios de aceptación

- [x] **AC1:** `roomSummaryModel.test.ts` cubre las categorías, los totales, los encendidos, los que no responden, la sala técnica de PLC, el espacio vacío, la regla del icono y la agrupación de acciones, con casos tomados de la oficina.
- [x] **AC2:** `spacesPresentation.test.tsx` cubre la línea de resumen, la tarjeta, la cabecera del hogar (sin lápiz y con menú), el detalle sin ilustración, los umbrales de búsqueda, el grupo «Acciones» y el estado vacío.
- [x] **AC3:** Los e2e de Espacios usan el nuevo flujo: añadir espacio desde el botón, renombrar el hogar desde el menú, acciones agrupadas y búsqueda de dispositivos con ocho dispositivos.
- [x] **AC4:** Revisión visual con los datos reales de la oficina en escritorio y móvil, sin desbordes.
- [x] **AC5:** Las pruebas existentes de Espacios, cámaras y dispositivos siguen pasando, y la validación completa del repositorio.
- [x] **AC6:** Revisión como cliente sobre la consola de la oficina (escritorio y móvil): el resumen no se parte en móvil y una cámara lenta anuncia que está conectando.

## Estrategia de compatibilidad y reversión

Sin cambios de contrato, persistencia ni comandos. Revertir el código devuelve la presentación anterior. Se retiran `RoomScene`, `roomSceneModel` y los tokens `--scene-*`, que solo ellos usaban.

## Evidencia

- `views/topology/roomSummaryModel.ts`, `RoomSummaryLine.tsx`, `RoomIcon.tsx`, `TopologyRoomCard.tsx`, `TopologyRoomDetailPanel.tsx`, `TopologyHomeHeader.tsx`, `topologyDeviceControl.ts` y `views/TopologyView.tsx`.
- `locales/es/common.json` y `locales/en/common.json` (`topology.*`).
- Pruebas: `roomSummaryModel.test.ts`, `spacesPresentation.test.tsx`, `TopologyDeviceTile.test.tsx` y `tests/devices-spaces.spec.ts`.
