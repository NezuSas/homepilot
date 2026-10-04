# Tareas: Dashboard Layout and Widgets V1

## Adaptación Sensor y editor — AC54 (2026-10-04)

- [x] Dimensiones Sensor manuales con mínimo 4×4; limitar altura real a las filas reservadas y adaptar instrumento por ancho/alto. Conservar modo automático histórico.
- [x] Preferir nombre/lectura/unidad/ausencia sobre gráficos en modo compacto, sin scroll de tarjeta ni solapamientos. Skeleton propio adapta la misma reserva.
- [x] Añadir switch al catálogo de tarjeta y persistir en JSON existente; mostrar las seis opciones y respetar selección explícita antes que detección automática.
- [x] Editor estable entre tres paneles, controles a la izquierda/preview a la derecha en horizontal amplio, preview arriba en vertical, escala uniforme, footer accesible y límite por visualViewport.
- [x] Tests focalizados de escala, catálogo/round-trip, bits válidos/inválidos, prioridad explícita y responsive en móvil/tablet portrait/landscape/desktop en ambos temas; regresión de reloj y skeleton inicial.
- [x] Compatibilidad: no transformar tarjetas históricas al cargar, no migración SQL. Downgrade pierde representación switch; guardar export/backup antes de revertir. Sin Git/GitHub, Docker ni deploy.

Validación focalizada AC54/AC36: 427/427 Jest PASS en 12 suites y 16 escenarios responsive únicos PASS. Editor estable en móvil, tablet portrait/landscape y desktop, ambos temas, visualViewport reducido y sensor sin lectura; geometría histórica skeleton y reloj preservadas. Inspección visual acotada: una ronda y una confirmación tras corrección de separación header/interruptor. No suites completas ni certificación de hardware.


## Sensor binario y reloj redimensionable — AC53 (2026-10-03)

- [x] Visualización de interruptor exclusivamente de lectura: ON/OFF con tokens success/danger y ausencia de lectura neutral; sin enviar comandos.
- [x] Mostrar mediciones PLC con el formateador común y conservar precisión interna; configuración de enteros/decimales de otros sensores intacta.
- [x] Habilitar Diseño del reloj con mínimo 6 columnas/6 filas, guardar límites opcionales en el JSON existente y preservar relojes históricos automáticos.
- [x] Adaptar reloj a su altura disponible; modo compacto sin cita decorativa, sin recortar hora ni temperatura. Probar mínimo, guardado, movimiento, eliminación y cuatro tamaños de pantalla.
- [x] Jest conjunto: 429/429 PASS en 13 suites. Responsive conjunto: 22/22 escenarios focalizados únicos PASS; el reloj se repitió después de corregir la especificidad CSS y comprobar anchura real del texto. Captura desktop confirmada; la captura móvil inicial incluía la transición del sidebar, por lo que la captura final deshabilita transiciones.
- [x] Sin cambios SQL, migración de tarjetas ni hardware físico. No se afirma paridad completa con Home Assistant ni validación de tablet física.


## Editor Sections V2 — workspace vigente

### Transferencia adaptable y etiquetas — alcance autorizado

- [x] Adaptar columnas al transferir entre anchos distintos, también en preview y colocación; preservar filas, metadata y binding.
- [x] Preview a escala uniforme con reserva completa y origen arriba/izquierda; tarjeta nueva inicia 2 × 2 excepto anchos predeterminados de Media/Clock/Camera.
- [x] Etiqueta independiente en catálogo: hora/clima/sensor, source en kind, JSON compatible sin migración; títulos históricos intactos.
- [x] Skeleton propio, fallbacks y tests focalizados; no ejecutar responsive.
- Validación: 153/153 tests focalizados en ocho suites PASS; typecheck, lint, builds raíz/consola, spec coverage (955 fuentes), BDD, módulos, i18n, no-production-any y arquitectura PASS. Responsive y tablet física no certificados. Build conserva avisos de Browserslist antiguo y chunk MDI grande.

