# Integración Modbus TCP local V1

## Refinamiento de formularios y tabla — alcance autorizado

- AC16: Tabla de probe con scroll contenido, encabezado opaco fijo y acción Crear variable en una línea. Filtros locales Todos / Lecturas válidas / Con actividad (RAW no cero/true), sin borrar muestras ni ocultar errores en Todos. Conversión de 32 bits utiliza la secuencia original completa antes de filtrar.
- AC17: Unidad mediante selector buscable modular, catálogo amplio de unidades habituales y Sin unidad. Conservar valores históricos desconocidos como opción; no convertir magnitudes ni cerrar el contrato backend a un enum. Campos numéricos pueden borrarse durante edición; vacío no se convierte en cero ni se envía al guardar. Inputs/selects estándar 44px. Formulario solo cierra mediante acción explícita; lectura sigue readonly. Sin API/SQL nuevo.

**Estado:** Aprobado

## Alcance aprobado

Integración Edge nativa, sin Home Assistant ni cloud. Configuración exclusiva de Admin con pertenencia al hogar validada. La UI amplía Sistema con la misma paleta, campos, selector y modal existentes; no modifica Dashboard ni sus componentes Sensor/Button. Seguimiento local autorizado expresamente; sin GitHub, Git, Docker ni deploy.

Conexiones nuevas deshabilitadas y variables de solo lectura por defecto. Activar una conexión inicia polling; guardar no prueba ni modifica un PLC. El desarrollo solo utiliza servidores TCP simulados en loopback. El perfil Xinje usa el mapa suministrado y aprobado por el usuario; firmware, capacidad física y puerto del equipo real no quedan certificados por pruebas simuladas.

## Contrato y seguridad

- IPv4 privada RFC1918 literal, puerto TCP 502; sin DNS, loopback, direcciones públicas o multicast en configuración de producción.
- Unit ID 1–247, timeout 250–10000 ms, intervalo 1000–60000 ms. Máximo 16 conexiones por hogar y 128 variables por conexión.
- Dirección efectiva PDU cero-basada 0–65535, introducida explícitamente en modo genérico o resuelta por un perfil versionado aprobado; nunca aceptar notación 40001.
- Lecturas FC01 coils, FC02 discrete inputs, FC03 holding registers y FC04 input registers. Tipos boolean, uint16, int16, uint32, int32 y float32; orden de palabras alto/bajo configurable para tipos de 32 bits, escala y offset finitos.
- V1 permite escritura FC05 únicamente sobre coils explícitamente habilitadas, mediante los comandos existentes turn_on/turn_off/toggle de Button/switch. Registros permanecen de lectura; no se inventa un comando genérico ni pulsos con reset inseguro. Las seguridades y enclavamientos permanecen en el PLC.
- Tramas limitadas, transaction/unit/protocol/function/byte-count/echo validados, timeout absoluto y socket cerrado siempre. No reintentar escrituras: un timeout no demuestra que el PLC no recibió la orden.
- Modbus TCP clásico no aporta autenticación ni cifrado. Usar solo LAN confiable/segmentada y firewall, sin exposición a Internet; los permisos HomePilot no reemplazan el aislamiento de la red PLC.
- Operaciones serializadas por conexión; polling no solapa comandos. Cada intento abre nueva conexión; backoff de lectura acotado a 60 s. Error conserva último valor pero marca state unavailable y stale; no presentar una lectura antigua como actual.
- Variables se incorporan al inventario como PENDING, sin estancia. Asignación y selección de widgets siguen el flujo existente; fuente modbus-tcp, switch solo para coils escribibles, sensor para lectura. Cambiar permisos actualiza esa capacidad; el driver vuelve a verificar permiso, hogar y habilitación antes de transmitir.
- API /api/v1/modbus/connections y /:id/variables: listado, creación, actualización y eliminación Admin; no endpoint de escritura física fuera del dispatcher existente. Deshabilitar no borra dispositivos ni referencias.

### Eliminación autorizada y scroll contenido (AC18)

- DELETE de variable requiere confirmación explícita en UI, Admin y hogar autorizado. Borra transaccionalmente mapping e inventario solo si no hay referencias persistentes en escenas, triggers/acciones de automatizaciones o tabs de Dashboard; conflicto HTTP 409 conserva todos los datos. No modificar ni eliminar esas referencias automáticamente.
- DELETE de conexión solo se permite sin variables. Serializar eliminación con polling/comandos; volver a comprobar existencia dentro de la cola para evitar recrear mappings después de borrar. No transmitir escrituras físicas ni borrar históricos de auditoría.
- Sin migración SQL; endpoints aditivos compatibles. Backup SQLite antes de instalar/revertir; una eliminación confirmada no se restaura por downgrade, requiere backup. Reconstruir API y UI posteriormente; sin deploy en esta tarea.
- La región con borde de resultados queda fija: scroll de datos únicamente en su hijo interior, con ancho mínimo cero y overflow horizontal contenido en el formulario del probe. No desactivar scroll de resultados ni el scroll vertical del formulario.

