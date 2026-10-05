# ModbusConnectionCard

AC40: resumen compacto con endpoint host:puerto, modelo y conectividad/habilitación en una línea. Detalle usa SegmentedControl de grupos no vacíos con conteos, búsqueda local por nombre/ID/símbolos/PDU (incluye puntos relacionados) y filtro de errores diagnósticos. Orden natural por physical/símbolo/nombre, sobre arrays derivados, sin modificar la configuración. Selección y búsqueda sobreviven al refresh; si desaparece el grupo seleccionado se presenta Todo. Grupos sin resultados no añaden bloques vacíos. Advertencia de ausencia de feedback una vez por grupo visible, manteniendo información de feedback en cada fila. Estados solicitado/comando/físico siguen separados y se distribuyen en línea cuando caben. Añadir variable arriba, Añadir conexión solo en listado. Diagnóstico conserva RAW del comando y versión del perfil en detalle técnico. Controles reutilizados de 44px y skeleton específico; sin cambios de transporte, datos, permisos ni ejecución.

AC37: los comandos con `relatedPhysicalOutputs` muestran Salidas relacionadas (símbolos separados) y, sin feedback, Estado leído del comando. La lista es metadata declarativa: no se utiliza como lectura, escritura, actualState ni feedback. No se agrega estado mixto/agregado. Los bindings históricos y los destinos singulares mantienen su presentación existente; no se configura M100/M101 automáticamente.

AC26: la política `none`, no la presencia/ausencia de una dirección, determina la terminología sin confirmación física. El mapper UI `plcStatusLabel` conserva los estados internos y cambia solo las etiquetas: coincidencia con lectura del comando, lectura pendiente, coincidencia no verificada, o sin lectura actual si no está disponible. Reset/pulso mantienen su mensaje operativo; optional/required mantienen la presentación existente. No cambia bindings ni ejecución.

Refinamiento AC26/AC35 (manual V4): el detalle presenta Entradas/Salidas/Comandos PLC/Feedback independiente/Variables, con iconos y conteos. La clasificación usa únicamente el rol guardado: no deduce relaciones Ladder por símbolo o nombre ni reclasifica históricos. Comandos sin feedback independiente muestran «Estado leído» y, si el estado interno es confirmed, «Coincide con la lectura del comando», no confirmación física. El estado interno, los contratos, precisión, permisos y ejecución no cambian. Physical sigue siendo un binding declarado, no prueba de actuación física; una configuración errónea requiere verificar el Ladder antes de corregirla.

AC35: optional `onOpen` renders the compact connection summary (variable/OK/error counts), without variable rows or commands. ModbusView opens the selected connection locally and provides a back action, keeping polling and refresh unchanged. Summary skeleton mirrors that composition. Numeric values share formatMeasurement (maximum two displayed decimals); underlying diagnostics/RAW are unchanged.

Refinamiento AC17: números de configuración con NumberInput, borradores vacíos editables y restricciones nativas. MeasurementUnitSelect conserva unidades históricas desconocidas. El cierre es explícito mediante Cancelar/cerrar.

Referencia local de la configuración Modbus TCP de Sistema. Implementación: `apps/operator-console/src/components/ModbusConnectionCard.tsx`; composición y formularios: `apps/operator-console/src/views/ModbusView.tsx`. Contrato aprobado: [Integración Modbus TCP local V1](../../specs/modbus-tcp-local-integration-v1.md), especialmente AC1, AC2, AC7 y AC11–AC15.

## Propósito y límites

Modo **Operate**: mostrar conexiones, valores observados, roles PLC y bindings explícitos para que Admin configure y diagnostique la integración local. Habilitar indica polling configurado; Online, No disponible y Esperando lectura proceden del diagnóstico. Probar comando abre confirmación para variables PLC escribibles mediante la ruta común Device. Inventario, asignación a estancia y widgets conservan sus flujos existentes.

Esta extensión conserva los tokens y controles de HomePilot. `index.css` y los componentes compartidos son la autoridad visual existente; este documento no establece un sistema global ni crea `PRODUCT.md`, `DESIGN.md` o sidecars de Impeccable.

## Contrato del componente

`ModbusConnectionSummary` combina conexión y variables con diagnóstico opcional. La tarjeta lee el estado de Devices del store existente, priorizando el diagnóstico recibido sobre el snapshot.

