# IconPicker

**Fuente:** `apps/operator-console/src/views/dashboards/components/IconPicker.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Seleccionar iconos Lucide o Material Design Icons compatibles con tableros, secciones y vistas, con búsqueda directa por nombre.

## Contrato

Recibe valor, callback y textos opcionales. Carga el catálogo MDI una sola vez por sesión, normaliza nombres `mdi:`/Lucide y devuelve el identificador elegido sin conocer el dominio del tablero.

## Uso

Se usa desde configuraciones de vista, sección y pestaña. Su campo consume `Input` y su menú portal se alinea al trigger, se limita al viewport, declara lista accesible y se cierra con Escape.

## Estados y aceptación

La búsqueda filtra hasta 120 resultados, conserva selección, admite catálogo aún en carga y evita que el popup se recorte en móvil, tablet o escritorio.
