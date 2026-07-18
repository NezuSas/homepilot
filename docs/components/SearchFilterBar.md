# SearchFilterBar

**Fuente:** `apps/operator-console/src/components/ui/SearchFilterBar.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Búsqueda local consistente sobre listas ya cargadas.

## Contrato

Recibe query, callback, placeholder y opciones de presentación. El filtrado de negocio y la carga remota permanecen en la vista.

## Uso

Usar para dispositivos, espacios, escenas o listas extensas. Placeholder y etiquetas deben venir de i18n.

## Estados y aceptación

Debe ser legible en móvil, mostrar foco visible y no borrar el contenido existente mientras se filtra.

