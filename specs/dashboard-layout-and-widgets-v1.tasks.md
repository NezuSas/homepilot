# Tareas: Dashboard Layout and Widgets V1

## Implementado

- [x] CRUD de dashboards, pestañas, secciones, widgets y visibilidad de usuarios.
- [x] Canvas responsive, widgets tipados y catálogo MDI diferido.
- [x] Controles por capacidad, cámaras, sensores, reloj, escena y media player.
- [x] Tipografía de métricas de sensores centralizada en tokens responsive del design system.
- [x] Superficies claras de widgets con fondos activos: una veladura cálida y neutra reduce la competencia visual del fondo, mientras las tarjetas usan una escala mineral de piedra y arena, bordes serenos y elevación moderada sin alterar estados ni comandos.
- [x] Placeholder de nueva sección en flujo secuencial, siempre posterior a las secciones existentes.
- [x] Plantillas de título vinculadas únicamente al contexto autenticado local de HomePilot.
- [x] Tarjeta multimedia compacta, visor de cámara proporcional e inspector técnico adaptativo para celdas, modal y cajón angostos.
- [x] Reordenamiento de zonas por puntero y teclado, con limpieza del overlay al cancelar la interacción.
- [x] AC17: `DashboardsView` gatea el montaje del canvas con `LoadingState` hasta la primera carga del
      snapshot de dispositivos, eliminando el parpadeo de widgets "no configurados" antes de que
      llegue el estado real.
- [x] AC18: El canvas limita la distribución a dos columnas en kioscos verticales de alta resolución;
      prueba unitaria y prueba responsive cubren el caso 1080×1920 sin cambiar móvil, tablet ni escritorio.
- [x] AC24–AC25: Reserved the four-per-row compact size for light cards, normalized stale compact spans for all other kinds, and simplified section-card edit controls to direct edit, overflow actions, and drag-from-card reordering.
- [x] AC26: Removed edit-only section padding and panel borders, normalized the empty-section add tile, and made card actions contextual on hover/focus.
- [x] AC27: Added a contextual card hover/focus scrim, bounded each editable section with a dashed Home Assistant-style surface, connected direct move, edit, delete, and drag-resize interactions, and moved the section-width picker into the section toolbar; the add-section affordance now consumes one column. Section deletion now opens a destructive confirmation modal before mutating the layout.

## Verificación obligatoria ante cambios

- [ ] Probar móvil, tablet y escritorio con contenido largo y fondos activos.
- [ ] Probar acceso directo de usuario autorizado y no autorizado.
- [ ] Probar reordenamiento vertical y horizontal sin placeholders superpuestos.
- [x] AC17: `npm run typecheck`/`build` en `apps/operator-console`, `check:i18n`,
      `check:ui-primitives` en verde. Verificación visual en navegador pendiente del usuario (sin
      herramienta de automatización de navegador disponible en este entorno).
- [x] AC28: Matched light and action previews to their semantic live-card surfaces in both themes, and kept the dashboard navigation trigger visible and usable at the 1080×1920 portrait-kiosk breakpoint.
- [x] AC29: Extended action-card targets to compatible buttons, scenes, and routines; removed the manual card-height control and legacy row-span behavior; aligned action preview content to the leading edge and preserved opaque editor previews for unassigned action cards.
