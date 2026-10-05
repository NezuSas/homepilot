# Tareas — Modbus TCP local V1

## Acción momentánea PLC — AC39 (solo Fase 1 UI)

- [x] Clasificar output_command+pulse por metadatos existentes, reutilizando press y botones de acción, sin backend ni configuración real.
- [x] Adaptar tarjetas históricas al renderizar y ejecutar; pending, bloqueo inmediato, error traducido y retorno a listo sin pintar estado físico ni alterar actualState.
- [x] Validar regresiones sostenidas/físicas/acciones HA, ES/EN y responsive focal: 12 suites Jest, 354/354 PASS; cuatro escenarios AC39 móvil/tablet vertical/tablet horizontal/escritorio, 4/4 PASS con API simulada. Typecheck, lint, builds backend/frontend, spec, BDD, módulo, arquitectura, no-production-any e i18n PASS; detector UI sin hallazgos. Responsive reejecutado con permisos locales tras bloqueo del sandbox. Sin SQLite real, PLC físico, cambios de M100/M101, Git ni deploy. No suite global ni responsive completo ni Docker/runtime; no candidato a publicación. Advertencias de build existentes sobre tamaño de chunk y Browserslist.

## Estado de salidas individuales — AC38

- [x] Separar selección de estado físico y comparación del comando sin modificar destinos de escritura ni feedback independiente.
- [x] Control de dashboard basado en commandState, conservando la lectura física durante la ejecución; etiquetas ES/EN y RAW del comando explícito.
- [x] Validar casos divergentes, OFF, fallo físico, escrituras exclusivas, toggle, snapshot/dashboard, históricos y regresiones AC37: 9 suites, 355/355 PASS. Typecheck, lint, build backend/frontend, spec, BDD, módulo, arquitectura, no-production-any e i18n PASS; detector UI sin hallazgos. Sin SQLite real, PLC físico, Git ni deploy. No suite global/responsive completo (excluido por solicitud previa) ni Docker/runtime (evitar conexión a integraciones reales); no candidato a publicación. Primer intento detectó tipado opcional; corregido con rechazo explícito de lectura física ausente. Prueba histórica corregida para usar configuración válida, conservando cobertura del coil legacy sin binding.

## Relación declarativa de salidas — AC37

- [x] Añadir lista opcional al binding/JSON y validación por clasificación del perfil, sin migración ni cambios de servicios de ejecución.
- [x] Editor buscable con selección acumulativa, resumen y retirada individual; listado y ES/EN sin confirmación física.
- [x] Validar persistencia, compatibilidad, transporte simulado y responsive focal. 8 suites Jest: 345/345 PASS; 4 escenarios AC37 móvil/tablet portrait/tablet landscape/desktop, ES/EN y claro/oscuro: 4/4 PASS. Typecheck, lint, arquitectura, spec, BDD, módulo, no-production-any e i18n PASS. Sin configuración real, PLC físico, Git ni deploy; no responsive completo. Primer intento Playwright bloqueado por permisos del sandbox sobre artefactos; reejecución local autorizada PASS.

## Claridad manual V4 — AC26

- [x] Usar feedbackPolicy none como autoridad de etiquetas, incluso con metadatos históricos; sustituir «Confirmación» por «Política de feedback» y no presentar coincidencias cuando no hay lectura disponible. Cobertura de render y traducciones ES/EN; backend y bindings intactos.
- [x] Validación de esta corrección: PlcBindingEditor/plcUi, 48/48 tests PASS; escenario PLC I/O tablet portrait, 1/1 PASS con API simulada. Typecheck raíz/consola y lint PASS; controles spec/BDD/módulo PASS. Sin comandos físicos, cambios SQLite, Git ni deploy; no responsive completo.

- [x] Separar comandos/feedback por rol declarado sin inferir relaciones ni modificar JSON.
- [x] Distinguir lectura del comando de confirmación física; estado inicial del Probe sin prueba ejecutada.
- [x] Validación local: 10 suites Jest focalizadas, 317/317 PASS; dos escenarios Playwright seleccionados de tablet portrait (editor PLC y Read Probe), 2/2 PASS con API simulada. Typecheck raíz/consola, lint y controles spec/BDD/módulo PASS. Sin PLC físico, Git ni deploy. No responsive completo ni certificación de configuración desplegada.
- [ ] Corregir X1 y deduplicar M200/Y0: pendiente de base real y referencias verificables (base local inspeccionada sin tablas Modbus).
- [ ] Confirmar función de M100/M101: falta Ladder correspondiente; no reclasificar por nombre.

