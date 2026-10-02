# Tareas: Dashboard Layout and Widgets V1

## Compactación Sensor y arrastre elevado — 2026-10-02

- [x] Unidad junto a lectura; tamaño común para valores de hasta seis caracteres; compactar carcasa y ausencia sin quitar información.
- [x] Cinco etiquetas de escala en instrumento angosto y seis en ancho, conservando las marcas.
- [x] Preview elevado de tarjeta/Section con dimensiones reales, portal no interactivo y foco excluido.
- [x] Arrastre de Sections desde superficie libre, mouse/touch/teclado, sin grip; slots por columna bajo la Section más corta, preservando huecos.
- [x] Mantener estabilidad skeleton/contenido y persistencia; probar cancelación seguida de un nuevo arrastre.

Evidencia local: 76/76 Jest en SensorMetricCard, SensorAnalogGauge, DashboardCardSkeleton, sectionSlots y sectionCardDrag; 19/19 responsive focalizados en `.impeccable/review/compact-drag-verified/`. Incluye móvil, tablet portrait/landscape, desktop y kiosco portrait; mouse/touch/teclado, traslado entre Sections, huecos persistidos y cuatro escenarios de geometría inicial sin relajar sus assertions. Typecheck, lint, builds raíz/Operator Console y controles spec/BDD/module/i18n/arquitectura/no-any PASS. La confirmación corrigió una capa exterior de DragOverlay que interceptaba el siguiente gesto tras cancelar y reanudó el reloj simulado del test touch antes de recargar. Revisión visual conjunta Sensor móvil/tablet oscuro, desktop claro y preview elevado de Section; detector sin hallazgos. Sin Git/GitHub/Docker/deploy ni responsive completo. Tablet física/Safari no certificados.

## Sensor analógico — referencia autorizada 2026-10-02

- [x] Presenter analógico modular, aguja real y escala de visualización explícita/automática sin salud inventada.
- [x] Mantener binding, estados textuales, preview, tamaño medio y menú funcional.
- [x] Skeleton propio de esfera, misma reserva exterior y paleta claro/oscuro.
- [x] Validaciones focalizadas, responsive y comparación visual con referencia; sin Git/GitHub/Docker/deploy.

Evidencia local 2026-10-02: 75/75 Jest en cuatro suites SensorMetricCard/SensorAnalogGauge/DashboardCardSkeleton/TopologyDeviceTile. Responsive focalizado 17/17 Sensor/Espacios/geometría y confirmación 5/5 Sensor con temperatura, presión bar/hPa y humedad, claro/oscuro. Typecheck, lint y builds raíz/Operator Console PASS; spec/BDD/module/i18n/architecture/no-production-any PASS. Detector sin hallazgos. Fuente y capturas comparadas conjuntamente; lectura separada de graduaciones y marcas compactas 75k/150k corregidas. Revisión fresca: disposition ship limitada a los dos hallazgos corregidos. Evidencia final `.impeccable/review/analog-final/`, documento `docs/components/SensorMetricCard.md`. No responsive completo ni hardware físico/Safari. Advertencias preexistentes Browserslist/chunk MDI y red mock sin servicios reales no equivalen a validación de telemetría.

## Refinamiento local — edición, pestañas y drag táctil

- [x] Unificar entrada Editar en Más y renombrado dentro de ese modo.
- [x] Añadir transferencia por pestaña con validación/IDs privados y revisión previa; conservar endpoints históricos.
- [x] Compartir geometría normal/edición y conservar slots vacíos.
- [x] Arrastre touch prolongado y transferencia atómica de tarjetas entre Sections de la misma pestaña.
- [x] Tests focalizados, responsive focalizado y controles técnicos; sin Git, GitHub, Docker ni deploy.

Evidencia local 2026-10-02: Jest 7 suites / 83 tests PASS; responsive final focalizado 23/23 PASS (edición, transferencia de pestaña, movimiento mouse/touch/teclado, cancelación, slots, geometría inicial, Clock e historial). Typecheck, lint, build raíz y Operator Console PASS. Controles spec/BDD/module/i18n/architecture/no-production-any PASS. Revisión visual conjunta móvil/tablet/escritorio y una confirmación tras separar controles; detector sin hallazgos. Responsive completo: cero ejecuciones. No se certificó tablet física/Safari ni se desplegó; advertencias preexistentes Browserslist y chunk MDI.

## Implementado

