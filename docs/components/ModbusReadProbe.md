# ModbusReadProbe

AC16/AC17 refinement: table uses one contained overscroll region, separated borders and individually sticky opaque header cells above rows; Create variable never wraps. Local All/Valid/Active filters do not modify samples and conversion is computed before filtering, so a hidden zero word remains part of a 32-bit value. All retains failures/previous RAW; valid includes zero, active uses non-zero/true RAW. Empty filter results are explained. Unit uses MeasurementUnitSelect; numeric drafts use NumberInput. Modal only closes explicitly by default.

Referencia local del asistente de puesta en marcha de Sistema → Modbus TCP. Implementación: `apps/operator-console/src/components/ModbusReadProbe.tsx`; composición y editor: `apps/operator-console/src/views/ModbusView.tsx`; lectura: `packages/integrations/modbus/application/ModbusService.ts`. Contrato aprobado: [Integración Modbus TCP local V1](../../specs/modbus-tcp-local-integration-v1.md), AC8–AC15. La configuración persistida se documenta en [ModbusConnectionCard](ModbusConnectionCard.md).

## Propósito y límites

Modo **Operate**: el instalador introduce un destino y rango explícitos, compara RAW y conversión y prepara una variable a partir de una fila válida. La prueba utiliza únicamente FC01–04; no escribe, activa polling ni guarda lecturas. Ofrece modo genérico PDU y modo de perfil con resolución explícita; no descubre redes ni identifica firmware o notación 40001.

La extensión conserva la identidad de HomePilot: `index.css` y controles compartidos proporcionan los tokens y estados de ambos temas. Este documento describe la superficie local; no inicializa contexto de producto ni un sistema visual global.

## Contrato del componente

| Prop | Tipo | Responsabilidad |
| --- | --- | --- |
| `homeId` | `string` | Hogar de la prueba y de la configuración posterior. |
| `initial` | `ModbusConnection?` | Precargar host, Unit ID, perfil y capacidades; aportar nombre al preparar conexión. La vista actual abre sin este valor. |
| `onClose` | `() => void` | Cerrar después de detener la lectura. |
| `onCreate` | `(selection: ModbusProbeSelection) => Promise<void>` | Preparar conexión y abrir el editor normal de variable; no guardar la variable automáticamente. |

`ModbusProbeSelection` contiene conexión sin `id/homeId` y variable sin `deviceId/connectionId`. La prueba, el resultado y la conversión viven en estado local; no hay store global nuevo. `apiFetch` envía POST `/api/v1/modbus/probe` con `homeId`, `host`, `unitId`, `area`, `start`, `end` y `timeoutMs`, asociado a un `AbortController`.

## Entradas y ciclo de lectura

Host es una IPv4 privada literal RFC1918, puerto fijo (502) y Unit ID (1–247). Áreas: coil, discrete input, holding register e input register. Dirección PDU cero-basada (0–65535), rango inclusivo de hasta 64 direcciones y timeout (250–5000 ms). Defaults: Unit ID (1), holding register, rango (100–120), timeout (2000 ms) y refresco manual. El servidor valida permisos y límites antes de contactar red; los atributos nativos del formulario no sustituyen esa validación.

Refresco ofrece manual o intervalos (1, 5, 10, 30 y 60 s). Cada nueva lectura se programa después de terminar la anterior y esperar el intervalo seleccionado; no es una frecuencia fija desde el inicio de la solicitud. Mientras está activo se bloquean destino, rango y refresco, y se anuncia leyendo o esperando. Detener cancela la solicitud activa y evita lecturas futuras; cerrar y desmontar también abortan y limpian el temporizador. El cierre se ignora durante la preparación de variable.

El servicio permite una prueba activa por hogar y serializa con la conexión existente si coinciden host y Unit ID. La prueba no depende de habilitar esa conexión ni modifica su configuración.

## Modo perfil