### Mínimos, preview estable y menú compartido

- [x] Selección nueva mínima 2 × 2, respetando límites propios y datos históricos.
- [x] CardPreviewFrame reserva ocho filas y alinea arriba el presenter real.
- [x] ActionMenu compartido para tablero y Section: portal, cierre exterior y teclado.
- [x] Añadir título antes del placeholder de Section en pestañas vacías.
- [x] Tests focalizados de límites, preview y menú; locators responsive semánticos adaptados al portal, sin ejecutar responsive.
- Validación: 48/48 tests en siete suites PASS; typecheck, lint, build raíz, build consola y checks de spec/BDD/módulos PASS. Responsive no ejecutado por restricción; tablet física no certificada. Avisos de build: Browserslist antiguo y chunk MDI grande, sin errores.

### Colocación libre y acciones de Section — 2026-10-03

- [x] Manual/Auto comparten gráfico Sensor; filas manuales solo modifican el mínimo exterior, sin estrechar el instrumento.
- [x] Posiciones opcionales `columnStart`/`rowStart` autorizadas al elegir la mejor solución: conservar hueco, colocar debajo, transferencia entre secciones y evitar solapamientos. Validación del parser compartido; JSON V1, sin schema/migración SQLite ni escrituras al cargar. Versiones anteriores ignoran posiciones y mantienen contenido/bindings.
- [x] Selector de ancho utiliza columnas reales del canvas y limita el valor guardado al perfil visible; rotar no escribe automáticamente.
- [x] Añadir tarjeta centrado debajo del contenido; acciones de Section únicamente en tres puntos, sin lápiz/eliminar duplicados. Este cambio sustituye su posición flotante anterior.
- [x] Proyección de filas colocadas evita solapamientos si aumenta la altura intrínseca, sin reescribir configuración durante render.
- Tests focalizados: 222/222 PASS en 10 suites, incluyendo parser, servicio Dashboard, sesión de edición, posiciones y dimensiones. Typecheck, lint y ambos builds PASS; checks de spec/BDD/modular, ausencia de any y arquitectura PASS. Responsive no ejecutado por restricción; interacción visual en tablet física no certificada.

### Refinamiento de dimensiones y contraste — 2026-10-03

- [x] Cuadrícula 12 × 8 por clic/toque/flechas, sin arrastre ni captura; actualización del escenario responsive existente sin ejecutarlo.
- [x] Presupuesto visual compartido por tarjeta real y preview; instrumento y lectura Sensor proporcionales, con prioridad a la visualización y sin alterar valores, escalas, animación ni accesibilidad.
- [x] Tipografía/iconos de superficies modulares adaptados al ancho de tarjeta; no escalar controles táctiles ni introducir scroll o altura fija.
- [x] Toggle apagado contrastado en Light mediante tokens de paleta existentes; semántica y comportamiento intactos.
- Validación: **137/137 PASS, 8 suites** focalizadas de sensores, instrumentos, sizing (incluido clic único y ausencia de handlers de arrastre), toggle, Clock y Media Player. Typecheck, lint, build raíz, build Operator Console y cobertura spec/BDD/modular PASS. Spec coverage: 949 fuentes. Build mantiene avisos previos de Browserslist/chunks. No responsive ni certificación visual/táctil por restricción expresa. Sin Git, Docker o deploy.

### Cuadrícula directa y expansión de Section — 2026-10-03