- [x] AC40 (corrección de composición vigente 2026-10-01): cabecera, hero central y pie en bandas comunes; nombre completo con salto natural e icono encima en tarjetas angostas; cifras de peso 450 y profundidad compacta. Meter porcentual en el pie sin desplazar el hero. Paleta Dashboard conservada; ausencia «— / Sin lectura», sin interrogación decorativa ni historia/rangos ficticios.
- Radio Sensor efectivo de 16 px en CSS y wrapper específico de `SectionCardItem` (`rounded-2xl`); skeleton Sensor excluye el radio general conflictivo y comparte bandas, `containerType` y `containerName: sensor-card` con el contenido. `123456.7` queda continuo, sin fichas, aproximadamente 19–20 px en angosto y unidad debajo. Modelo/presenter compartido, backend, grid y masonry sin cambios en esta corrección.
- Capturas vigentes `.impeccable/review/sensor-v2-{mobile,tablet,desktop,tablet-landscape,kiosk}-{dark,light}.png` y `sensor-v2-{skeleton,loaded}-{mobile,tablet}.png` (ambas tarjetas angostas durante carga). Dos revisiones de solo lectura y una revisión final fresca confirman resueltos P2 radio, P2 lectura larga y P3 skeleton. Veredicto limitado a esa lista; aprobación visual del usuario pendiente.
- Validación final comunicada por el coordinador: Jest 57/57 en tres suites PASS; 16 escenarios responsive únicos PASS inicialmente (cinco Sensor clarity, cuatro skeleton geometry y siete Room devices); 9/9 Sensor/skeleton PASS repetido dos veces tras descubrir el radio conflictivo. Aserciones computadas de ajuste de título y radio 16 px añadidas sin relajación. Typecheck, lint y builds raíz/Operator Console finales PASS. Spec/BDD/module/i18n/architecture/no-production-any PASS antes de esta actualización documental; el coordinador repetirá los tres controles documentales. Responsive completo: cero ejecuciones. Advertencias preexistentes Browserslist/chunk MDI; Docker no ejecutado; hardware físico, Safari, tecnologías de asistencia y contraste numérico no certificados. Esta pasada documental no ejecutó Git/GitHub ni publicación.

### Historial sustituido por la corrección vigente

Verificación documental posterior por el coordinador: `check:spec-coverage`, `check:bdd-traceability` y `check:module-test-coverage` PASS; la repetición anunciada arriba quedó completada.

Los pases Sensor anteriores de este mismo día descritos a continuación tuvieron pruebas PASS, pero el usuario rechazó visualmente su resultado. Sus dimensiones, capturas y veredictos son evidencia histórica; no equivalen a aprobación de la composición vigente ni sustituyen las capturas `sensor-v2-*`.

- [x] AC40 (rediseño desde referencia): cabecera con icono destacado y estancia real, lectura central grande, fichas con decimales intactos y barra porcentual inferior; estados sin interacción y carga traducida. Paleta Dashboard exclusivamente. Carcasa proporcional al ancho reservada desde carga, skeleton propio equivalente; verificar cinco dispositivos, ambos temas, valores largos/ausentes y estabilidad inicial sin tocar masonry global.
- Evidencia del rediseño autorizado 2026-10-01: referencia `C:/Users/ocuen/AppData/Local/Temp/codex-clipboard-352e98b7-4278-4a87-8fbd-3b619381098e.png`; se conserva la identidad cálida/naranja del Dashboard en claro/oscuro. `SensorMetricCard` y `DashboardCardSkeleton` comparten carcasa responsive, icono destacado, estancia real cuando existe, lectura central en fichas grandes y barra meter inferior solo para porcentajes. Estados binarios/categóricos son informativos; sin lectura se muestra «—» y «Sin lectura», sin unidad ni meter. No se inventan historia, tendencias ni rangos. `SectionCardContent`/`SectionCardItem` transmiten `roomName`; el adaptador `TopologyDeviceTile` retira la altura fija `h-36` para respetar la carcasa del Sensor.
- La nueva geometría Sensor sustituye el criterio histórico de conservar sus dimensiones exteriores: el rediseño puede crecer proporcionalmente al ancho, pero reserva desde la carga los mismos bounds del contenido real. No se relaja la prueba de estabilidad skeleton → contenido ni se modifica el algoritmo masonry global. Revisión final: lectura larga `123456.7` continua y sin fichas; skeleton y contenido móvil de 126×192 comparten carcasa y `containerType`. Ambos hallazgos de revisión resueltos.
- Validación del rediseño 2026-10-01: 57/57 pruebas en las tres suites focalizadas `SensorMetricCard`, `DashboardCardSkeleton` y `TopologyDeviceTile` PASS; 16 escenarios responsive únicos PASS (cinco Sensor clarity, cuatro skeleton geometry y siete Room devices). Typecheck, lint Operator Console, build raíz y Operator Console, spec coverage, BDD traceability, module test coverage, i18n, architecture boundaries y no-production-any PASS. No se ejecutaron suites completas, validación de hardware físico ni Docker; no se realizaron operaciones Git/GitHub ni publicación.


### Implementaciones previas y otros objetivos

