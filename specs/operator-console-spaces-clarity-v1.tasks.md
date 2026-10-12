# Tareas: Claridad de la pantalla Espacios V1

## Implementación

- [x] Modelo `roomSummaryModel` (categorías presentes, encendidos, sin respuesta, sala técnica de PLC, icono) y grupo «Acciones» en `topologyDeviceControl`.
- [x] `RoomSummaryLine` y `RoomIcon`; tarjeta de espacio y detalle con icono y resumen; se retiran la ilustración `RoomScene`, su modelo y los tokens `--scene-*`.
- [x] Cabecera del hogar discreta con menú «Opciones del hogar» y botón «Añadir espacio» que abre el formulario.
- [x] Buscadores condicionados (más de 6 espacios, 8 o más dispositivos) y desplazamiento al detalle.
- [x] Detalle con eliminar como botón de icono, sin «Acción momentánea» repetida y sin ayudas innecesarias.
- [x] Textos «espacio» en español e inglés; se retiran los textos sin uso.
- [x] Se retiran los ayudantes de presentación que ya nada usaba.

## Verificación

- [x] AC1: `roomSummaryModel.test.ts`.
- [x] AC2: `spacesPresentation.test.tsx` y `TopologyDeviceTile.test.tsx`.
- [x] AC3: `tests/devices-spaces.spec.ts` actualizado.
- [x] AC4: revisión visual con los datos de la oficina.
- [x] AC5: suite completa y `verify:quality`.
- [x] Resumen a todo el ancho bajo la cabecera del detalle y mensaje «Conectando cámara…» en la ficha de cámara lenta (AC6).