## Persistencia y reversión

Migración aditiva 035: tablas modbus_connections y modbus_variables con referencias al hogar y dispositivo. Configuraciones existentes no se migran ni alteran. Crear variable y dispositivo es transaccional. Antes de cualquier instalación en MiniPC hacer backup de SQLite. Para revertir, deshabilitar conexiones y regresar al binario anterior conservando tablas; no borrar dispositivos automáticamente. API y UI deberán reconstruirse posteriormente, sin desplegar durante esta tarea.

## Criterios de aceptación

- AC1: guardar y cargar configuración conserva mapa explícito; nuevas conexiones y escrituras desactivadas.
- AC2: no Admin ni hogar ajeno pueden leer/configurar; entradas inválidas no contactan red.
- AC3: las cuatro áreas se leen, escala/orden se respetan; protocolo malformado, excepción, cierre y timeout fallan explícitamente sin recursos abiertos.
- AC4: solo coil habilitada admite comandos existentes; entradas/registros/sensores no escriben; no hay retry de escritura.
- AC5: polling serial, reconexión/backoff y lectura stale preservan dato sin fingir disponibilidad; start/stop no dejan timers activos.
- AC6: variables alimentan inventario/snapshot/eventos existentes y conservan estancia al editar.
- AC7: UI Admin, estado inicial con skeleton propio, configuración compacta y accesible en desktop/tablet/mobile, claro/oscuro; sin controles físicos en configuración.

## Ampliación aprobada — asistente de puesta en marcha

- AC8: Admin puede ejecutar POST `/api/v1/modbus/probe` con hogar, IPv4 privada, Unit ID, área y rango PDU inclusivo. Solo FC01–04; nunca activar polling, guardar datos ni escribir durante la prueba. Máximo 64 direcciones por lectura, timeout 250–5000 ms, una prueba activa por hogar; no barrido automático de redes ni CLI. Lectura de bloque: una excepción afecta al bloque completo, no demuestra qué dirección falló. Tabla con RAW por dirección (palabra uint16 o bit), tipo seleccionado, valor convertido, estado, error y tiempo del bloque compartido por filas.
- AC9: refresco manual o periódico 1–60 s, sin solapamientos; Detener/cerrar cancela solicitud y futuras lecturas. Resultados se conservan marcados anteriores ante errores. Crear variable desde una fila válida abre el editor normal con dirección, área y conversión, siempre writable=false; conexión nueva se guarda deshabilitada solo por confirmación. No escribir ni inferir símbolos de fabricante.
- AC10: conversión compartida backend/frontend: uint16, int16, uint32, int32 y float32; 32 bits ocupan dos palabras consecutivas y requieren la siguiente dirección leída. Orden high_first/low_first, escala/offset/unidad y preview; ausencia/NaN muestran error, no valor ficticio. Tipos históricos se conservan y no hay migración SQL nueva. El JSON admite tipos nuevos; para volver al binario V1 previo, cambiar variables uint32/int32 a un tipo admitido o restaurar backup antes del downgrade. No convertir configuraciones históricas automáticamente.
- Desarrollo/pruebas solo con PLC simulado. Configuración y pruebas de lectura usan los mismos límites de red y permisos; seguridad física y aislamiento LAN siguen siendo responsabilidad del instalador.

## Ampliación aprobada — perfiles de direccionamiento