[ModbusAddressFields](ModbusAddressFields.md) comparte catálogo y resolver con el dominio. El selector ofrece genérico o Xinje XL5E-16T v1 (`xinje-xl5e-16t-v1`). Perfil utiliza extremos simbólicos (defaults D100–D120) y muestra símbolo normalizado, área y PDU antes de leer; un rango inválido deshabilita Iniciar. Índices decimales salvo X/Y octales estrictos; rangos de máximo 64 direcciones permanecen en un segmento. No se infiere existencia física de las 64 posiciones reservadas por módulo.

Si el símbolo inicial es X/Y, se muestran capacidades opcionales de CPU o expansión 1–16, entradas/salidas 0–64. Sin capacidad declarada aparece aviso de espacio reservado; capacidad explícita limita la selección. El servidor vuelve a resolver `symbolicStart`/`symbolicEnd`, verifica área/PDU enviados y utiliza capacidades guardadas de la conexión coincidente si existen, por lo que un preview local no puede ampliar ese límite. Se mantiene el mismo probe, cola, transporte y decoder en ambos modos.

Cambiar perfil, símbolos o capacidades limpia resultados; estos controles quedan deshabilitados durante lectura o preparación de variable. El estado del formulario es local. La tabla de perfil añade símbolo, área y unidad a las columnas comunes.

## Resultados, errores y conversión

La tabla muestra dirección PDU, RAW, tipo seleccionado, valor convertido, estado, tiempo de respuesta, error y Crear variable. RAW es un bit booleano o palabra `uint16` sin escala. El timestamp identifica la muestra y el estado se comunica mediante texto.

Se realiza una lectura de bloque: el tiempo mostrado en las filas pertenece a la operación del bloque. Una excepción Modbus afecta a todo el bloque; su código no identifica una dirección culpable. Se presentan errores de timeout, conexión, protocolo o excepción sin inventar valores. Ante error posterior se conserva el RAW anterior por dirección, marcado como anterior, con estado fallido y conversión no disponible. Un fallo de solicitud conserva las filas previas con error de conexión y tiempo desconocido. Cambiar destino o rango limpia el resultado.

Frontend y transporte usan el mismo `convertModbusValue` de dominio. Registros ofrecen `uint16`, `int16`, `uint32`, `int32` y `float32`; bits fijan `boolean`, escala (1), offset (0) y unidad vacía. RAW booleano conserva true/false y la conversión usa etiquetas Activo/Inactivo traducidas. `int16` interpreta complemento a dos. Tipos de 32 bits requieren dos palabras consecutivas con lectura válida y orden `high_first` o `low_first`; el orden de bytes dentro de cada palabra es big-endian fijo. Una ayuda visible explica ambos límites; la última fila del rango no puede convertirse sola. El cálculo numérico es `valor decodificado × escala + offset`; escala debe ser finita y distinta de cero y offset finito. Unidad admite hasta 24 caracteres. Un dato ausente, palabra inválida o resultado no finito muestra raya y error de conversión y deshabilita crear variable. El preview formatea hasta seis decimales sin modificar RAW.

## Preparar una variable

Crear variable detiene la prueba y prepara una selección con dirección, área, tipo, orden, escala, offset y unidad, siempre `writable=false`. `ModbusView` reutiliza una conexión con el mismo host y Unit ID; si no existe, la acción crea una conexión deshabilitada con puerto (502), timeout de la prueba e intervalo de polling (5000 ms). La acción es la confirmación de esa creación. Cierra el asistente y abre el [editor normal](ModbusConnectionCard.md) para revisar y guardar la variable. Cancelar ese editor no borra una conexión que ya se creó. Una conexión reutilizada conserva su estado de habilitación.

