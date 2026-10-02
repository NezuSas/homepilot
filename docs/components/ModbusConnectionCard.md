# ModbusConnectionCard

AC17 refinement: configuration numbers use NumberInput with editable empty drafts and native required constraints. Unit uses MeasurementUnitSelect, including unknown historical values. Defaults, conversion, saved JSON and backend validation remain unchanged. Form dismissal is explicit through Cancel/close.

Referencia local de la configuración Modbus TCP de Sistema. Implementación: `apps/operator-console/src/components/ModbusConnectionCard.tsx`; composición y formularios: `apps/operator-console/src/views/ModbusView.tsx`. Contrato aprobado: [Integración Modbus TCP local V1](../../specs/modbus-tcp-local-integration-v1.md), especialmente AC1, AC2, AC7 y AC11–AC15.

## Propósito y límites

Modo **Operate**: mostrar conexiones y mapas explícitos de variables para que Admin configure la integración local. La tarjeta resume configuración; el estado habilitado indica polling configurado, no conectividad ni disponibilidad actual del PLC. No muestra valores en vivo ni ejecuta órdenes físicas. Inventario, asignación a estancia y selección de widgets siguen los flujos existentes.

Esta extensión conserva los tokens y controles de HomePilot. `index.css` y los componentes compartidos son la autoridad visual existente; este documento no establece un sistema global ni crea `PRODUCT.md`, `DESIGN.md` o sidecars de Impeccable.

## Contrato del componente

`ModbusConnectionSummary` combina `ModbusConnection` con `variables: ModbusVariable[]`.

| Prop | Tipo | Responsabilidad |
| --- | --- | --- |
| `connection` | `ModbusConnectionSummary` | Nombre, host, puerto, Unit ID, habilitación y variables de la conexión. |
| `onEdit` | `() => void` | Solicitar que la vista abra el editor de conexión. |
| `onAdd` | `() => void` | Solicitar que la vista abra una variable nueva para esta conexión. |
| `onVariable` | `(variable: ModbusVariable) => void` | Solicitar el editor de la variable seleccionada. |

La tarjeta no consulta API, no mantiene formularios y no controla autorización. `ModbusView` conserva conexiones, carga, errores, editor y formularios en estado local; reutiliza `useDeviceSnapshotStore` para obtener el primer hogar y refrescar el inventario, sin crear otro store global. Los cambios se guardan mediante `apiFetch`; después se recargan conexiones y snapshot.

## Composición y apariencia

Cada sección tiene nombre accesible igual al nombre de conexión, título de nivel 2, icono Cable decorativo, dirección `host:port`, Unit ID y texto de habilitación. El botón secundario Configurar abre la conexión. Las variables forman una lista dividida por bordes: nombre, símbolo cuando existe, área, dirección PDU, tipo y permiso de escritura; cada fila tiene Configurar con nombre accesible específico. La acción Añadir variable permanece al final. Una conexión sin variables muestra una explicación breve.

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

En perfil, el opt-in se ofrece únicamente para M, Y y HM. Los demás segmentos, incluidas X y áreas de sistema, permanecen protegidos y el backend rechaza `writable=true` tanto al guardar como al ejecutar comandos. Cambiar a genérico elimina metadatos de variable al guardar y conserva la política histórica de coils; no activa escritura automáticamente.

Crear desde probe conserva perfil/símbolo/resolución/conversión y abre el editor normal con `writable=false`. Si reutiliza conexión por host/Unit ID, sus capacidades guardadas y habilitación se conservan. Los metadatos opcionales se guardan en JSON existente sin SQL nuevo; las configuraciones genéricas históricas siguen funcionando. Realizar backup antes de instalar o revertir: un editor anterior puede perder metadatos al guardar aunque preserve área/PDU. Las variables con tipos nuevos también requieren la preparación de downgrade descrita en [ModbusReadProbe](ModbusReadProbe.md).

## Accesibilidad e internacionalización

