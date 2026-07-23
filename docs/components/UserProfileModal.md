# UserProfileModal

**Fuente:** `apps/operator-console/src/components/UserProfileModal.tsx`  
**Spec de familia:** `specs/operator-console-modular-components-v1.md`

## Propósito

Permitir que una persona actualice su nombre visible y avatar local sin duplicar la infraestructura visual o accesible de los diálogos de la consola.

## Contrato

Recibe el usuario autenticado, `onClose` y `onSaved`. Usa `Modal` para portal, foco, Escape, ciclo de Tab, scroll y pie responsive. El componente administra de forma local la carga, recorte, zoom y persistencia del avatar.

## Uso

Se abre desde el perfil de sesión. No crea stores globales ni modifica permisos. Los textos visibles y etiquetas accesibles proceden de i18n ES/EN.

## Estados y aceptación

Conserva el perfil cargado mientras se edita, presenta carga localizada y bloquea cierre o doble guardado durante persistencia. El recorte mantiene control táctil, zoom accesible y acciones visibles dentro del viewport.