- [x] `CardGridSizePicker` modular: pointer/mouse/touch, captura, cancelación y teclado; retirar inputs/selectores de tamaño del editor.
- [x] Filas como mínimo, nunca contenedor de scroll impuesto; Section y preview crecen con el contenido y filas medidas.
- [x] Adaptación proporcional de columnas al guardar cambio de ancho de Section; preservar filas, binding, metadata y orden, sin migración ni escritura al cargar.
- [x] Añadir Section en primer hueco del perfil, estable tras mover/recargar; creación ocupa ese hueco sin compactar los demás. Flujo denso para vistas multicolumna.
- Jest focalizado: **21/21 PASS, 5 suites**, incluyendo el componente, coordenadas mouse/touch/teclado, límites, adaptación 2→1→2 y slots tras recarga. Los escenarios responsive existentes se adaptaron a la cuadrícula, pero no se ejecutaron por restricción expresa. Estos tests unitarios no constituyen certificación visual ni de tablet física.
- Validación final: typecheck, lint, build raíz y build Operator Console PASS; spec coverage (948 fuentes), BDD y cobertura modular PASS. Confirmación del componente tras ajustar su test a JSX automático: 2/2 PASS. Escaneo mecánico de layout sin hallazgos; no sustituye inspección visual/táctil. Build conserva advertencias de Browserslist y tamaño de chunks, sin desactivar controles. Sin Git, responsive, Docker ni deploy.

### Refinamiento autorizado — edición y fondo (2026-10-03)

- [x] Retirar manijas sobre tarjetas y widgets; tamaño únicamente desde el editor.
- [x] Eliminar el velo claro de la imagen, conservando la opacidad elegida y la paleta.
- [x] Reordenar en memoria durante hover dentro y entre secciones; confirmar una sola vez al soltar, sin intercambio adicional. Animación FLIP de tarjetas y secciones, respetando movimiento reducido.
- [x] Retirar fondo cuadriculado y recuadros de huecos en edición, conservando slots vacíos; fila adicional únicamente durante drag de sección.
- [x] Preview con superficie/presenter/binding de tarjeta real y cálculo compartido de tamaño, usando el ancho medido de su sección; área ocupada y filas manuales acotadas a 12 por defecto.
- [x] Cerrar menú del encabezado por pointer/foco fuera, sin alterar Escape.
- Evidencia de esta corrección: Jest focalizado **15/15 PASS, 4 suites**; typecheck, lint y build Operator Console (incluye `tsc -b`) PASS; controles de spec, BDD y cobertura modular PASS. Se actualizaron los escenarios existentes de tamaño para usar el editor en lugar de manijas y medir el frame real del preview, sin ejecutarlos. No se ha ejecutado responsive por prohibición expresa del usuario; los resultados responsive anteriores no validan esta corrección. No afirmar paridad completa con Home Assistant ni certificación visual/táctil física.

- [x] AC46–AC47: Trasladar contrato compartido y conversión pura desde la fase iniciada en otra copia; adaptar defaults, Sensor medio, Section de un slot y perfiles con huecos. Validado aquí con fixtures sintéticos, sin reutilizar resultados de `homepilot`.
- [x] AC48: Modelo en memoria/adaptador, cuadrícula interna de 12 columnas, ancho nuevo de sección y máximo de columnas, duplicación, paneles de edición con preview, filas explícitas y scroll, visibilidad local; conservar presenters, drag compartido, cancelación y geometría histórica.
- [x] AC49: Cola, rollback, undo/redo y transacción SQLite de revisión/actualización; validación de geometría, import/export y recarga conservando el sobre histórico (no persistir V2).

Implementación conectada al canvas de `homepilot-main-integration`. Adaptaciones documentadas: encabezado de Section no arrastrable, Añadir tarjeta flotante y long-press/superficie en vez de añadir otra asa. No modifica colores ni presenters. Validación final registrada a continuación; no se afirma certificación de hardware físico, Safari ni paridad literal con todas las funciones de Home Assistant.

### Cierre técnico local — 2026-10-03

