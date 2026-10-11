# SPEC: Arrastrar y soltar de Tableros: accesibilidad y descubrimiento V1

**Estado:** Implementado
**Fecha:** 2026-10-11

## Problema

Una revisión del arrastrar y soltar de Tableros (ratón, táctil, teclado, cancelación, autoscroll, modo vista) confirmó que el comportamiento funcional es correcto y persistente. Quedaban brechas de accesibilidad y de descubrimiento:

- Las instrucciones de teclado salían en inglés dentro de una consola en español.
- Los anuncios exponían identificadores internos (`section-slot-1`) y soltar anunciaba solo "LISTO".
- Nada indicaba que una sección se puede mover: sin asa visible, y en móvil sin pista de la pulsación larga.
- Al soltar una tarjeta sobre otra de otra sección, la vista previa mostraba un lugar y el resultado quedaba en otro.
- Los elementos arrastrables se describían como "sortable".

## Alcance

- Instrucciones y anuncios localizados que nombran lo movido y el destino.
- Asa visible en las secciones durante la edición.
- Aviso de una sola vez para pantallas táctiles y una pulsación más corta para levantar.
- Coherencia entre la vista previa y el resultado al soltar una tarjeta sobre otra.
- Sin cambios de persistencia, permisos ni geometría.

## Requisitos

- **REQ-01:** Las instrucciones para lectores de pantalla se muestran en el idioma de la interfaz.
- **REQ-02:** Cada anuncio nombra el elemento movido (título de sección o de tarjeta, con respaldo legible) y el destino como posición numerada, tarjeta dentro de su sección o sección; nunca un identificador interno.
- **REQ-03:** Soltar fuera de un destino se anuncia como movimiento cancelado.
- **REQ-04:** Los elementos movibles se describen como "elemento movible" en el idioma de la interfaz.
- **REQ-05:** En modo edición cada sección muestra un asa de agarre en su barra flotante, sin ocupar espacio del flujo ni existir en modo vista. Arrastrar desde el asa mueve la sección.
- **REQ-06:** En pantallas táctiles se muestra una sola vez un aviso temporal que explica cómo mover un elemento; se oculta solo, al arrastrar y no se repite. La pulsación para levantar dura 300 ms y el dispositivo vibra brevemente si lo permite.
- **REQ-07:** Una tarjeta soltada sobre otra queda en el orden mostrado durante el arrastre, salvo en secciones con tarjetas fijadas a posiciones de la cuadrícula, donde decide la posición del puntero.

## Criterios de aceptación

- [x] **AC1:** `dragAnnouncements.test.ts` cubre nombres, respaldos legibles, destinos y los cuatro eventos, y ningún anuncio contiene `section-slot`.
- [x] **AC2:** Las claves `common.reorder_*` existen en español e inglés y la validación de i18n pasa.
- [x] **AC3:** En la consola real, el asa existe solo en modo edición y arrastrar desde ella cambia el orden guardado.
- [x] **AC4:** En la consola real, el orden de una tarjeta soltada sobre otra de otra sección coincide con el de la vista previa.
- [x] **AC5:** En la consola real, el aviso táctil aparece una vez, desaparece solo y no reaparece.
- [x] **AC6:** `sectionHasPinnedCards` distingue secciones con tarjetas fijadas de las que fluyen.
- [x] **AC7:** Las pruebas de edición de Tableros y la suite responsive siguen pasando.

## Evidencia

- `canvas/dragAnnouncements.ts` y `DashboardCanvas.tsx` conectan anuncios, instrucciones y aviso táctil.
- `canvas/TouchDragHint.tsx` implementa el aviso de una sola vez.
- `DashboardWidgetControls.tsx` agrega el asa y `canvas/useCanvasSensors.ts` fija los 300 ms.
- `canvas/useCanvasDragHandlers.ts` y `sectionCardDrag.ts` conservan el orden previsualizado.
