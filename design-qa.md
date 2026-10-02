# Sensor — corrección local de composición

## Dashboard — edición y transferencia de pestañas (2026-10-02)

- Alcance independiente: una entrada Editar en Más, nombre en modo edición, transferencia de pestaña privada no destructiva y drag entre Sections. Paleta y presentaciones de tarjetas existentes conservadas.
- Causa de los huecos extra al editar: slots de Sections con filas compartidas por altura máxima; ahora las vistas normal/edición comparten tracks finos con medición individual, preservando slots vacíos.
- Revisión visual batched de `apps/operator-console/test-results/responsive-shell-Feature-D-{43db4--section-movement-on-mobile,d8596--section-movement-on-tablet,11bbf-section-movement-on-desktop}/dashboard-editing.png`, a 390×844, 1024×768 y 1440×900. Una corrección de separación del control Añadir tarjeta y una confirmación conjunta: sin solapamiento de los controles ni desborde del header. Evidencia automatizada, no aprobación visual del usuario ni prueba de hardware físico.
- Jest focalizado: 7 suites, 83/83 PASS. Responsive focalizado final: 23/23 PASS, incluye móvil/tablet/escritorio/kiosco vertical para geometría inicial, Clock, slots e historial. Mouse, touch (500 ms) y teclado conservan movimiento/persistencia/cancelación; la escucha diferida de dnd-kit se sincroniza por frame en el test, sin sleep ni force.
- Typecheck, lint, builds raíz/Operator Console y controles spec/BDD/module/i18n/architecture/no-production-any PASS. Detector final sobre TitleBar/Canvas/SectionWidget/SectionCardItem sin hallazgos. Advertencias preexistentes de Browserslist y chunk MDI. Responsive completo, Git, GitHub, Docker y deploy: no ejecutados. Sin migración de base de datos; API histórica completa conservada.

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

## Refinamiento autorizado — rutinas compartidas, registros y tema automático

Se conserva la identidad HomePilot y sus tokens actuales. RoutineSharingField reutiliza búsqueda y controles accesibles para compartir explícitamente con varios usuarios; EventFilters comparte la composición fecha/acción/nombre entre las tres vistas de registros. Esas composiciones tienen skeleton propio. Historial y Usuarios compactan su contenido sin reducir los controles táctiles. La nota de protección reutiliza AlertBanner y la instalación elimina únicamente el fondo exterior redundante.

Revisión visual acotada: capturas de Auditoría e Historial en móvil (320 px) y tablet portrait (768 px), y Usuarios en móvil/tablet/escritorio (1440 px), abiertas conjuntamente por lote. Los filtros se apilan en móvil y se alinean en tablet; el JSON permanece acotado con scroll interno; las tarjetas de ejecución y usuario no desbordan. La vista de Usuarios se confirmó en claro/oscuro. Detector de layout sobre EventFilters, RoutineSharingField y ExecutionCard: lista vacía. Esta evidencia no constituye aprobación visual del usuario ni certificación de contraste/tecnologías de asistencia.

Validación de este alcance: 190/190 Jest en 23 suites y 50 escenarios responsive focalizados únicos PASS; confirmación final 17/17 y 3/3 Usuarios/Acceso. Typecheck, lint y builds raíz/consola PASS; controles spec, BDD, cobertura modular, i18n, arquitectura, ausencia de `any`, Tuya y perfiles Docker estáticos PASS. Sin responsive completo, Jest completo, Git, GitHub, Docker ni deploy. Tablet física/Safari siguen sin certificar. Migración aditiva 034 probada solo en bases temporales; backup obligatorio antes de aplicarla en MiniPC.

## Sensor analógico — referencia autorizada 2026-10-02

Fuente visual: `C:/Users/ocuen/AppData/Local/Temp/codex-clipboard-d0377bd6-c268-4723-82c1-96d749161ab7.png` (1536×1024). Se usan las cuatro tarjetas principales como composición; no se implementa una página de demostración ni las variantes inferiores. El medio ancho dentro de Section, Rubik y paleta HomePilot son restricciones previas explícitas, por lo que la densidad de la referencia se adapta al ancho real.

Evidencia final: `.impeccable/review/analog-final/responsive-shell-Feature-S-fbd47-a-fit-mobile-in-both-themes/sensor-fiches-{dark,light}.png`, `responsive-shell-Feature-S-cb420-a-fit-tablet-in-both-themes/sensor-fiches-{dark,light}.png`, `responsive-shell-Feature-S-dbd53--fit-desktop-in-both-themes/sensor-fiches-{dark,light}.png`, `responsive-shell-Feature-S-65c28-et-landscape-in-both-themes/sensor-fiches-{dark,light}.png` y `responsive-shell-Feature-S-5553b-rtrait-kiosk-in-both-themes/sensor-fiches-{dark,light}.png`, todas bajo esa carpeta final.

