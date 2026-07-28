# DatabaseBackupsCard

**Fuente:** `apps/operator-console/src/components/DatabaseBackupsCard.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`  
**Spec de dominio:** `specs/edge-platform-foundations-v1.md`

## Propósito

Presenta el estado de las copias locales de la base de datos y permite que un administrador cree una nueva copia de forma explícita.

## Contrato

Recibe una lista de metadatos seguros (`filename`, `sizeBytes`, `createdAt`), los estados de carga y creación, y callbacks separados para actualizar o crear. No realiza solicitudes HTTP ni conoce rutas del filesystem.

## Uso

Usar únicamente en una superficie administrativa que ya haya autorizado el acceso a copias. El consumidor debe obtener los datos desde los endpoints protegidos y no entregar ni persistir paths internos.

## Estados y aceptación

Conserva las copias visibles durante una actualización, muestra un estado vacío localizado cuando no existen copias y comunica un error localizado sin eliminar datos previos. Durante la creación bloquea acciones duplicadas y expone `aria-busy` mediante el botón modular. En móvil, tablet y escritorio se ajusta al ancho disponible, truncando solamente el nombre de archivo con título accesible; fecha, tamaño y acciones permanecen legibles.
