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
- **REQ-08:** El arrastre se siente físico y claro, con el naranja de marca como único acento y sin cambiar el comportamiento. (a) Al levantar, la copia flotante sube 4 px con más sombra y un halo naranja suave, en 150 ms con la curva `--ease-spring`; conserva exactamente el tamaño del original, porque la animación de soltar la lleva hasta el hueco y un tamaño distinto produciría un salto. (b) El lugar de origen queda como un hueco: borde punteado naranja tenue, fondo teñido y contenido atenuado, en lugar de un recuadro sólido. (c) El destino válido bajo el puntero se resalta con borde naranja y un halo que respira lentamente. (d) Al soltar, el elemento que cae hace un breve pulso de asentamiento de 420 ms en su nuevo lugar. (e) Con `prefers-reduced-motion: reduce` no hay animaciones: solo los cambios de borde, fondo y opacidad, que siguen indicando origen y destino. (f) Ningún efecto cambia el tamaño del diseño ni el de otros elementos, y las pruebas existentes de arrastre siguen pasando.
- **REQ-09:** En una sección con tarjetas fijadas a posiciones de la cuadrícula, soltar una tarjeta sobre una zona ocupada la deja exactamente en esa celda y **las tarjetas que ocupaban esa zona se corren hacia abajo**, en cascada y sin solaparse, en lugar de mandar la tarjeta arrastrada a la primera fila libre. Mientras se arrastra, esa disposición se previsualiza en vivo (las demás tarjetas se deslizan con la animación de disposición existente) y al soltar se guarda exactamente lo previsualizado. Mover el puntero a otra celda recalcula la previsualización desde la disposición original, de modo que volver a la celda de origen devuelve las demás tarjetas a su lugar. Esto aplica también al mover entre secciones. Las secciones cuyas tarjetas fluyen en orden conservan su comportamiento.

## Criterios de aceptación

- [x] **AC1:** `dragAnnouncements.test.ts` cubre nombres, respaldos legibles, destinos y los cuatro eventos, y ningún anuncio contiene `section-slot`.
- [x] **AC2:** Las claves `common.reorder_*` existen en español e inglés y la validación de i18n pasa.
- [x] **AC3:** En la consola real, el asa existe solo en modo edición y arrastrar desde ella cambia el orden guardado.
- [x] **AC4:** En la consola real, el orden de una tarjeta soltada sobre otra de otra sección coincide con el de la vista previa.
- [x] **AC5:** En la consola real, el aviso táctil aparece una vez, desaparece solo y no reaparece.
- [x] **AC6:** `sectionHasPinnedCards` distingue secciones con tarjetas fijadas de las que fluyen.
- [x] **AC7:** Las pruebas de edición de Tableros y la suite responsive siguen pasando.
- [x] **AC8:** `useJustDropped` marca un elemento durante 420 ms cuando termina de arrastrarse y no antes; con reducción de movimiento el marcador existe pero no anima.
- [x] **AC10:** Las pruebas de `placeSectionCard` confirman que la tarjeta soltada conserva su celda, que las ocupantes se corren hacia abajo en cascada sin solaparse y que el resto del tablero no cambia.
- [x] **AC11:** En la consola real, en una sección con tarjetas fijadas, arrastrar una tarjeta sobre otra la deja en esa celda, la ocupante baja mientras se arrastra y lo guardado al soltar coincide con lo previsualizado.
- [x] **AC9:** En la consola real, la copia flotante tiene la transformación de levantado, el origen muestra borde punteado y, tras soltar, el elemento lleva el marcador de asentamiento que desaparece solo.

## Evidencia

- `canvas/dragAnnouncements.ts` y `DashboardCanvas.tsx` conectan anuncios, instrucciones y aviso táctil.
- `canvas/TouchDragHint.tsx` implementa el aviso de una sola vez.
- `sectionCardDrag.ts` (`placeSectionCard`), `canvas/useCanvasDragHandlers.ts` (`handleDragMove`) y `canvas/canvasDom.ts` (`measureDropCell`) implementan REQ-09; `dashboard-editing.spec.ts` y `sectionCardDrag.test.ts` lo cubren.
- `canvas/useJustDropped.ts`, los estados `data-dashboard-*` de `index.css` y `SortableCanvasWidget.tsx`/`SectionCardItem.tsx` implementan REQ-08; la prueba `dashboard-editing.spec.ts` comprueba el levantado, el hueco punteado y el pulso al soltar.
- `DashboardWidgetControls.tsx` agrega el asa y `canvas/useCanvasSensors.ts` fija los 300 ms.
- `canvas/useCanvasDragHandlers.ts` y `sectionCardDrag.ts` conservan el orden previsualizado.