CSS viewports: móvil 320×720, tablet 768×1024, escritorio 1440×900, tablet landscape 1024×768 y kiosco portrait 1080×1920; Chromium DPR 1. Las capturas móviles/tablet incluyen el contenido en altura; escritorio representa el viewport real con scroll interior. Fuente y implementación se abrieron juntas en el mismo lote y se comparó el contenido de tarjetas, no el chrome ni el espacio externo de la fixture. La escala se normalizó por región/ancho de tarjeta; no se certifica igualdad píxel a píxel entre la lámina de referencia y Dashboard. No se precisó un recorte adicional: las tarjetas en móvil/tablet se ven a escala legible.

Superficies comprobadas: Rubik y lectura mayor que título; ritmo cabecera/esfera/lectura/pie sin cruce con ticks; tokens cálidos claro/oscuro sin cambiar paleta; Canvas de datos nítido a DPR real y Lucide existente, no ilustración estática; nombres configurados, unidades y ausencia reales. La escala automática se identifica como escala, no rango saludable. No se fabrican estados de salud de presión/temperatura ni tendencias. Se conserva meter HTML accesible; Canvas decorativo, categorías no interactivas y estado sin lectura neutro.

Historial de comparación: primer lote detectó P2 superposición de lectura y ticks en tarjetas estrechas y espacio interno excesivo. Se separó lectura en flujo por debajo de graduaciones, conservando esfera de ancho completo y header compacto. Confirmación visual conjunta resolvió ambos. Revisión fresca posterior detectó P2 precisión de ticks grandes (150000 mostrado como 2e+5); formatter compacto y cinco pruebas preservan 75k/150k, recapturas finales lo demuestran. También se añadió documentación modular enlazada a producto/spec existentes. Reviewer final: `disposition: ship`, limitado a esos dos hallazgos puntuados; no aprobación visual del usuario.

Validación: 75/75 Jest (cuatro suites), 17/17 responsive focalizados y confirmación Sensor 5/5 en ambos temas con las cuatro mediciones de referencia, sin cambiar la prueba skeleton. Typecheck, lint, builds raíz/consola y spec/BDD/module/i18n/architecture/no-production-any PASS. Detector de targets sin hallazgos. Consola mock registró WebSocket sin backend y un refresh DEVICE_REFRESH_ERROR; no son prueba de telemetría real, todas las aserciones UI pasan. Browserslist y chunk MDI conservan sus advertencias previas. No Git/GitHub/Docker/deploy ni responsive completo. Tablet física, Safari, lector de pantalla y contraste instrumental numérico siguen sin certificar. No cambios backend/schema/migración en esta tarea.

final result: passed

## Refinamiento Sensor y arrastre elevado — 2026-10-02

Alcance acotado: unidades inline, tamaño de lectura común hasta seis caracteres, reserva interna compacta incluso sin lectura, cinco/seis etiquetas de escala. Misma paleta y semántica meter. Preview elevado de card/Section con tamaño real, portal inert sin captura de pointer events, long press de Section desde fondo libre y slots densos por columna conservando huecos persistidos.

Lote visual inspeccionado: Sensor móvil/tablet oscuro y desktop claro, y Section elevada durante movimiento. Capturas en `.impeccable/review/compact-drag-verified/` (Sensor) y `.impeccable/review/compact-drag-final/` (Section). No se detectaron cruces entre unidades/lectura ni pérdida de las graduaciones adicionales; ausencia neutral sin dato ficticio. Detector de layout de targets: lista vacía. No se ejecutó una nueva revisión por agente independiente ni se afirma aprobación visual del usuario.

Validación final: 76/76 Jest, 19/19 responsive focalizados; typecheck, lint, builds raíz/consola y controles spec/BDD/module/i18n/arquitectura/no-any PASS. Se corrigió el hit-testing de la capa externa de DragOverlay descubierto al repetir movimiento tras cancelar; el test usa interacción real sin force ni sleeps. Reloj simulado táctil reanudado antes de reload. No cambios backend/schema, Git/GitHub/Docker/deploy ni responsive completo. Advertencias previas Browserslist/chunk MDI y WebSocket sin backend en fixtures; tablet física/Safari siguen sin certificar.