## Refinamiento de jerarquía AC35

- [x] Separar Entradas/Salidas/Variables con iconos/conteos de paleta vigente y roles explícitos, sin modificar datos ni ejecución.
- [x] Agrupación pura/inmutabilidad cubierta en PlcBindingEditor.test.tsx; cuatro escenarios PLC I/O commissioning PASS (móvil, tablet portrait/landscape, desktop), con mocks locales y sin PLC físico.

## Polling prioritario por tablero — AC36 (2026-10-04)

- [x] Obtener IDs declarados mediante puerto de repositorio y JSON existente; sin acceso SQLite desde aplicación ni nuevo endpoint navegador.
- [x] Ordenar variables del tablero primero y permitir ciclos de 1000 ms sin adelantar lecturas ordinarias; objetivo sujeto a latencia/colas, no tiempo real duro.
- [x] Conservar serialización, backoff, conexión deshabilitada y validación de hogar, sin modificar escritura/feedback/actualState.
- [x] Tests: prioridad/orden/cadencia, retirada de binding, bindings anidados exactos y prefijados, backoff, deshabilitado y ausencia de solapamientos; regresión protocolos/perfiles/rutas con simuladores locales.
- [x] Sin migración SQL ni configuración reescrita. Al instalar/revertir: backup de SQLite y reconstrucción API + UI; no deploy ni PLC físico en esta tarea.
- [x] Aplicar cada evento PLC válido en el store existente antes del batching React, sin refetch global; proteger hogar, timestamps, sesión y carrera con snapshots. Jest del store y escenario navegador PLC dashboard realtime PASS.

Validación focalizada AC36/AC54: 12 suites Jest, 427/427 PASS; 16 escenarios responsive únicos PASS (editor en cuatro tamaños, visualizadores, escala, ancho, geometría skeleton inicial, reloj y realtime PLC). Sin suites completas ni hardware físico. Un intento responsive bloqueado por permisos de artefactos Vite se reejecutó autorizado y pasó.


## Presentación y navegación — AC35 (2026-10-03)

- [x] Centralizar formato visual con máximo dos decimales; conservar RAW y precisión de dominio para reglas y comandos.
- [x] Compactar campos físicos/comando, reutilizar catálogos tipados y explicar salida física y feedback independiente.
- [x] Mostrar conexiones resumidas con número de variables y navegación a detalle; skeleton específico de resumen.
- [x] Conservar API, JSON, perfiles y políticas de escritura/confirmación; ninguna conexión al PLC físico.
- [x] Validación conjunta: 429/429 Jest en 13 suites; 22/22 escenarios responsive focalizados únicos (PLC, regresión Modbus, volumen y reloj). No suites completas.
- [x] Revisar captura de formulario tablet claro. La salida física identifica el canal: solo el feedback explícito indica dónde sondear la confirmación; no se infiere del comando.


## UX localizada de Salidas — AC34 (2026-10-03)

- [x] Salida física editable y destacada antes de un único Comando PLC; etiqueta Entrada física para el rol de entradas.
- [x] Reutilizar el campo principal y su resolución existente: command se deriva al guardar; editar physical no modifica command ni crea feedback.
- [x] Conservar roles, permisos, estancia, none/sustained, perfiles V1/V2 y estructura JSON histórica; sin cambios de backend, transporte, persistencia o state sync.
- [x] Jest focalizado: 7 suites, 282/282 PASS; editor, contratos PLC, perfiles/bindings/conversión y servicio/cliente TCP simulado.
- [x] Responsive focalizado `Feature: PLC I/O commissioning`: 4/4 PASS, móvil, tablet portrait/landscape y desktop, ambos temas; edición/recarga, cambio de command, cambio aislado de physical y ausencia de feedback inferido.
- [x] Typecheck, lint Operator Console, i18n y controles spec/BDD/cobertura de módulos PASS. Detector UI sin hallazgos y revisión de capturas móvil oscuro/escritorio claro.

Primer arranque responsive bloqueado por EPERM al escribir el temporal de Vite; reintento autorizado con permisos de ejecución correcto, sin cambiar configuración. Sin responsive completo, Git, deploy ni conexión al PLC físico. Evidencia visual en los artefactos `plc-output-no-feedback-*.png` de `apps/operator-console/test-results/`. Esta mejora no implementa la Fase 2.

## Frontera arquitectónica — Fase 1 (AC33)

