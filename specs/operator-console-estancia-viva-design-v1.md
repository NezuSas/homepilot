# SPEC: Operator Console Estancia Viva Design V1

**Status:** Draft
**Author:** Claude (agente de UI/UX)
**Date:** 2026-10-10
**Scope:** Capa visual de `apps/operator-console`: superficies mate con estado «iluminado», icono circular de marca y una escena de habitación que refleja el estado real. Sin funcionalidades nuevas.

## Problem Statement

Las tarjetas de dispositivo se perciben rígidas y poco distinguibles entre encendido y apagado, y la vista de Espacios no comunica el estado real de la estancia. Una primera exploración con vidrio translúcido fue descartada: el contenido competía con el fondo. El estudio de competidores (Apple Home, Control4 X4, Savant, Crestron, Home Assistant) indica que lo premium proviene del contraste decisivo entre encendido y apagado, la tipografía, el espacio y la estancia como protagonista, no del desenfoque.

## Scope

- **Tipografía:** Inter como primera familia de `--font-sans` (archivo variable OFL incluido en `src/assets/fonts/`), con la pila del sistema como respaldo (Rubik se retiró; ver operator-console-modularization-v1). Disket Mono no cambia.
- **Tokens de superficie «iluminada»:** `--tile-lit`, `--tile-lit-ink`, `--tile-lit-ink-muted`, `--tile-chip`, `--tile-chip-ink` en oscuro y claro. El naranja de marca (`--primary`) y `--light-active` no cambian.
- **Estado encendido** de las tarjetas ya existentes (`homepilot-section-light-tile-active`, `device-state-on` y `device-toggle-control`): superficie mate iluminada (arena en oscuro, grafito en claro), texto con contraste ≥ 4,5:1 e icono sobre disco naranja. Solo CSS, sin cambiar nombres de clase, DOM, tamaños ni radios.
- **Escena de habitación (`RoomScene`):** ilustración decorativa en el detalle de Espacios (`TopologyRoomDetailPanel`) que refleja datos que ya existen: si hay luces encendidas (`getRoomDeviceState`) y la posición de la persiana (`current_position`/`position`, respetando `invertState`). Oscuro = noche, claro = día.
- Documentación del componente y de la spec en `docs/components/` y matriz de cobertura.

## Out of Scope

- Funcionalidades inexistentes: estado de seguridad o alarma, indicador de cámaras en línea, etiquetas «Casa protegida».
- Imágenes por habitación (exigirían un campo y persistencia nuevos): la escena es una ilustración genérica no persistida.
- Cambios de navegación (riel lateral en tablet), de API, stores globales, migraciones o formato de persistencia.
- Restilado de `SensorMetricCard` (geometría fijada por pruebas), `CurtainDeviceTile` y `CameraDeviceTile`.
- Estados nuevos de dispositivos: se respetan los existentes (pendiente ≠ confirmado, desconocido ≠ cerrado, sin lectura ≠ cero).

## Functional Requirements

- **REQ-01:** `--font-sans` lista «Inter» antes que la pila del sistema.
- **REQ-02:** Los tokens `--tile-*` existen en `:root` (oscuro) y `.light`.
- **REQ-03:** Una tarjeta encendida en los ámbitos `.homepilot-room-devices`, `.homepilot-home-routines` y `.homepilot-dashboard-screen` usa la superficie iluminada con texto legible y el icono sobre disco naranja, en ambos temas.
- **REQ-04:** `DeviceWidget` encendido usa la misma superficie iluminada; apagado conserva la superficie de tarjeta.
- **REQ-05:** `RoomScene` es decorativa (`aria-hidden`), no recibe foco, no añade texto visible ni contenido accesible nuevo y se adapta al ancho del panel sin desbordar.
- **REQ-06:** `RoomScene` muestra la lámpara encendida si al menos una luz de la habitación está encendida y apagada en caso contrario; con estado desconocido de todas las luces se muestra apagada.
- **REQ-07:** `RoomScene` muestra las cortinas según la posición de la persiana conocida; si no hay persiana o su posición es desconocida, no dibuja cortinas (no asume cerrada).

## Non-Functional Requirements

- **NFR-01:** Contraste de texto ≥ 4,5:1 en tarjetas iluminadas, oscuro y claro.
- **NFR-02:** Sin cambios en tamaños, radios, alturas ni paddings fijados por pruebas (sensor 16 px, controles de luz ≤ 176×112).
- **NFR-03:** `prefers-reduced-motion`: la escena no tiene animaciones.
- **NFR-04:** Sin cambios en contratos de API, stores ni persistencia.

## Acceptance Criteria

- **AC1:** `--font-sans` empieza por Inter y el archivo OFL está en el repositorio.
- **AC2:** Los tokens `--tile-*` existen en oscuro y claro.
- **AC3:** Las tarjetas de luz encendidas en el detalle de habitación mantienen `aria-pressed`, tamaños y nombres accesibles, y su texto y su icono cumplen el contraste de NFR-01 (comprobado en navegador).
- **AC4:** El modelo de escena devuelve `lightsOn` según luces encendidas y `curtainOpen` según la posición de persiana, e ignora estados desconocidos.
- **AC5:** El detalle de habitación contiene la escena decorativa sin `role`, sin foco y sin desbordamiento horizontal a 320, 768 y 1440 px.
- **AC6:** Las pruebas existentes de Jest y las responsive de habitación, tarjeta unificada y sensor siguen pasando.
- **AC7:** `check:spec-coverage`, `check:bdd-traceability`, `check:module-test-coverage`, `check:ui-primitives`, lint, typecheck y ambos builds pasan.
- **AC8:** La aprobación visual es una decisión humana previa a ampliar el alcance.

## Technical Notes

```typescript
interface RoomSceneState { lightsOn: boolean; curtainOpen: number | null; lightCount: number; }
function buildRoomSceneState(devices: SnapshotDevice[]): RoomSceneState;
```

- La escena se dibuja con SVG inline y variables CSS (`--scene-*`) definidas junto a los demás tokens, de modo que el tema claro/oscuro cambia sin lógica en JS.
- Las reglas de las tarjetas iluminadas viven en `@layer utilities` para vencer a las cascadas existentes sin aumentar especificidad ni tocar clases.
- Los diseños de referencia están en el lienzo de Claude Design y en las páginas A y B de Figma; el resultado implementado se documenta en el libro de diseño (`docs/design-book.md`).

## Open Questions

- Fotografías propias por estancia: requeriría una spec de persistencia aparte.
- Riel lateral en tablet, estado de seguridad y conteo de cámaras: requieren su propia spec y backend; no se implementan aquí.