| Prop | Tipo | Responsabilidad |
| --- | --- | --- |
| `connection` | `ModbusConnectionSummary` | Nombre, host, puerto, Unit ID, habilitación y variables de la conexión. |
| `onEdit` | `() => void` | Solicitar que la vista abra el editor de conexión. |
| `onAdd` | `() => void` | Solicitar que la vista abra una variable nueva para esta conexión. |
| `onVariable` | `(variable: ModbusVariable) => void` | Solicitar el editor de la variable seleccionada. |
| `onCommand` | `(variable: ModbusVariable) => void`, opcional | Abrir [PlcCommandDialog](PlcCommandDialog.md). |

La tarjeta no consulta API, no mantiene formularios y no controla autorización. `ModbusView` conserva conexiones, carga, errores, editor y formularios en estado local; reutiliza `useDeviceSnapshotStore` para obtener el primer hogar y refrescar el inventario, sin crear otro store global. Los cambios se guardan mediante `apiFetch`; después se recargan conexiones y snapshot.

## Composición y apariencia

Cada sección tiene nombre accesible igual al de conexión, título de nivel 2, icono Cable decorativo, host/puerto, Unit ID y estado textual. PLC I/O agrupa variables por rol y conserva el grupo histórico sin binding. Filas muestran nombre, símbolo, permiso y relaciones explícitas de comando, salida física, lógica y feedback. Con `commandedState`, **Estado solicitado** y **Estado real** aparecen separados: ON solicitado con feedback OFF conserva la divergencia y confirmación pendiente/no confirmada. Sin lectura válida aparece Esperando lectura o No disponible según habilitación, diagnóstico y Device.

PDU, tipo, word order, RAW, latencia, última lectura y error quedan en el desplegable técnico. Configurar y Probar comando tienen nombres accesibles por variable. Probar comando requiere writable, binding PLC y callback; se deshabilita con conexión deshabilitada. Añadir variable permanece al final; el vacío tiene ayuda breve. El skeleton propio replica los grupos/filas PLC y solo sustituye la carga inicial. La vista refresca resúmenes cada cinco segundos sin añadir polling de dispositivos.

Se reutilizan superficie de tarjeta, borde semántico, radio de sección y padding (16 px). Texto principal y modal fijan explícitamente `text-card-foreground` para conservar legibilidad en claro/oscuro; metadatos utilizan el token de texto atenuado y el icono utiliza el primario. La tarjeta no añade sombra propia. Nombres y direcciones pueden partirse y los contenedores permiten encogerse.

La vista muestra una columna de conexiones en móvil y tablet estrecha, y dos desde `lg`; separación entre tarjetas (16 px). La cabecera de tarjeta apila contenido en pequeño y distribuye resumen/acciones desde `sm`. Las filas de variables permiten envolver acciones. Formularios usan una columna en pequeño y dos desde `sm`, con errores, toggles y acciones ocupando todo el ancho. El modal compartido tiene máximo `max-w-xl`, cabecera alineada al inicio y contenido desplazable dentro del viewport.

Los botones principales de configuración utilizan tamaño `lg`, con altura mínima (44 px). Input/NumberInput y selector normal comparten 44 px; ToggleSwitch conserva 32 px por defecto. No se declara objetivo táctil uniforme para todos los controles ni se modifica ToggleSwitch.

## Editores y estados

- **Carga inicial:** `ModbusSettingsSkeleton({ label, className? })` envuelve dos `ModbusConnectionCardSkeleton()` y un placeholder de cabecera en `LoadingState`. El skeleton pertenece a esta superficie, no sustituye tarjetas ya cargadas al refrescar.
- **Vacío:** `EmptyState` presenta título y ayuda si no hay conexiones y no existe error. Añadir conexión está deshabilitado cuando no hay hogar.
- **Error de carga:** `AlertBanner` peligro con Reintentar. Si había conexiones, sus datos se conservan mientras se informa el fallo.
- **Edición:** `Modal`, `Input`, `SearchableSelectField`, `ToggleSwitch` y `Button` compartidos. La apertura limpia el error anterior y copia la configuración actual o defaults.
- **Guardado:** envío POST/PUT, botón Guardar con carga y Cancelar deshabilitado; el cierre del editor se ignora mientras `busy`. Fallos muestran un aviso dentro del formulario y conservan el editor. Éxito cierra y refresca.