- [x] Definición interna pequeña; catálogo estático y políticas/resolución/capacidades encapsuladas en Xinje.
- [x] Validadores consultan perfil/segmento sin prefijos, IDs o límites modulares del fabricante.
- [x] Conservar mapas, V1/V2, escrituras, bindings coil y JSON; sin tocar transporte, actualState ni confirmación.
- [x] Pruebas focalizadas: 352/352 PASS en 10 suites, incluidos JSON históricos sin reescritura, 16 expansiones Y y regresión de UI/state sync/assembly.
- [x] Typecheck raíz/consola y checks de spec, BDD, cobertura de módulo, arquitectura y no-production-any PASS.
- [ ] Fase 2: UI metadata-driven y revisiones internas sin versiones comerciales; requiere autorización posterior.

No migración, nuevos fabricantes, plugins, Git/GitHub, Docker, deploy ni PLC físico. Pruebas TCP solo loopback y bases SQLite temporales. Reversión al binario previo compatible con V1/V2 sin transformar JSON. La firma interna validateModuleCapacities recibe profileId; ningún contrato API cambia.

## Cierre PLC I/O aprobado — 2026-10-03

## UI final de instalador aprobada — AC28–AC32

- [x] AC28: conexión/diagnóstico real y errores traducidos, refresh sin solapamientos.
- [x] AC29: editores semánticos con técnica avanzada y outputs/pulse claros.
- [x] AC30: visualStyle JSON opcional y SensorMetricCard compartido sin alterar históricos/overrides.
- [x] AC31: setpoint actual/objetivo/unidad/confirmación y límites de consumidores documentados.
- [x] AC32: tests UI/dominio/regresión y responsive PLC focal, checks y documentación modular.

La trazabilidad de esta fase es local por excepción explícita del usuario; no usar GitHub. Sin condiciones nuevas de Scenes ni parámetros nuevos de acciones de Automatizaciones.

Evidencia UI final: 611/611 Jest en 30 suites focalizadas; 18/18 responsive focalizados y confirmación final PLC I/O 4/4 PASS. Typecheck, lint y builds raíz/consola PASS. Revisión independiente corrigió disponibilidad incoherente ante error de conexión y contraste de avisos PLC, sin modificar el componente AlertBanner global. Capturas finales: `.impeccable/review/plc-ui-confirmation/`. Detalles y límites operativos: `docs/modbus-plc-ui-closeout.md`. Sin suites completas, hardware PLC, SQL adicional, Git, Docker ni deploy.

- [x] AC19: enforcement Admin backend con AuthGuard real y hogar.
- [x] AC20/AC24: roles/bindings JSON compatibles, perfil v2 y políticas explícitas de escritura.
- [x] AC21/AC22: feedback independiente y pulsos acotados con fallo de reset visible.
- [x] AC23: encoder inverso y FC06/FC16 simulados.
- [x] AC25: errores parciales y diagnóstico efímero sobre polling existente.
- [x] AC26: editor/listado modular PLC I/O, estancia, skeleton, i18n y responsive focalizado.
- [x] AC27: E2E PLC simulado/state sync y regresión focalizada; typecheck/lint/builds/trazabilidad.
- [ ] Verificación física separada del mapa/Ladder/watchdog: no autorizada en esta tarea.

### Evidencia del cierre PLC I/O — 2026-10-03

- Jest focalizado: 30 suites, 556/556 PASS. TCP real en loopback simulado y SQLite temporal; incluye persistencia tras reabrir repositorio, AuthGuard real, command→feedback independiente, entrada X0, reset de pulso, límites/codec FC06/FC16, aislamiento de excepciones/conversión y motor ensamblado con EventBus/state sync. Regresión focal de Scenes, Assistant, Sonoff, comandos y servidor.
- Responsive focalizado: 22/22 PASS con `PLC I/O commissioning|PLC address profiles|Modbus commissioning|Native Modbus configuration|Safe Modbus deletion|Modbus table refinement`. Tras el ajuste final de claridad solicitado/real, únicamente PLC I/O: 4/4 PASS; mismos cuatro tamaños, ambos temas, persistencia, escritura autorizada y estado divergente explícito. Sin responsive completo.
- Typecheck, lint Operator Console y builds raíz/consola PASS. Spec/BDD/módulos/i18n/arquitectura/no-production-any y políticas estáticas Tuya/Docker PASS; el check estático Docker no ejecuta Docker.
- Detector UI ejecutado una vez: sin hallazgos. Capturas finales de listado/editor: `.impeccable/review/plc-io/`. Revisión fresca encontró un P2 de claridad solicitado/real; se corrigió con etiquetas separadas y dos pruebas pending/unconfirmed.
- Sin SQL adicional, base real, red PLC física, Git/GitHub, Docker o deploy. V1 inmutable; V2 solo autoriza setpoints D/HD limitados con opt-in. Antes de MiniPC: backup y revisión Ladder/watchdog; un proceso caído no puede garantizar OFF.
- Alcance compatible: no se añaden precondiciones a Scenes ni acciones parametrizadas de setpoint al editor de Automatizaciones. Comparaciones numéricas opcionales conservan igualdad histórica. Diagnóstico efímero, sin historial persistente de latencia.
- Warnings no bloqueantes: Browserslist antiguo, chunks grandes existentes, WebSocket sin servidor en fixture y aviso Jest de salida tardía; proceso final termina con código 0. No se presenta evidencia focal como aprobación de release/hardware.