El nombre propuesto usa área y dirección en genérico, o símbolo en perfil. La selección de perfil conserva `profileId`, capacidades de conexión y `symbolicAddress` de variable, además de área/PDU y conversión. Reutilizar una conexión no sobrescribe su perfil ni capacidades guardadas. La variable solo se persiste al pulsar Guardar en el editor; inventario, estancia y widgets siguen los flujos existentes. La prueba no habilita escritura física; el editor normal ofrece opt-in para coils genéricas y únicamente M/Y/HM del perfil. Los demás segmentos permanecen protegidos también en backend.

## Composición, accesibilidad e internacionalización

`Modal`, `Input`, `SearchableSelectField`, `Button`, `AlertBanner` y `LoadingState` compartidos mantienen foco y composición. El modal utiliza ancho máximo `max-w-5xl` y texto de tarjeta explícito. Campos se apilan en móvil, pasan a dos columnas desde `sm` y a cuatro desde `lg`; conversión utiliza hasta cinco desde `lg`. Acciones envuelven y el overflow se limita a la tabla, con altura máxima (20 rem), cabecera fija, bordes semánticos y números tabulares. Superficies, texto, errores y foco heredan tokens de claro/oscuro sin paleta nueva. Botones `lg`, Input/NumberInput y selector normal comparten altura de 44 px.

La tabla tiene caption accesible, encabezados de columna y dirección como encabezado de fila. Su contenedor es una región nombrada, enfocable con `tabIndex=0` para desplazamiento por teclado. Una ayuda visible y traducida explica el desplazamiento horizontal; `aria-describedby` la relaciona mediante `useId`. Estado de lectura usa `role="status"`; fallos usan `role="alert"`. Campos conservan etiqueta y límites nativos del control compartido.

`ModbusProbeTableSkeleton` tiene una cabecera y tres filas visuales y se oculta del árbol accesible; `LoadingState` aporta anuncio de carga. Solo aparece al leer sin resultados: refrescar conserva la tabla anterior. Las barras compartidas respetan preferencia de movimiento. Copy y errores proceden de `modbus.*`; host, direcciones, RAW y códigos de tipo son datos técnicos. Excepciones interpolan código y la muestra utiliza hora local.

## Seguridad, compatibilidad y evidencia

Ruta y API son exclusivas de Admin; backend verifica pertenencia al hogar. No se aceptan DNS, loopback, IP pública ni multicast en configuración de producción. Las pruebas de desarrollo usan simuladores TCP; los permisos HomePilot no aportan autenticación/cifrado a Modbus TCP ni sustituyen segmentación LAN, firewall o enclavamientos del PLC.

No hay migración SQL nueva para esta ampliación. Tipos y configuraciones genéricas históricos se conservan; JSON admite `uint32/int32` y metadatos de perfil opcionales. Antes de volver al binario V1 anterior, convertir explícitamente esas variables a un tipo admitido o restaurar backup. Un editor antiguo puede perder perfil/símbolo/capacidades al guardar, aunque mantenga área/PDU: realizar backup antes de instalar o revertir. No hay conversión automática de configuraciones históricas; futuras versiones del perfil requieren IDs distintos.

La ejecución principal reportó 238 pruebas Jest focales aprobadas en ocho suites (203 Modbus y 35 de regresión), además de typecheck, lint y ambos builds aprobados. Pasaron 14 escenarios responsive focales y cuatro recapturas finales; revisión visual fresca SHIP sobre 16 capturas finales en `.impeccable/review/plc-profiles`. El alcance cubre móvil (390×844), tablet vertical (768×1024), tablet horizontal (1024×768) y desktop (1440×900), ambos temas, perfiles, genérico, RAW/conversión, apertura del editor y conservación tras error con Detener. Los controles de spec coverage, BDD, cobertura por módulo, i18n, arquitectura y ausencia de `any` de producción también pasaron. Esta documentación registra resultados de la ejecución principal, no pruebas funcionales adicionales.

El mapa de software se validó con pruebas; no se validaron PLC físico, firmware, base real, suites completas ni despliegue. La evidencia focal no confirma compatibilidad física ni constituye autorización de publicación o certificación completa de accesibilidad.