Conexiones nuevas: deshabilitadas, puerto fijo de solo lectura (502), Unit ID (1), timeout (2000 ms) e intervalo (5000 ms). Los campos indican límites de Unit ID (1–247), timeout (250–10000 ms) e intervalo (1000–60000 ms); el backend mantiene la validación autoritativa.

Variables genéricas nuevas: holding register, dirección (0), `uint16`, escala (1), offset (0), orden `high_first` y escritura desactivada. Área coil/discrete input fija tipo boolean; registros ofrecen `uint16`, `int16`, `uint32`, `int32` y `float32`. Cambiar área restablece tipo, escritura, escala y offset. Campos escala/offset/unidad solo aparecen en tipos numéricos y orden de palabras en `uint32`, `int32` y `float32`. Dirección PDU cero-basada: máximo (65535), o (65534) para esos tipos de dos registros. Una ayuda explica que 32 bits ocupan dos registros, con bytes big-endian fijos y orden de palabras seleccionable. El permiso de escritura genérico aparece en coils y exige activación explícita.

La acción Probar lectura de la cabecera abre [ModbusReadProbe](ModbusReadProbe.md). Desde una fila válida se abre este mismo editor con dirección, área y conversión precargadas y `writable=false`; una conexión nueva se guarda deshabilitada y la variable solo se persiste al confirmar Guardar en el editor.

## Perfiles y capacidades

Los editores reutilizan [ModbusAddressFields](ModbusAddressFields.md): selector genérico/perfil, entrada simbólica con preview área/PDU y configuración opcional de capacidad. El catálogo inicial es Xinje XL5E-16T v1 (`xinje-xl5e-16t-v1`), con ID versionado inmutable; futuras versiones requieren otro ID. El perfil es un mapa explícito de software, no una detección de firmware o certificación del PLC.

Una conexión puede guardar `profileId` y `moduleCapacities` para CPU o expansiones 1–16, con entradas/salidas enteras 0–64. El switch de capacidad conocida inicializa ambos valores en 0; desactivarlo elimina la declaración de ese módulo. Una capacidad ausente indica espacio reservado y no demuestra 64 canales físicos. Cambiar a genérico en el editor de conexión elimina capacidades del formulario.

Una variable nueva toma el perfil de la conexión y propone D0. El selector del editor permite también configurar genérico o perfil por variable. Seleccionar perfil propone holding register/PDU 0, D0 y `uint16`, y desactiva escritura. Los símbolos usan índices decimales salvo X/Y octales estrictos. Cambiar símbolo válido recalcula área/PDU, adapta el tipo bit/registro y desactiva escritura; el preview inválido muestra aviso sin reutilizar una resolución anterior. Al guardar se vuelve a resolver con las capacidades de la conexión. El backend valida la concordancia de perfil/símbolo con área/PDU y la segunda palabra de los tipos de 32 bits dentro del mismo segmento. Reducir capacidad de conexión se rechaza si invalidaría variables existentes.

El perfil v1 permanece inmutable y conserva opt-in M/Y/HM. El perfil separado `xinje-xl5e-16t-v2` permite además D/HD únicamente como setpoints explícitos y limitados. X y áreas protegidas siguen bloqueadas. La UI exige rol setpoint para escritura de holding registers y solo ofrece opt-in PLC para output, output_command y setpoint; backend valida perfil, segmento, tipo y límites. Seleccionar perfil, símbolo o rol reinicia escritura a false. Las variables genéricas conservan la política histórica de coils; bindings PLC escribibles requieren perfil. [PlcBindingEditor](PlcBindingEditor.md) documenta las relaciones.

Crear desde probe conserva perfil/símbolo/resolución/conversión y abre el editor normal con `writable=false`. Si reutiliza conexión por host/Unit ID, sus capacidades guardadas y habilitación se conservan. Los metadatos opcionales se guardan en JSON existente sin SQL nuevo; las configuraciones genéricas históricas siguen funcionando. Realizar backup antes de instalar o revertir: un editor anterior puede perder metadatos al guardar aunque preserve área/PDU. Las variables con tipos nuevos también requieren la preparación de downgrade descrita en [ModbusReadProbe](ModbusReadProbe.md).

## Accesibilidad e internacionalización