- [x] AC18: eliminación confirmada Admin/hogar, conflictos por variables/referencias, cola compartida y región de tabla fija. Evidencia: 212/212 Jest Modbus/API, 4/4 responsive focalizados (tabla móvil/tablet/escritorio y eliminación tablet); typecheck, lint y builds raíz/consola PASS. Spec/BDD/módulos/i18n/arquitectura/no-production-any PASS; capturas revisadas y detector sin hallazgos. Sin SQL nuevo, base real, escritura física, suites completas, Git o deploy. La comprobación responsive usa navegador de escritorio con tamaños tablet/móvil, no certifica gestos de Safari en hardware físico.

- [x] AC16/AC17: tabla fija/filtros locales, unidades modulares y edición numérica segura; responsive focalizado.
  - Evidencia (2026-10-02): validación conjunta, 324/324 Jest y 21/21 responsive focalizados PASS; typecheck, lint y builds raíz/consola PASS. Tabla en móvil/tablet/escritorio y ambos temas revisada visualmente; filtros conservan el bloque completo para conversión de 32 bits. Sin conexión/escritura a PLC físico, migración SQL adicional, responsive completo, Git ni deploy.

## Perfiles PLC autorizados

- [x] AC11/AC12: resolver genérico versionado y mapa Xinje octal/capacidades físicas.
- [x] AC13: metadatos JSON compatibles y validación backend de resolución.
- [x] AC14: modo perfil modular en probe/editor; discovery readonly y áreas protegidas.
- [x] AC15: pruebas focalizadas, responsive, tipos/lint/build y documentación.

- [x] Alcance, compatibilidad, seguridad y reversión aprobados/documentados.
- [x] AC1/AC6: repositorio SQLite y migración aditiva con inventario transaccional.
- [x] AC2: validación de configuración, autorización Admin/hogar y rutas modulares.
- [x] AC3: cliente TCP con pruebas de PLC simulado y decodificación.
- [x] AC4/AC5: driver compartido, polling, backoff y lifecycle.
- [x] AC7: configuración modular Sistema, traducciones y skeleton específico.
- [x] Validación focalizada, typecheck, lint/build y controles de trazabilidad.
- [ ] Verificar mapa/firmware/puerto del PLC real con autorización separada; fuera de validación simulada.

## Evidencia local — 2026-10-02

### Evidencia de perfiles PLC — 2026-10-02

- Jest focalizado: 8 suites, 238/238 PASS; incluye mapas octales y expansiones, capacidades físicas, resolución y persistencia JSON, protección de escrituras, decoder compartido y cliente TCP en loopback simulado, rutas y regresión de comandos/servidor.
- Responsive focalizado `PLC address profiles|Modbus commissioning|Native Modbus configuration`: 14/14 PASS. Tras el último ajuste se repitió únicamente `PLC address profiles`: 4/4 PASS. Móvil, tablet portrait/landscape y desktop, ambos temas; símbolos, resolución, RAW/conversión, creación y recarga. Sin responsive completo.
- Typecheck, lint de Operator Console, build raíz y build de Operator Console PASS. Spec coverage, BDD, cobertura por módulo, arquitectura, no-production-any, i18n y políticas estáticas Tuya/Docker PASS; no se ejecutó Docker.
- Capturas finales en `.impeccable/review/plc-profiles/`; revisión visual fresca SHIP. Componentes modulares y paleta existente conservados.
- Sin migración SQL adicional, modificación de base real, Git/GitHub, deploy ni conexión/escritura al PLC físico. El mapa corresponde al alcance aprobado; no certifica firmware ni canales físicos. Byte-order dentro de cada registro fijo big-endian; wordOrder high_first/low_first configurable. Modo genérico sin perfil conservado.

