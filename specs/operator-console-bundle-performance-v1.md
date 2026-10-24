# Spec: Operator Console Bundle Performance V1

**Estado:** Aprobado
**Seguimiento:** GitHub Issue #4

## Objetivo

Reducir el coste de JavaScript del selector de iconos del Operator Console sin alterar los contratos de dashboard, accesibilidad ni la edición de iconos existentes.

## Alcance

- Sustituir la carga dinámica del catálogo completo de @mdi/js por imports tipados de un subconjunto residencial de MDI.
- Mantener los iconos Lucide ya presentados por HomePilot.
- Resolver como MDI las convenciones guardadas mdi:* más comunes y dejar intacto el texto de valores no incluidos.
- Conservar el selector accesible: campo, listbox, navegación con teclado y cierre con Escape.

## Fuera de alcance

- Cambios a la persistencia de dashboards, sus APIs o contratos de dispositivos.
- Cambios visuales de la shell, flujos de edición o estados de dispositivos.
- Descargar iconos de red o exponer catálogos remotos.

## Criterios de aceptación

1. El build no emite el chunk completo de @mdi/js de aproximadamente 2.8 MB.
2. Los valores persistidos comunes mdi:* usados por HomePilot siguen renderizando un icono.
3. Un valor no incluido se conserva como texto y usa el fallback visual existente sin provocar una descarga ni un fallo.
4. El selector mantiene roles ARIA, foco, Escape, filtrado y mensajes de estado vacío.
5. Pasan lint, typecheck, build y regresión responsive.
6. Cada dependencia pesada tiene su propio chunk, y `hls.js` no se descarga en el primer pintado. Al compartir un chunk, el runtime de JSX quedaba junto a `hls.js`; como la entrada necesita ese runtime, el chunk entero pasaba a ser inmediato y se descargaban unos 325 kB de reproductor de video incluso en la pantalla de inicio de sesión, pese a que `useHlsPlayback` lo importa de forma diferida a propósito. Medido en `dist/index.html`: el chunk precargado baja de 382,7 kB a 57,8 kB y `vendor-hls` (324,4 kB) solo lo referencia `CameraDeviceTile`. Las reglas de troceado usan expresiones regulares que toleran las barras invertidas que Rollup emite en Windows.
7. Los formateadores `Intl` se construyen una vez por locale y formato, no por llamada ni por render: el reloj tiquea cada segundo y construía dos o tres `DateTimeFormat` por segundo de forma indefinida para valores que cambian a medianoche, y `formatMeasurement` creaba un `NumberFormat` en cada llamada, dos o tres por fila de la tarjeta Modbus y de nuevo en cada tecla de su buscador.
8. La fusión del snapshot de dispositivos indexa el estado anterior una vez en lugar de recorrerlo por dispositivo: era un `find` dentro de un `map` sobre el mismo arreglo, en cada evento en tiempo real y en cada vuelta de foco a la pestaña.

## Seguridad y reversión

- No se manipulan sesiones, secretos, red, datos de clientes ni datos de dashboards.
- La reversión es restaurar únicamente los módulos de selector y esta spec; no requiere migración ni recreación de contenedores.