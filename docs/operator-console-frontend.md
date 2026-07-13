# Operator Console Frontend

## Estado Actual

La Operator Console vive en `apps/operator-console` y usa React, Vite y TypeScript estricto. La UI fue refactorizada para que las vistas principales funcionen como orquestadores y no como contenedores monolíticos de JSX.

El objetivo actual es mantener la UI 100% modular en su capa visual:

- Las vistas coordinan estado, efectos, llamadas API y navegación.
- Los componentes renderizan secciones visuales concretas.
- Los componentes base viven en `components/ui`.
- La lógica de negocio no debe moverse a componentes visuales.
- Los tokens y primitives del design system se documentan en `docs/design-system.md`.

## Estructura

```text
apps/operator-console/src/
  App.tsx
  views/
    DashboardView.tsx
    InboxView.tsx
    AutomationsView.tsx
    AutomationBuilderModal.tsx
    DashboardsView.tsx
    DiagnosticsView.tsx
    HomeConversationView.tsx
    UsersView.tsx
  components/
    DashboardScenesSection.tsx
    DashboardAutomationsSection.tsx
    DashboardInsightsSection.tsx
    HomeClimateSummary.tsx
    ManagedDeviceTile.tsx
    InboxDeviceTile.tsx
  lib/
    devicePresentation.ts
    AutomationRuleCard.tsx
    AutomationBuilderTriggerSection.tsx
    DiagnosticsTimeline.tsx
    UsersTable.tsx
  components/ui/
    AlertBanner.tsx
    Button.tsx
    Input.tsx
    IconButton.tsx
    EmptyState.tsx
    SegmentedControl.tsx
    SelectField.tsx
    SidebarItem.tsx
```

## Reglas de Modularidad

1. Una vista debe tener una responsabilidad primaria: orquestar.
2. Si un bloque JSX representa una sección visual estable, debe extraerse a `components`.
3. Si un bloque aparece más de una vez, debe extraerse.
4. Si un bloque necesita props complejas, definir interfaces explícitas cerca del componente.
5. No usar `any` para tapar diferencias entre store, API y UI.
6. Si store y UI usan tipos distintos, mapear localmente.
7. No crear stores globales nuevos sin autorización explícita.
8. `devicePresentation.ts` resuelve la categoría por capabilities/semantic type y `ManagedDeviceTile` selecciona la tarjeta visual correspondiente sin depender de la marca.
9. `InboxDeviceTile` se utiliza únicamente para dispositivos pendientes que requieren asignación.
10. Descubrimiento solicita `view=summary`, difiere el filtrado de texto y monta entidades en lotes de 48; nunca debe transferir `attributes` completos ni desmontar resultados existentes durante una actualización.
11. No mover llamadas API a componentes puramente visuales salvo que el componente sea dueño real del flujo.
12. No dejar estados, handlers, imports o helpers sin usar.
13. Todo componente nuevo debe quedar integrado y validado.
14. Usar primitives del design system antes de crear botones, filtros, alertas o estados vacios manuales.
15. Las secciones de tablero usan un catálogo acotado de tarjetas (`light`, `cover`, `camera`, `room`, `scene` y relojes); tarjetas legacy `system` persistidas se ignoran durante la normalización y no deben volver al catálogo visual. Tarjetas informativas antiguas como energía o asistente se conservan solo para compatibilidad si ya existían guardadas, pero no se ofrecen como nuevas cards de sección.
16. La edición de tableros no usa el inspector legacy ni presets `XS/S/M/L/XL`; las tarjetas se agregan y configuran dentro de secciones con tamaños reales de filas/columnas.
17. La configuración de una vista no expone selector de diseño visual; el layout existente se conserva internamente y la edición se concentra en título, icono, fondo y visibilidad.
18. La ruta de vista se muestra como slug de solo lectura generado desde el título; no debe prometer navegación directa hasta que exista contrato backend/frontend explícito para deep-link por pestaña.
19. Los tableros y vistas se filtran por usuario: `admin` no ve tableros ajenos por defecto; solo propietarios o usuarios incluidos en `visibility.users` reciben el dashboard o pestaña.
20. Al borrar una pestaña o remover su imagen de fondo, el backend debe eliminar el directorio físico `data/media/dashboards/<dashboardId>/<tabId>` para evitar archivos huérfanos.

## Patrón Recomendado

Una vista puede tener esta forma:

```tsx
export function ExampleView() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    // fetch / subscriptions
  }, []);

  const handleAction = async (id: string) => {
    // API + state updates
  };

  return (
    <div>
      <ExampleHeader />
      <ExampleList items={items} onAction={handleAction} />
    </div>
  );
}
```

Un componente visual debe recibir datos y callbacks explícitos:

```tsx
interface ExampleListProps {
  items: Item[];
  onAction: (id: string) => void;
}
```

## Sidebar

El sidebar tiene dos modos en desktop:

- Expandido: muestra iconos, labels, badges, perfil y acciones completas.
- Colapsado: conserva un rail de iconos y oculta textos largos con transición de `opacity/width`.

Reglas:

- No colapsar el sidebar a `w-0` en desktop.
- Evitar comprimir texto durante animaciones.
- Usar `collapsedOnDesktop` en `SidebarItem`.
- Los labels largos deben usar `whitespace-nowrap`, `overflow-hidden` y transición controlada.
- Los tooltips `title` mantienen contexto cuando el rail está colapsado.

## Componentes Extraídos

Áreas ya modularizadas:

- Dashboard: rooms, scenes, edge status, insights, loading, atmosphere ripple.
- Inbox: device tiles, discovery section, inspector.
- Automations: header, empty/loading states, notification, rule cards.
- Automation Builder: frame, identity, trigger, action, error, submit, shared types.
- Scenes: header, empty state, group, card.
- Dashboards: sidebar parent navigation, per-user dashboard entries, Home Assistant-style top bar, tab strip, view configuration modal, create form, title bar, secciones editables y tarjetas modulares para luces/dispositivos, cámaras, habitaciones, escenas, relojes, energía y asistente.
- Diagnostics: loading, error, health banner, resilience summary, issues, probes, timeline.
- Assistant: loading, empty state, header, finding card, finding group.
- Home Conversation: header, empty state, message bubble, typing indicator, composer.
- Users: loading, error, header, create form, table, protection note.

## Validacion Obligatoria

Para cambios frontend:

```bash
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
docker compose up --build
docker compose ps
```

El trabajo no se considera terminado si TypeScript, Vite o Docker fallan.

## Checklist de Revision UI

- La vista modificada sigue siendo orquestadora.
- No hay JSX grande nuevo en `views`.
- No hay imports no usados.
- No hay casts innecesarios.
- No hay dependencias inestables en `useEffect`.
- No se ocultan datos existentes durante refresh.
- No se introducen skeletons después de carga inicial.
- El sidebar y layouts compactos no comprimen texto.
- Docker levanta con `homepilot-api` healthy.
