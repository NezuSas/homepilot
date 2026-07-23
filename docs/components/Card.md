# Card

**Fuente:** `apps/operator-console/src/components/ui/Card.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Superficie visual reusable para agrupar contenido semántico sin acoplarlo al dominio.

## Contrato

Recibe children y atributos de contenedor junto a variantes de superficie. No obtiene ni transforma datos.

## Uso

Usar como contenedor de secciones o elementos compactos; tarjetas de dispositivo, cámara o media mantienen además su componente especializado.

## Estados y aceptación

Mantiene contraste y bordes tokenizados en tema claro/oscuro y no introduce scroll horizontal. Cabecera, contenido y pie reducen su padding en móvil; títulos, descripciones y acciones largas se adaptan al ancho disponible sin recortar contenido.
