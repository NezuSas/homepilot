# SectionHeader

**Fuente:** `apps/operator-console/src/components/ui/SectionHeader.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Encabezado uniforme para separar una sección y sus acciones contextuales.

## Contrato

Recibe título, descripción opcional, icono y acciones. La vista resuelve permisos y contenido.

## Uso

Usar en páginas y paneles que necesiten jerarquía; no duplicar títulos visuales dentro de la misma superficie.

## Estados y aceptación

Soporta texto largo, acciones envolventes y layout vertical en móvil. El bloque de contenido conserva el ancho disponible y cada acción directa ocupa el ancho completo en móvil; desde tablet recupera su ancho natural, se envuelve sin recortes y queda alineada al final del encabezado. Los subtítulos de grupo solo aplican sangría cuando existe icono.