- Jest focalizado: **135/135 PASS, 11 suites** (`readDashboardSections`, `DashboardSectionLayout`, `DashboardService`, `SQLiteDashboardRepository`, `validateDashboardGridOptions`, `DashboardRoutes`, `dashboardSectionsAdapter`, `sectionCardDrag`, `sectionSlots`, `cardGridResize`, `DashboardEditSession`). Confirmación adicional de la cola tras corregir sintaxis compatible con `erasableSyntaxOnly`: 4/4 PASS.
- Responsive focalizado durante desarrollo: 20 escenarios de edición, movimiento mouse/touch/teclado, cancelación, huecos, geometría, Clock y Media PASS; los tres escenarios nuevos de Sections PASS. Confirmación posterior a la pasada completa: tres escenarios Sections, asignación/ejecución real de luz y cuatro escenarios de paridad vista/edición **8 escenarios únicos PASS**. La paridad ahora exige igualdad de altura de Section y grid en escritorio, tablet, móvil y kiosco; no tolera el crecimiento que esperaba el test histórico. No se cambiaron assertions de skeleton. El fixture de luz incluye hogar/estancia existentes, sin eludir la elegibilidad operacional.
- Typecheck, lint Operator Console, build raíz y build Operator Console PASS. El primer build de consola detectó tres TS1294 por propiedades en parámetros del constructor; se sustituyeron por campos explícitos sin cambiar comportamiento. Build final conserva advertencias Browserslist y tamaño del chunk MDI.
- Spec coverage (946 fuentes), BDD (23 flujos), cobertura modular (10 módulos), i18n (1913 claves), arquitectura, no-production-any, política Tuya, validación estática de perfiles Docker y catálogo de respuestas Assistant PASS. No se ejecutó Docker.
- Revisión visual acotada conforme a Impeccable: edición móvil/escritorio y preview tablet; se corrigió el espaciado del footer del editor y se confirmó. No se alteraron tokens ni presenters. Los tamaños de fila explícitos pequeños ofrecen scroll interno; no escalan ni recortan el contenido original.

**Pasadas completas: una Jest y una responsive, ambas con fallos; no se presentan como verdes.**

- Jest completo: 332 suites (328 PASS / 4 FAIL), 3449 tests (3445 PASS / 4 FAIL). El fallo de `SQLiteDashboardRepository.test.ts` era el matcher de error nativo entre entornos Jest: se valida código/mensaje y rollback real; las cuatro suites SQLite relacionadas pasan juntas (19/19), y la suite está incluida en los 135/135 finales. No se reejecutó Jest completo.
- Otros fallos Jest: `AutomationBuilderActionSection.test.tsx` busca una entidad sin estancia válida en su fixture; `bootstrap.test.ts` espera un objeto sin el campo `sharedUserIds`; `MediaService.test.ts` produjo `Maximum call stack size exceeded` en la pasada completa, pero pasó focalizado sin caché. No se modificaron estas áreas. El último caso no se considera resuelto ni se atribuye con certeza a una causa.
- Responsive completo: **211 PASS / 68 FAIL, 279 escenarios, 23.6 minutos**. Cinco fallos pertenecían a pruebas de tablero actualizadas y confirmadas después: cuatro de paridad que buscaban el asa anterior/exigían crecimiento y uno de asignación de luz con topología incompleta. No se reejecutó responsive completo ni se recalcularon sus resultados como si hubiese pasado.
- Permanecen sin corregir 63 fallos de la pasada general, agrupados por escenario: Home personalization (8); Compact system presentation (3); Compact automation cards (7); Room devices (7); Room display and configuration (7); Compact device manager (7); Compact discovery and access (7); Compact scene cards (7); creación de iconos/identidades/acciones momentáneas de rutinas (3); Unified palette (5, se detienen buscando Editar en una escena, no en una assertion de color); visor de cámara/Escape (1); Automation lifecycle (1). Los nombres permiten seleccionarlos con `--grep`. Varias pruebas esperan Escape en Modal/Drawer con `dismissible=false`; otras usan textos o fixtures de topología/ownership desactualizados. No hubo una pasada base previa que permita atribuir categóricamente todos estos fallos a una única causa o fecha.
- `check:ui-primitives` FAIL por botones nativos en `HomeContextIndicator.tsx` y `HomeDashboardButton.tsx`, no modificados en esta implementación. No se desactivó el control.