Los iconos de tarjeta y botones se ocultan del árbol accesible. La sección nombrada y la lista permiten navegar cada conexión y variable. Los textos visibles de botones identifican acciones; el botón por variable incorpora su nombre en `aria-label`. No se transmite habilitación o escritura solamente por color.

`Input` vincula etiqueta, campo y ayuda mediante IDs; los campos requeridos y límites numéricos usan semántica nativa. `ToggleSwitch` proporciona `role="switch"`, `aria-checked`, etiqueta y foco visible. `Modal` aporta `role="dialog"`, `aria-modal`, título/descripción relacionados y el comportamiento de foco del overlay compartido. El error de guardado es `role="alert"`.

`LoadingState` anuncia carga con `role="status"`, `aria-live="polite"`, `aria-busy` y etiqueta traducida; sus barras se ocultan a tecnología asistiva. La animación de pulso solo se aplica cuando el usuario permite movimiento. El skeleton de tarjeta aislado es visual: el anuncio accesible lo proporciona su contenedor.

La superficie obtiene copy de `modbus.*` y `common.loading` mediante `react-i18next`. Nombres configurados, host, direcciones y códigos técnicos de tipo son datos, no copy traducido. Las áreas y permisos sí usan traducciones; `modbus.edit_variable` interpola el nombre de variable.

## Frontera de seguridad

La ruta `/system/modbus` y navegación son exclusivas de Admin; esta restricción pertenece a la composición de aplicación, no a la tarjeta. El servidor debe verificar rol y pertenencia al hogar en cada operación. La UI no reemplaza RBAC ni la validación de IP privada RFC1918, puerto, cantidades, tipos o límites de dirección.

Guardar configuración no es una prueba de conexión ni una escritura física; habilitar la conexión inicia polling. Solo una coil genérica o M/Y/HM del perfil con permiso explícito puede recibir comandos existentes desde los flujos de dispositivos. Registros y segmentos protegidos permanecen de lectura. No hay botón de orden física, eliminación o descubrimiento automático en esta superficie.

Las direcciones se introducen como PDU explícita en genérico o se resuelven mediante el perfil seleccionado. No se infiere notación 40001 ni firmware. La verificación posterior del mapa contra el equipo real es un requisito operativo pendiente. Permisos de HomePilot no proporcionan autenticación/cifrado a Modbus TCP ni reemplazan segmentación LAN y seguridades del PLC.

## Evidencia de validación y alcance

La ejecución principal final reportó 238 pruebas Jest aprobadas en ocho suites (203 Modbus y 35 de regresión), 14 escenarios responsive focales y cuatro recapturas finales aprobados. Typecheck, build raíz, build de consola, lint, spec coverage, BDD, cobertura por módulo, límites de arquitectura, ausencia de `any` de producción e i18n aprobados. Revisión fresca SHIP sobre 16 capturas finales en `.impeccable/review/plc-profiles`, formulario/resultados en los cuatro tamaños y ambos temas. Esta documentación recoge esa evidencia; el handoff documental no volvió a ejecutar pruebas funcionales.

`apps/operator-console/tests/responsive-shell.spec.ts` cubre configuración genérica y de perfil en móvil (390×844), tablet vertical (768×1024), tablet horizontal (1024×768) y desktop (1440×900): creación deshabilitada, dirección manual/simbólica, variable de lectura, opt-in permitido, persistencia tras recarga, modal dentro del viewport, acción Guardar visible y ausencia de overflow global en claro/oscuro. El escenario de no Admin verifica que navegación directa no solicita configuración ni ofrece la ruta/acción. Las pruebas de API y servicio cubren permisos, resolución, capacidad y protección de escritura; el componente no los demuestra por sí solo.

No se ejecutaron suites completas, matriz responsive completa ni pruebas con PLC físico, firmware o base real; tampoco despliegue. La evidencia focal no constituye autorización de publicación, validación del mapa físico ni certificación completa de accesibilidad táctil.
