# Tareas: Dashboard Layout and Widgets V1

## Implementado


- [x] CRUD de dashboards, pestañas, secciones, widgets y visibilidad de usuarios.
- [x] Canvas responsive, widgets tipados y catálogo MDI diferido.
- [x] Controles por capacidad, cámaras, sensores, reloj, escena y media player.
- [x] Tipografía de métricas de sensores centralizada en tokens responsive del design system.
- [x] Superficies claras de widgets con fondos activos: una veladura cálida y neutra reduce la competencia visual del fondo, mientras las tarjetas usan una escala mineral de piedra y arena, bordes serenos y elevación moderada sin alterar estados ni comandos.
- [x] Placeholder de nueva sección en flujo secuencial, siempre posterior a las secciones existentes.
- [x] Plantillas de título vinculadas únicamente al contexto autenticado local de HomePilot.
- [x] Tarjeta multimedia legible, visor de cámara proporcional e inspector técnico adaptativo para celdas, modal y cajón angostos.
- [x] Reordenamiento de zonas por puntero y teclado, con limpieza del overlay al cancelar la interacción.
- [x] AC17, AC43–AC44 (implementación): El canvas se monta con la configuración del tablero; tarjetas dinámicas sin snapshot usan placeholders semánticos con umbral compartido de 190 ms, cámara espera su primer fotograma, energía conserva métricas anteriores y reloj limita la espera al clima. Botones configurados no se bloquean.
- [x] AC18: El canvas limita la distribución a dos columnas en kioscos verticales de alta resolución;
      prueba unitaria y prueba responsive cubren el caso 1080×1920 sin cambiar móvil, tablet ni escritorio.
- [x] AC24–AC25: Reserved the four-per-row compact size for light and one-shot activator tiles, normalized stale compact spans for all other kinds, and simplified section-card edit controls to direct edit, overflow actions, and drag-from-card reordering.
- [x] AC24: Fixed media-player section cards to full width, normalized legacy medium/small media spans, and removed their redundant width selector and resize handle.
- [x] AC26: Removed edit-only section padding and panel borders, normalized the empty-section add tile, made card actions contextual on hover/focus, and use natural compact grid rows in edit mode so mixed card heights do not reserve empty space.
- [x] AC27: Added a contextual card hover/focus scrim, bounded each editable section with a dashed Home Assistant-style surface, connected direct move, edit, delete, and drag-resize interactions, and moved the section-width picker into the section toolbar; the add-section affordance now consumes one column. Section deletion now opens a destructive confirmation modal before mutating the layout.

## Verificación obligatoria ante cambios

- [ ] Ejecutar externamente las regresiones de skeleton inicial, delay, refresh, error/offline, cámara 4:3, sensor value-first, media, reloj y movimiento reducido; no se ejecutaron en esta tarea.
- [ ] Ejecutar externamente la prueba responsive de transición skeleton → contenido en escritorio, tablet, móvil y kiosco vertical; verificar bounds y ausencia de overflow.

- [ ] Validar externamente el round-trip de un Botón asignado a escena con el ID real del recurso y hogar autorizado; comprobar también que una escena ausente se desasigna y se reporta sin matching por nombre. Regresiones escritas, no ejecutadas aquí.
- [ ] Validar externamente la estabilidad geométrica del fondo A → B → sin fondo → B en desktop y tablet y revisar visualmente el reloj digital ambiental y el analógico premium en claro/oscuro. Las pruebas están escritas, no ejecutadas aquí.

- [ ] Validar externamente AC38–AC41: colisiones de nombres ES/EN, copy de asignaciones, overflow desktop/tablet/móvil/kiosco, variantes de sensores y composición digital/analógica del reloj. Las regresiones están escritas, no ejecutadas en este worktree por restricción de la tarea.

- [ ] Validar externamente AC36–AC37: tests de round-trip, bindings existentes/ausentes/incompatibles, hogar autorizado, reporte de pendientes, presets y fondos locales. Código y regresiones escritos; no ejecutados en este worktree por restricción de la tarea.

- [ ] Probar móvil, tablet y escritorio con contenido largo y fondos activos.
- [ ] Probar acceso directo de usuario autorizado y no autorizado.
- [ ] Probar reordenamiento vertical y horizontal sin placeholders superpuestos.
- [ ] AC17 actualizado: ejecutar externamente `typecheck`, `build`, `check:i18n`, `check:ui-primitives` y revisión visual del nuevo límite de carga por tarjeta. La validación anterior correspondía al gate global reemplazado.
- [x] AC28: Matched light and action previews to their semantic live-card surfaces in both themes, and kept the dashboard navigation trigger visible and usable at the 1080×1920 portrait-kiosk breakpoint.
- [x] AC29: Named the unified catalog card Button, retained light toggles, and made one-shot buttons, scenes, and routines use the same light-tile on/off appearance, switching on during execution and briefly after success before returning to off; existing action cards stay compatible and failures are announced accessibly.
- [x] AC30: Added four bundled HomePilot backgrounds with localized, accessible selection in view configuration. Bundled assets resolve from the console origin while custom uploaded backgrounds retain their API-hosted path.
- [x] AC30: Balanced light and dark dashboard veils so both themes preserve the selected image rather than replacing it with an opaque theme-colored surface; theme-specific overlays now only protect operational contrast.
- [x] AC31: Removed standalone Room and Scene catalog types and hid the redundant Action button option while keeping persisted action cards compatible. Light/activator catalog previews resolve their localized size label correctly.
- [x] AC32: Added cache policies for versioned bundles, named console visual assets, and private local media. Home imagery is decoded asynchronously and critical above-the-fold imagery receives high fetch priority.

- [x] AC35: Unificar las tarjetas de cámara del Dashboard y Gestor mediante `CameraDeviceTile`, conservando el diseño de imagen con título y espacio superpuestos del Dashboard; mostrar carga inicial hasta el primer fotograma, retirar «Imagen actualizada» y permitir ampliar desde toda la tarjeta sin botón flotante. El visor ampliado debe ajustarse a la proporción nativa del video sin recortar contenido y superponer «En vivo», título y cierre. Cubrir los tres contextos y el visor en escritorio y móvil con pruebas responsive.