Los iconos de tarjeta y botones se ocultan del árbol accesible. La sección nombrada y la lista permiten navegar cada conexión y variable. Los textos visibles de botones identifican acciones; el botón por variable incorpora su nombre en `aria-label`. No se transmite habilitación o escritura solamente por color.

`Input` vincula etiqueta, campo y ayuda mediante IDs; los campos requeridos y límites numéricos usan semántica nativa. `ToggleSwitch` proporciona `role="switch"`, `aria-checked`, etiqueta y foco visible. `Modal` aporta `role="dialog"`, `aria-modal`, título/descripción relacionados y el comportamiento de foco del overlay compartido. El error de guardado es `role="alert"`.

`LoadingState` anuncia carga con `role="status"`, `aria-live="polite"`, `aria-busy` y etiqueta traducida; sus barras se ocultan a tecnología asistiva. La animación de pulso solo se aplica cuando el usuario permite movimiento. El skeleton de tarjeta aislado es visual: el anuncio accesible lo proporciona su contenedor.

La superficie obtiene copy de `modbus.*`, `plc.*` y `common.loading` mediante `react-i18next`. Nombres configurados, host, direcciones y códigos técnicos de tipo son datos, no copy traducido. Las áreas y permisos sí usan traducciones; las acciones por variable interpolan su nombre.

## Frontera de seguridad

La ruta `/system/modbus` y navegación son exclusivas de Admin; esta restricción pertenece a la composición de aplicación, no a la tarjeta. El servidor debe verificar rol y pertenencia al hogar en cada operación. La UI no reemplaza RBAC ni la validación de IP privada RFC1918, puerto, cantidades, tipos o límites de dirección.

Guardar configuración no prueba conexión ni escribe físicamente; habilitar inicia polling existente. Coils autorizadas y setpoints D/HD de v2 explícitos usan comandos comunes de Device. Probar comando exige confirmación separada y nunca usa Read Probe, exclusivamente de lectura. Segmentos protegidos siguen bloqueados. Eliminar usa confirmación modular y devuelve conflicto ante referencias persistentes. No hay descubrimiento automático. Backup antes de instalar/revertir: downgrade no recupera eliminaciones ni garantiza conservar bindings nuevos.

Configuración y diagnóstico requieren autenticación, acceso al hogar y Admin reales en backend. Las relaciones PLC se persisten como metadatos JSON opcionales sin SQL nuevo; no se deduce Ladder ni correspondencia M/X/Y. Último diagnóstico/comando/confirmación son efímeros en memoria, sin historian. Seguridad física, cableado, interlocks y watchdog pertenecen a la operación del PLC. El comando no certifica actuación física.

Las direcciones se introducen como PDU explícita en genérico o se resuelven mediante el perfil seleccionado. No se infiere notación 40001 ni firmware. La verificación posterior del mapa contra el equipo real es un requisito operativo pendiente. Permisos de HomePilot no proporcionan autenticación/cifrado a Modbus TCP ni reemplazan segmentación LAN y seguridades del PLC.

## Evidencia de validación y alcance

Evidencia histórica de perfiles: 238 pruebas Jest en ocho suites, 14 escenarios responsive focales y cuatro recapturas aprobadas; revisión sobre 16 capturas en `.impeccable/review/plc-profiles`. Es anterior al cierre PLC I/O.

Para el cierre PLC I/O, el coordinador reportó 30 suites Jest y 556/556 pruebas; responsive Modbus 22/22 y final PLC 4/4; typecheck, lint, builds y controles de specs, BDD, módulo, i18n (1981 claves), arquitectura, any, Tuya y perfiles Docker estáticos aprobados. Detector ejecutado una vez sin hallazgos. Revisión fresca pass/SHIP limitada al fix P2 de Estado solicitado/Estado real, con 16 capturas en `.impeccable/review/plc-io` y ocho del listado actualizado ON solicitado/OFF real. Esta documentación atribuye esa evidencia al coordinador sin repetir pruebas. Informe completo: [Cierre PLC I/O](../modbus-plc-io-closeout.md).