- [x] CRUD de dashboards, pestañas, secciones, widgets y visibilidad de usuarios.
- [x] Canvas responsive, widgets tipados y catálogo MDI diferido.
- [x] Controles por capacidad, cámaras, sensores, reloj, escena y media player.
- [x] Unificar la presentación del reloj en HomePilotClock, ofrecer una sola opción Reloj y conservar los IDs históricos sin migración.
- [x] Aplicar superficies premium dark/light a secciones y tiles dentro de sus bounds existentes; separar la opacidad de la fotografía de la veladura del Dashboard.
- [x] Registrar el preset lógico Amber Residence y ocultarlo hasta que su asset independiente esté disponible.
- [x] Tipografía de métricas de sensores centralizada en tokens responsive del design system.
- [x] AC40: Simplificar SensorMetricCard a un nombre configurado, un icono y valor/unidad; conservar el meter de porcentajes sin duplicar el valor, retirar copy redundante y distinguir lectura ausente de cero. Verificar estados de memoria, títulos largos, preview compartido y geometría durante carga en las cinco presentaciones y ambos temas mediante Jest y responsive focalizado.
- [x] AC40 (refinamiento autorizado): Lecturas numéricas cortas en fichas, con paleta Dashboard y lectura accesible unificada; signos/decimales intactos, valores largos sin fichas, meter circular y carcasa exterior conservados. Sin tendencias ni estimaciones ficticias.
- Evidencia histórica del refinamiento 2026-10-01, sustituido y visualmente rechazado por el usuario pese a PASS: Jest focalizado y nueve escenarios Sensor/geometría PASS, incluidos tablet y kiosco durante skeleton → contenido. Gauge y fichas compactados para «100 %». La conservación de dimensiones exteriores pertenecía a ese pase; la carcasa proporcional actual está autorizada. Validación conjunta histórica en device-discovery-inbox.tasks.md.
- [x] AC40 (validación 2026-10-01): 31 pruebas SensorMetricCard y 16 escenarios responsive focalizados PASS; revisión visual móvil, tablet vertical/horizontal y escritorio en claro/oscuro; transición skeleton → contenido estable también en kiosco. Typecheck, lint, build raíz/Operator Console, i18n, spec coverage, BDD traceability y module test coverage PASS. Responsive completo no ejecutado.
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

- [ ] Validar externamente el único Reloj visible, la compatibilidad de los cuatro IDs históricos, las superficies premium de Section/tiles y su geometría en dark/light, escritorio, tablet, móvil y kiosco vertical. Tests escritos; no ejecutados por restricción de esta tarea.
- [ ] Incorporar el asset independiente `apps/operator-console/public/dashboard-backgrounds/homepilot-amber-residence.webp`; hasta entonces el preset está registrado pero oculto en el selector.

- [ ] Ejecutar externamente las regresiones de skeleton inicial, delay, refresh, error/offline, cámara 4:3, sensor value-first, media, reloj y movimiento reducido; no se ejecutaron en esta tarea.
- [ ] Ejecutar externamente la prueba responsive de transición skeleton → contenido en escritorio, tablet, móvil y kiosco vertical; verificar bounds y ausencia de overflow.

- [ ] Validar externamente el round-trip de un Botón asignado a escena con el ID real del recurso y hogar autorizado; comprobar también que una escena ausente se desasigna y se reporta sin matching por nombre. Regresiones escritas, no ejecutadas aquí.
- [ ] Validar externamente la estabilidad geométrica del fondo A → B → sin fondo → B en desktop y tablet y revisar visualmente el único HomePilot Clock en claro/oscuro. Las pruebas están escritas, no ejecutadas aquí.

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

## Refinamiento local — Sensor medio y densidad (AC40)

- [x] Normalizar Sensor a medio para creación, configuración histórica/importada, render y guardado; retirar selector y resize exclusivamente de Sensor.
- [x] Omitir estancia redundante en Dashboard/Espacios y compactar cabecera, padding y altura interna; mantener fichas, unidad, avisos, meter y ausencia de lectura.
- [x] Adaptar el skeleton propio con las mismas bandas y padding, sin modificar masonry ni skeletons de otros widgets.
- [x] Validar 79/79 Jest en cinco suites y 17/17 responsive focalizados (cinco Sensor, un ancho Sensor, siete Espacios y cuatro skeleton geometry). Typecheck, lint y builds raíz/consola PASS. Capturas tablet Sensor/Espacios inspeccionadas; sin suite responsive completa, Git o deploy.

- [x] AC35: Unificar las tarjetas de cámara del Dashboard y Gestor mediante `CameraDeviceTile`, conservando el diseño de imagen con título y espacio superpuestos del Dashboard; mostrar carga inicial hasta el primer fotograma, retirar «Imagen actualizada» y permitir ampliar desde toda la tarjeta sin botón flotante. El visor ampliado debe ajustarse a la proporción nativa del video sin recortar contenido y superponer «En vivo», título y cierre. Cubrir los tres contextos y el visor en escritorio y móvil con pruebas responsive.