La feature tiene evidencia focalizada, pero **no se recomienda release mientras la validación global siga fallando**. Sin Git/GitHub, deploy, migración SQL, reescritura V2 ni operaciones en bases reales. Las bases `test.api.db`, `test.audit.db` y `test.ws.db` pertenecen al entorno de tests; no se eliminaron artefactos que ya existían. La persistencia compatible permite a versiones antiguas ignorar opciones nuevas, no garantiza la nueva geometría al bajar de versión. Las opciones nuevas aplican a tarjetas dentro de Sections; widgets independientes históricos conservan sus controles de tamaño previos.

Evidencia local del traslado: 118/118 pruebas PASS en seis suites (`readDashboardSections`, `DashboardService`, `DashboardSectionLayout`, `sectionCardCatalog`, `sectionCardDrag`, `sectionSlots`). Typecheck, lint de consola, builds raíz/consola, spec coverage, BDD, cobertura modular, arquitectura y no-production-any PASS. El primer build raíz falló al escribir `dist` por EPERM; repetido con autorización fuera del sandbox finalizó correctamente. Build de consola conserva avisos Browserslist/chunk MDI. No responsive ni suites completas: no hay cambios del renderer. Se retiraron únicamente los cuatro archivos nuevos y los cinco cambios puntuales de esta fase que se habían introducido por error en `homepilot`. Sin Git, GitHub, Docker, deploy ni cambios en bases reales.

- [x] AC42 ampliado: decimales opcionales (enteros por defecto), escala fija incluso sin lectura y graduaciones estables. Evidencia: 133/133 Jest, 4/4 responsive focalizados junto a AC34; preview real, redondeo, lectura fuera de rango, ausencia, recarga/import-export y opción persistida. Typecheck/lint/builds raíz/consola y spec/BDD/módulos/i18n PASS. Capturas tablet revisadas; sin responsive completo, Git ni deploy.
- [x] AC42: escala Sensor opcional persistente, editor/preview y regresión focal.
  - Evidencia (2026-10-02): validación conjunta del refinamiento, 324/324 Jest y 21/21 responsive focalizados PASS; typecheck, lint y builds raíz/consola PASS. Escala guardada/importada y limpieza de límites cubiertas. Sin responsive completo, Git ni deploy.

## Ajuste tablet — densidad y llegada entre Sections

- [x] Eliminar altura mínima adicional y expansión flexible del centro Sensor; padding vertical 8px, cabecera 32px y separación interna 4px, manteniendo esfera, lectura/unidad y reserva de carga.
- [x] Conservar identidad de arrastre local al cambiar de Section para que la animación existente encuentre el nodo de llegada; sin cambios de ID persistido.
- [x] Comprobar preview sobre otra Section y animación real al soltar, sin ejecutar comandos físicos; cobertura de densidad computada con/sin lectura y ambos temas.

Evidencia final del ajuste: 73/73 Jest en cuatro suites SensorMetricCard/SensorAnalogGauge/DashboardCardSkeleton/sectionCardDrag; 10/10 responsive focalizados Sensor clarity, movimiento touch entre Sections y cuatro geometrías skeleton. Confirmación mouse/touch/teclado, cancelación y Section masonry 7/7 PASS (16 escenarios únicos en total). Typecheck, lint, builds raíz/Operator Console y controles spec/BDD/module/i18n/arquitectura/no-any PASS. Capturas `.impeccable/review/sensor-density-cross-drop/`, revisadas en tablet oscuro, móvil claro y overlay sobre destino. No responsive completo, Git/GitHub ni deploy; no certificación de tablet física.

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
- [x] AC45: visualizadores modulares, persistencia opcional, animación accesible y pruebas focalizadas; estabilidad de Clásico e importación de pestañas. Alcance autorizado, sin cambio de carcasa/backend.
- [x] AC45: diferenciar nivel de batería con depósito cilíndrico ancho, superficie de líquido y graduaciones; batería/termómetro conservados. Normalización/límites/proporción compartidos y clips únicos. 91/91 Jest, 4/4 responsive focalizados (móvil, tablet portrait/landscape, escritorio), typecheck/lint/builds y spec/BDD/module PASS. Preview oscuro tablet y claro móvil revisados; reduced-motion comprobado en todas las capas. Sin Git, deploy, nuevas dependencias ni suite responsive completa.