- AC11: capa de perfiles pura independiente del transporte; fabricante/familia/modelo/versión y segmentos explícitos. Xinje XL5E-16T v1: M=0/20480, X CPU=20480/64, Y CPU=24576/64, SM=36864/4096, T=40960/4096, C=45056/4096, HM=49408/6144, HT=57600/1024, HC=58624/1024; holding D=0/20480, SD=28672/4096, TD=32768/4096, CD=36864/4096, HD=41088/6144, HTD=48256/1024, HCD=49280/1024 (base/cantidad). Índices decimales salvo X/Y octales estrictos. Expansiones 1–16: símbolo base octal 10000 + (módulo−1)*100 octal; PDU X=20736+(módulo−1)*64, Y=24832+(módulo−1)*64. Rechazar huecos, octales inválidos, perfil desconocido y rangos que crucen segmentos.
- AC12: conexión admite profileId opcional y moduleCapacities opcional por CPU/1–16, entradas/salidas 0–64. Ausencia de capacidad significa dirección reservada, no existencia física confirmada. Capacidad explícita limita selección, probe y guardado. Rangos máximo 64, consecutivos del mismo segmento; tipos 32 bits requieren siguiente palabra dentro del segmento.
- AC13: variable conserva profileId y symbolicAddress opcionales junto a area/address autoritativos. Backend comprueba concordancia al guardar/leer configuración, no confía en resolución del navegador. JSON existente conserva metadatos sin SQL nuevo; histórico genérico sigue funcionando. Perfil versionado inmutable; futuras versiones requieren IDs distintos. Downgrade pierde metadatos al editar con versión antigua, pero area/address mantienen lectura; backup antes de instalar/revertir.
- AC14: modo genérico y modo perfil comparten probe, cola, transporte y decoder. UI modular muestra símbolo, área/PDU y aviso de capacidad antes de leer; tabla añade símbolo/área/unidad. Crear abre editor con metadatos, resolución y conversión; sin escritura en discovery. M/Y/HM pueden optar explícitamente por escritura existente; resto de segmentos del perfil (incluidas X y áreas de sistema) son readonly, con rechazo backend incluso si se solicita writable=true. No habilitación automática.
- AC15: pruebas unitarias de mapas/octales/expansiones/capacidad/32 bits/errores y persistencia, pruebas de servicio sin llamadas de red inválidas, responsive focal móvil/tablet/escritorio claro/oscuro, regresión genérica, typecheck/lint/build. No base real, PLC físico, Git, Docker o deploy.

## Referencias del protocolo

## Ampliación aprobada — PLC I/O (2026-10-03)

- AC19: configuración/diagnóstico Modbus requieren autenticación, rol Admin real y hogar autorizado. Pruebas con AuthGuard real; los comandos operativos conservan los permisos del dispatcher común.
- AC20: binding PLC opcional en JSON de variable con rol input/output/output_command/output_feedback/measurement/setpoint/diagnostic y direcciones explícitas command/physical/feedback/logical. Sin inferir relaciones Ladder ni segundo inventario/polling. Histórico sin binding conserva su comportamiento.
- AC21: feedback none/optional/required y timeout 250–10000 ms. commandedState y actualState independientes; feedback es fuente de verdad cuando está configurado. Required espera confirmación, sin repetir escritura; discrepancia/timeout nunca se presenta como ON confirmado. Publicar pending/unconfirmed/error y recuperación mediante state sync existente.
- AC22: pulse usa el dispatcher común y coil explícita, duración 100–5000 ms, intento OFF aun tras fallo ambiguo del ON, sin retry automático. No pulsar Y físicas. El reset no está garantizado ante caída de proceso/red/alimentación: watchdog/enclavamiento PLC obligatorio; error de reset visible y auditado.
- AC23: codec inverso uint16/int16/uint32/int32/float32, finitos, escala no cero, límites del tipo y del setpoint, rechazo de enteros no representables sin red. FC06 una palabra/FC16 dos palabras, validación estricta de eco; bytes big-endian fijo y wordOrder existente.
- AC24: perfil v1 inmutable. Perfil xinje-xl5e-16t-v2 conserva mapa/protecciones y permite D/HD solo para setpoint con writable explícito y límites min/max. X y sistema protegidos; bindings PLC nuevos de escritura requieren perfil autorizado. Histórico genérico coil sigue funcionando; no escritura genérica de registros ni habilitación automática.
- AC25: polling aísla errores de mapping/conversión/excepción de variable; caída TCP marca conexión unavailable/backoff. Diagnóstico efímero por conexión/variable: RAW, valor, última lectura, latencia y error, accesible solo Admin/hogar. Sin historian ni conexiones persistentes nuevas.
- AC26: UI PLC I/O/editor modular, roles/bindings/políticas/límites/estancia, estado real y diagnóstico, skeleton propio, i18n y responsive focalizado. Probe permanece readonly y reutiliza resolver/decoder. Devices resultantes usan sensor/binary_sensor/switch existentes; setpoints usan comando set_value explícito, sin nueva familia Dashboard.
- AC27: tests codec/transporte/roles/protecciones/RBAC real/persistencia/pulsos/feedback/aislamiento y E2E TCP simulado → Device → comando → feedback independiente → state sync/eventos. Regresión focalizada de consumidores existentes y typecheck/lint/builds/controles spec/arquitectura/i18n. No PLC físico, Git/GitHub, Docker, deploy ni responsive completo.

Compatibilidad/reversión: nuevos campos opcionales, sin SQL nuevo ni conversión masiva. Para downgrade, deshabilitar conexiones y restaurar backup/configuración previa: el binario anterior no entiende v2 ni bindings/escritura de registros. No prometer conservación semántica por downgrade sin backup. Entradas/sensores son estado/condiciones del motor de automatización existente; no añadir precondiciones a Scenes si su contrato no las soporta.

