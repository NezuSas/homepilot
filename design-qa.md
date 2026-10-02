# Sensor — corrección local de composición

Fecha: 2026-10-01. Alcance: SensorMetricCard, CSS propio, skeleton y radio del wrapper Sensor de SectionCardItem. Extensión local dentro de la paleta HomePilot establecida; no auditoría global ni nueva identidad visual.

## Fuente y evidencia

- Fuente visual: `C:/Users/ocuen/AppData/Local/Temp/codex-clipboard-352e98b7-4278-4a87-8fbd-3b619381098e.png` (1536 × 1024 px).
- Resultado vigente: `.impeccable/review/sensor-v2-{mobile,tablet,desktop,tablet-landscape,kiosk}-{dark,light}.png`.
- Viewports CSS: móvil 320 × 720; tablet 768 × 1024; escritorio 1440 × 900; tablet horizontal 1024 × 768; kiosco vertical 1080 × 1920. Capturas full-page, deviceScaleFactor 1; el documento completo puede ser más alto que el viewport.
- Comparación final de carga: `.impeccable/review/sensor-v2-{skeleton,loaded}-{mobile,tablet}.png`; incluye ambas tarjetas angostas durante carga. No hay captura final de carga en escritorio ancho.
- Fuente y capturas se abrieron conjuntamente para evaluar composición y regiones de lectura. Se compararon tarjetas, no la distribución de las doce muestras de la referencia contra los siete sensores de la fixture. La paleta de referencia no es normativa: el usuario exige conservar los tokens HomePilot.

## Superficies de fidelidad

- Tipografía: Rubik local, números tabulares y peso numérico 450 conservados; profundidad de fichas compacta. Nombres completos con salto natural. La lectura larga `123456.7` queda continua, sin fichas, aproximadamente 19–20 px en angosto, con unidad debajo; no se inventan cifras ni se truncan lecturas.
- Espaciado/layout: cabecera, hero central y pie en bandas comunes; icono encima en angosto y estancia solo si existe. El meter porcentual vive en el pie sin desplazar el hero. Carcasa Sensor proporcional con reserva inicial idéntica y mismo `containerType: inline-size` y `containerName: sensor-card` que su skeleton. No se modifica masonry, ancho de Section ni grid global.
- Forma: radio Sensor efectivo de 16 px en CSS y wrapper específico de SectionCardItem (`rounded-2xl`); el skeleton excluye la utilidad general de radio conflictiva y comparte las bandas del contenido.
- Colores: superficies cálidas, borde, texto y naranja proceden de los tokens Dashboard existentes en claro/oscuro. Se conservan los colores semánticos de aviso existentes. La diferencia con la paleta azul/multicolor de la referencia es una instrucción explícita, no deriva visual.
- Assets/iconos: Lucide y registro existente; sin ilustraciones falsas, ellipsis ni interrogación decorativa. Fichas y meter son UI funcional.
- Copy/contenido: nombre configurado una vez, estancia solo si está disponible, traducciones de carga de batería, avisos de memoria y ausencia explícita «— / Sin lectura». No se fabrican historial, tendencias, autonomía ni rangos que SnapshotDevice no proporciona. Los estados no son switches.

## Historial de comparación

Los pases anteriores del 2026-10-01 obtuvieron pruebas PASS y un veredicto técnico limitado, pero el usuario rechazó visualmente la composición. Las capturas `sensor-*` anteriores y sus PASS quedan como evidencia histórica; no representan aceptación de la composición vigente.

Dos revisiones frescas de solo lectura detectaron P2 radio conflictivo, P2 lectura larga y P3 skeleton. Después de corregirlos, una revisión final fresca confirmó resuelta esa lista de tres hallazgos. El veredicto se limita a esa lista: no constituye aprobación visual global ni reproducción píxel a píxel de la referencia. La aprobación visual del usuario sigue pendiente.

La corrección toca SensorMetricCard.tsx, index.css, DashboardCardSkeleton.tsx y SectionCardItem.tsx (radio solo Sensor). `responsive-shell.spec.ts` añade comprobaciones computadas de ajuste del título y radio 16 px sin relajar aserciones. Modelo/presenter compartido, backend y distribución global permanecen sin cambios en esta corrección.

## Validación

- Evidencia de ejecución comunicada por el coordinador: Jest 57/57 en SensorMetricCard, DashboardCardSkeleton y TopologyDeviceTile.
- Responsive focalizado: 16 escenarios únicos PASS inicialmente: cinco Sensor clarity (ambos temas), cuatro skeleton geometry y siete Room devices. Confirmación Sensor/skeleton 9/9 PASS repetida dos veces tras descubrir y resolver el radio conflictivo.
- Typecheck, lint Operator Console, build raíz y build Operator Console: PASS.
- Spec coverage, BDD traceability y module test coverage: PASS repetido por el coordinador después de esta actualización documental. i18n, architecture boundaries y no-production-any: PASS. La pasada documental no ejecutó esos controles.
- Advertencias preexistentes: Browserslist y tamaño del chunk MDI.
- Responsive completo: cero ejecuciones. Docker no ejecutado. Tablet física, Safari, tecnologías de asistencia y contraste numérico no certificados; evidencia responsive de Chromium.
- Esta pasada documental no ejecutó tests, Git/GitHub, deploy ni publicación; no creó DESIGN.md ni sidecar global.

## Estado final

P2 radio, P2 lectura larga y P3 skeleton confirmados resueltos por revisión fresca. Curvas históricas, presión analógica y estimaciones del mock no se reproducen con datos inventados. La evidencia no certifica aceptación global ni fidelidad exacta a la imagen fuente.

Estado: lista de correcciones confirmada; aprobación visual del usuario pendiente.

## Refinamiento posterior — densidad y agrupación

La petición posterior fija Sensor a medio y elimina la estancia repetida en Dashboard/Espacios. Se compactan cabecera, padding y altura mínima (12–14 rem según ancho), manteniendo lectura, unidad, avisos, meter y estado sin lectura. El skeleton comparte padding y bandas; la utilidad genérica p-4 queda exclusivamente en otros tipos. Espacios separa grids por tipo efectivo y ordena nombres dentro de cada grupo. Sin cambio de paleta, backend ni masonry.

Evidencia nueva: 79/79 Jest en cinco suites; 17/17 responsive focalizados (cinco Sensor, un ancho Sensor, siete Espacios y cuatro geometría skeleton). Typecheck, lint y builds raíz/consola PASS. Capturas `sensor-fiches-dark.png` y `room-devices-dark.png` de tablet revisadas directamente desde test-results: nombres y lecturas visibles, sin estancia redundante; grupos independientes. Las capturas sensor-v2 anteriores siguen siendo históricas, no representan este refinamiento. No se ejecutó responsive completo, Git, Docker ni deploy. Sin certificación de hardware/tablet física.