`apps/operator-console/tests/responsive-shell.spec.ts` cubre configuración genérica y de perfil en móvil (390×844), tablet vertical (768×1024), tablet horizontal (1024×768) y desktop (1440×900): creación deshabilitada, dirección manual/simbólica, variable de lectura, opt-in permitido, persistencia tras recarga, modal dentro del viewport, acción Guardar visible y ausencia de overflow global en claro/oscuro. El escenario de no Admin verifica que navegación directa no solicita configuración ni ofrece la ruta/acción. Las pruebas de API y servicio cubren permisos, resolución, capacidad y protección de escritura; el componente no los demuestra por sí solo.

No se ejecutaron suites completas, matriz responsive completa ni pruebas con PLC físico, firmware o base real; tampoco despliegue. La evidencia focal no constituye autorización de publicación, validación del mapa físico ni certificación completa de accesibilidad táctil.

## Extensión UI de instalador — AC28–AC32

La habilitación aparece separada de la conectividad: habilitada no confirma comunicación. `plcConnectionKey` muestra conectada con diagnóstico `online`, desconectada con `unavailable`, reconectando únicamente si ese diagnóstico incluye `retryAt`, error con `error`/`variable_error` y esperando conexión en los demás casos. Perfil/modelo/versión permanecen junto al nombre; el disclosure de diagnóstico, cerrado inicialmente, reúne última comunicación válida, latencia, conteos de variables online sin error y variables con error, próxima lectura existente y último error. Las fechas válidas usan el idioma activo; datos ausentes usan «—». No se crea historian ni otro motor de reconexión.

`plcConnectionAvailable` es la regla compartida entre listado y preview del editor: exige conexión habilitada y excluye diagnóstico de conexión `error` o `unavailable`. El diagnóstico de variable precede al snapshot para decidir si existe una lectura online; cuando no hay diagnóstico, el listado conserva las comprobaciones de `available`/`stale`. Una conexión con error no presenta como actual un valor anterior del snapshot. `plcSensorDevice` adapta la medición al Sensor existente y conserva ausencia neutral; no inventa telemetría. La medición de la fila reutiliza `SensorMetricCard` con `title`, `sensorDecimals`, `visualStyle` y `device`, dentro de un contenedor de ancho máximo (20rem).

Las relaciones comando/físico/lógico/feedback continúan explícitas; feedback ausente dice «No configurado». Solicitado, real y confirmación permanecen separados. Pulse muestra duración y acción Activar; setpoint muestra límites/unidad y Editar setpoint. Esas acciones abren confirmación y conservan el requisito `writable` + binding + callback; su disponibilidad inicial depende de la habilitación, mientras la autorización definitiva sigue en el servidor. El disclosure técnico de cada variable comienza cerrado y contiene área/PDU, Function Code, tipo/word order, escala/offset y RAW/latencia/última lectura.

`ModbusView` serializa las peticiones de resumen, conserva conexiones durante refresh y fuerza el snapshot tras guardar/asignar/comandar para evitar una estancia antigua al reabrir. Los errores conocidos se traducen con `plcErrorKey`/`plcResponseError`; códigos desconocidos o respuestas no JSON reciben un mensaje seguro, sin stack ni texto privado de transporte. Los AlertBanner de esta vista fijan localmente texto foreground y párrafos con opacidad completa; no se modifica el componente global.

La preferencia `visualStyle?` admite `auto | gauge | thermometer | level | battery` en el JSON existente y se valida en backend; booleanos la rechazan y `null` permite limpiar el campo. Las variables nuevas empiezan en `auto`; las históricas sin campo conservan su presentación. No hay SQL nuevo ni reescritura histórica. [SensorMetricCard](SensorMetricCard.md) describe herencia y override. Automatizaciones conservan sus acciones existentes sin setpoint parametrizado nuevo; Scenes conservan acciones sin añadir precondiciones.

Evidencia final de esta fase atribuida al coordinador: 611/611 Jest en 30 suites focalizadas tras las correcciones, salida 0; 80/80 en tres suites UI por separado, incluidas tres regresiones nuevas; responsive focalizado 18/18 y confirmación final 4/4, salida 0. Typecheck, lint y ambos builds aprobaron después de las correcciones; la revisión fresca reportó SHIP y ambos hallazgos materiales resueltos. El estado final y controles se centralizan en [Cierre UI PLC / Modbus](../modbus-plc-ui-closeout.md). Este documento no ejecutó pruebas ni acredita PLC físico, hardware táctil, suites completas, release o deploy.