### Ampliación puesta en marcha autorizada

- [x] AC8: lectura de bloque acotada, autorización y cancelación, sin efectos persistentes/escrituras.
- [x] AC9: UI Probar lectura/refresco/Detener/tabla/creación desde registro probado.
- [x] AC10: decodificador común uint32/int32, conversión y persistencia compatible.
- [x] Jest y responsive focalizados del asistente, typecheck/lint/builds y trazabilidad.

### Evidencia de puesta en marcha — 2026-10-02

- Jest focalizado: 7 suites, 136/136 PASS (101 Modbus y 35 regresión). Cobertura de conversión común, bloques RAW, permisos, entradas inválidas sin red, cancelación, cola compartida con polling y persistencia de tipos nuevos.
- Responsive focalizado `Modbus commissioning|Native Modbus configuration`: 10/10 PASS en la ejecución final; cuatro tamaños y ambos temas, creación desde lectura real del fixture, persistencia readonly, refresco sin solapar, RAW anterior tras fallo y Detener sin nuevas solicitudes. Sin suite responsive completa.
- Capturas finales de formulario y resultados en `.impeccable/review/modbus-commissioning/`; indicación horizontal persistente vinculada a la región de tabla accesible por teclado.
- Typecheck, lint, build raíz y build de consola PASS. Spec coverage, BDD, cobertura por módulo, arquitectura, no-production-any e i18n PASS. Revisión visual fresca SHIP tras resolver la navegación horizontal de resultados; documentos modulares actualizados.
- Sin migración SQL adicional. Los tipos uint32/int32 requieren convertir configuración o restaurar backup para downgrade al binario anterior. No se validó un PLC físico ni se ejecutaron Git/GitHub, Docker o deploy.

- Jest focalizado: 6 suites, 102/102 PASS (67 Modbus y 35 regresión de comandos/servidor). Cliente TCP únicamente en loopback simulado; SQLite temporal aislada.
- Responsive `Native Modbus configuration`: 5/5 PASS, móvil, tablet portrait/landscape, desktop, claro/oscuro y navegación no-Admin. Guardar completamente visible después del scroll interno del formulario móvil. Capturas asentadas en `.impeccable/review/modbus-v1/`.
- Typecheck, lint de Operator Console, build raíz y build de Operator Console PASS; spec coverage, BDD, cobertura por módulo, i18n, límites de arquitectura y no-production-any PASS.
- No Jest completo, responsive completo, Docker, Git/GitHub ni deploy. Sin conexión ni comandos al PLC físico. Warnings no bloqueantes: Browserslist desactualizado y tamaño de chunks existentes; WebSocket de realtime sin servidor en fixtures responsive.
- Revisión visual fresca: SHIP para la UI Modbus, tras corregir contraste heredado y repetir capturas asentadas; no equivale a aprobación de release/hardware. Documento modular `docs/components/ModbusConnectionCard.md`. La altura táctil heredada de Input/Toggle no se rediseñó globalmente.
- Antes de instalar en MiniPC: backup SQLite, verificar mapa/firmware/puerto y aislamiento LAN, reconstruir API + UI. No se certifica hardware a partir del simulador.
## Refinamiento visual de conexiones y detalle — AC40

- [x] Listado compacto, controles contextuales, grupos buscables, orden natural, filtro de errores y vacío sin escrituras. Pruebas nuevas verifican no mutación/callbacks y ausencia de solicitudes de escritura al navegar/filtrar.
- [x] Traducciones, skeleton específico y regresión de estados físicos/comando: 62/62 Jest focalizados PASS; 8/8 responsive focalizados PASS (4 AC40 y 4 PLC I/O), confirmación final AC40 4/4 PASS tras compactación móvil. Cuatro tamaños, ES/EN y ambos temas para AC40, con datos simulados. Typecheck raíz/consola, lint y builds raíz/consola PASS; spec/BDD/módulos/i18n/arquitectura PASS, detector layout sin hallazgos. Capturas revisadas en test-results. Sin suite global ni responsive completo (restricción del usuario); sin Docker/runtime para evitar arrancar integraciones físicas. Sin Git, deploy, SQLite real ni comandos PLC. Advertencias existentes de Browserslist/chunks y WebSocket sin servidor en fixtures. No candidato a release ni certificación en tablet física.