Detalle AC26/AC27: probar comando fuera del formulario de configuración exige confirmación explícita mediante el endpoint común de Device; nunca desde Read Probe. La comparación opcional eq/gt/gte/lt/lte del trigger existente permite mediciones > umbral; ausencia conserva igualdad histórica. Valores vacíos/no finitos y estado stale/unavailable no activan comparaciones numéricas. Campo opcional en JSON sin migración SQL.

Contrato de tramas y funciones: [Modbus Organization — especificaciones oficiales](https://www.modbus.org/modbus-specifications). No se afirma que se haya validado el mapa del Xinje real.

## Ampliación UI de instalador aprobada — 2026-10-03

### Frontera de perfiles — Fase 1 aprobada

- AC33: encapsular en el perfil Xinje resolución/formato simbólico, expansiones/capacidades y políticas de pulse/setpoint/áreas auxiliares. Core consulta el perfil sin IDs/prefijos/reglas modulares Xinje; catálogo estático, sin plugins ni otro fabricante. Conservar todos los mapas, IDs V1/V2, permisos, límites, Modbus TCP y JSON existentes. No modificar actualState, feedback, confirmación, consumidores ni transporte. Pruebas de delegación, pulsos rechazados en CPU/todas las expansiones Y, capacidades, resoluciones y carga de JSON histórico sin reescritura. Sin migración SQL, PLC físico, Git ni deploy.
- AC34: UX localizada del editor de Salidas: Salida física editable antes de un único Comando PLC (símbolo principal), sin campo Comando duplicado. Entradas usa Entrada física. Guardado deriva command del símbolo principal como antes; editar physical no altera command/feedback ni infiere Ladder. Conservar none/sustained, estancia, roles históricos, V1/V2, JSON y controles/paleta/skeleton existentes. Sin backend ni cambios de actualState/confirmación. Pruebas de estructura y edición/guardado/recarga con responsive PLC focalizado en cuatro tamaños y ambos temas.
- AC35: formato visual compartido con máximo dos decimales; RAW, valores internos, conversiones, umbrales y automatizaciones conservan precisión. Editor compacto con opciones tipadas compartidas y explicación de salida física y dirección de feedback explícita; no inferir Ladder ni cambiar confirmación. Listado inicial de conexiones con conteos y detalle local por conexión, conservando refresh y configuración histórica. Sin API, SQL, hardware o transporte nuevos.

Compatibilidad/reversión de AC33: metadatos y funciones del perfil solo en runtime, no se serializan. Conexiones/variables conservan su contrato y se pueden leer con el binario previo compatible con V1/V2. La validación interna de capacidades recibe ahora el profileId; API/JSON no cambian. La UI metadata-driven y la eliminación de revisiones visibles quedan para Fase 2, evitando opciones de modelo indistinguibles con permisos diferentes.

- AC28: distinguir habilitación de conectividad real con las semánticas existentes. Mostrar perfil/modelo, última comunicación/latencia y conteo de variables OK/error; indicar reconexión solo cuando el backoff existente aporte próxima lectura. Diagnóstico/error traducido, sin stack ni detalles de transporte privados; desconocidos usan mensaje seguro. Conservar datos durante refresh y evitar consultas UI solapadas.
- AC29: editores por rol conservan símbolos como lenguaje principal, con PDU/área/Function Code/wordOrder en sección técnica avanzada. Inputs nunca ofrecen escritura; outputs muestran comando/físico/feedback (incluido no configurado), estado solicitado/real y modo/duración; pulse mantiene confirmación y límites existentes. Guardar no escribe al PLC.
- AC30: mediciones reutilizan SensorMetricCard y los estilos auto/gauge/thermometer/level/battery. `visualStyle?` opcional validado en JSON existente, sin SQL ni conversión histórica. State sync comunica la preferencia como `plcVisualStyle`; el widget Sensor la usa solo para Devices Modbus y solo si la tarjeta no tiene override propio. Histórico sin campo conserva presentación previa. Selector/preview de instalador y listado respetan unavailable sin valores ficticios. Unidad, tipo, escala/offset permanecen consultables.
- AC31: setpoint muestra valor actual, límites y nuevo valor/unidad; validación antes de confirmar, error traducido y objetivo explícito, mediante comando común. Room e inventario/consumidores existentes conservan comportamiento. No extender contrato de acciones parametrizadas de Automatizaciones ni condiciones de Scenes en esta fase; documentar esos límites.
- AC32: tests focales de estados/diagnóstico/editores/visualStyle/confirmación/permisos, persistencia y regresión de Sensor; responsive solo PLC en cuatro tamaños, dos idiomas y temas, modal/scroll/teclado. Typecheck/lint/builds y checks de spec/BDD/módulo/arquitectura/i18n. Sin Git/GitHub, Docker, deploy, suite responsive completa ni PLC físico. Downgrade requiere backup/configuración compatible; runtime anterior puede ignorar visualStyle, sin autorizar cambios de permisos.
