# AudioInputPicker

**Fuente:** `apps/operator-console/src/components/AudioInputPicker.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Permite elegir el micrófono de captura para el asistente de voz cuando hay más de una fuente disponible.

## Contrato

Recibe lista `devices`, `selectedDeviceId`, etiqueta, disabled y `onChange`. Devuelve `null` si no hay selección útil.

## Uso

Usar solo en el flujo de voz. La enumeración de dispositivos la obtiene el consumidor desde el navegador, no el componente.

## Estados y aceptación

Cierra al hacer clic fuera o Escape, usa listbox accesible asociado al trigger, trunca etiquetas extensas y limita tanto trigger como menú al viewport.