- [x] Refinamiento Sensor/drag: retirar Normal/punto verde/leyenda de escala, conservar advertencias y límites; presentación común de arrastre sin ampliación, destino destacado y 150 ms, con pruebas focalizadas.
- [x] Corrección tras revisión visual: eliminar reserva vacía Sensor/skeleton; trasladar la ausencia junto a la lectura. Previsualizar tarjetas entre Sections y Sections en slots antes de soltar, con reacomodo FLIP, copia de la superficie real y canvas, identidades estables, guardado único al soltar y rollback al cancelar. Contrastar con ha-sortable de Home Assistant sin sustituir la biblioteca.

Evidencia de la corrección: 69/69 Jest en cuatro suites SensorMetricCard/DashboardCardSkeleton/sectionCardDrag/sectionSlots; 19/19 responsive focalizados con traslado DOM previo al drop y sin escrituras, cancelación y restauración por teclado, slots/huecos/perfiles/solo lectura, cinco tamaños de Sensor claro/oscuro y cuatro geometrías skeleton. Typecheck, lint y builds raíz/consola PASS; spec/BDD/module PASS. Capturas tablet de sensor compacto, tarjeta entre Sections y Section elevada inspeccionadas en dos rondas acotadas. Sin Git, deploy, Docker, suites completas ni certificación de tablet física. Referencia: https://github.com/home-assistant/frontend/blob/dev/src/components/ha-sortable.ts.

Evidencia del refinamiento: 109/109 Jest en cinco suites SensorMetricCard/SensorVisualizers/DashboardCardSkeleton/sectionCardDrag/sectionSlots; confirmación final 17/17 responsive focalizados (Sensor, transferencias mouse/touch/teclado, Sections y skeleton geometry). Fixture de claridad activa decimales explícitamente; segundo movimiento por teclado espera fin del overlay y frame de restauración antes de enfocar. Typecheck, lint, builds raíz/consola y controles spec/BDD/module PASS. Capturas de preview claro, traslado táctil y Section elevada revisadas. Sin suite completa, Git, Docker, deploy ni certificación de tablet física.

Evidencia local: 181/181 Jest en seis suites SensorMetricCard/SensorAnalogGauge/SensorVisualizers/sectionCardCatalog/MediaPlayerPremium/DashboardService. Confirmación responsive 13/13: cuatro visualizadores responsive en móvil/tablet portrait/landscape/desktop, escala fija, cuatro geometrías skeleton (incluido kiosco portrait), transferencia/importación y media idle Premium/Clásico. Preview y recarga con lectura 22.4567 real de fixture, persistencia level, reduced-motion sin transición, controles y altura Clásico estables. Typecheck, lint sin advertencias, builds raíz/consola, spec/BDD/module/i18n PASS; detector sin hallazgos y capturas móvil claro/tablet oscuro revisadas. Sin Git, Docker, deploy, SQL/base real, suites completas ni certificación de tablet física.

Hallazgo fuera de alcance: al ampliar temporalmente el fixture Premium con duración/posición, su progreso condicional aumenta 24px. Se conserva su escenario previo sin duración; no se modifica Premium por una solicitud de estabilidad del Clásico. No se afirma que ese caso adicional esté corregido.
