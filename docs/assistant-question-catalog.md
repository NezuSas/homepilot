# Catálogo de conversación de HomePilot

## Propósito

Este documento muestra qué puede preguntarse o pedirse actualmente al asistente de HomePilot y qué clase de respuesta entrega. No es una lista de frases rígidas: el asistente admite formas naturales, por ejemplo `por favor`, `me ayudas a`, errores leves de escritura y el prefijo opcional `Ok Nezu`.

Reemplace los textos entre corchetes por los nombres reales de su instalación, por ejemplo `[estancia]` por `Sala` y `[dispositivo]` por `Luz principal`.

## Principios de respuesta

- Las respuestas se basan solo en dispositivos, estancias, escenas y automatizaciones a los que el usuario autenticado tiene acceso.
- Una acción se confirma como realizada solo si HomePilot recibe un resultado correcto del dispositivo.
- Si el destino no es único, HomePilot pregunta cuál desea usar; no elige por su cuenta.
- Las acciones masivas y las de gestión que implican cambios estructurales piden confirmación. Se puede responder `sí`, `sí por favor`, `adelante` o `cancelar` según corresponda.
- La disponibilidad de una acción depende de la capacidad real del dispositivo importado. Un sensor se puede consultar, pero no controlar; una TV apagada puede no admitir encendido remoto.

## 1. Conversación y preferencias

| Puedes decir | Respuesta esperada |
| --- | --- |
| `Hola`, `buenas tardes` | Saludo breve y orientado al hogar. |
| `¿Cómo estás?` | Respuesta breve; HomePilot no simula estado personal ni inventa datos de la casa. |
| `¿Cómo me llamas?` | Indica el tratamiento almacenado para el usuario actual. |
| `Llámame [nombre]` | Confirma el nuevo nombre preferido si es válido. |
| `Háblame con tono cálido`, `tono formal`, `tono neutral` | Confirma la preferencia de tono para la conversación general. |
| `Responde breve`, `dame más detalles` | Confirma el estilo de respuesta `conciso`, `estándar` o `detallado`. |
| `¿Qué puedes hacer?`, `¿qué comandos entiendes?` | Guía de capacidades basada en el hogar: consulta de estado, control por estancia, escenas, automatizaciones, medios y aclaraciones. |
| Pregunta ajena al hogar, por ejemplo `¿quién ganó el partido?` | Explica de forma breve que se concentra en el hogar y no busca información general en Internet. |

## 2. Fecha, hora y estado general

| Puedes decir | Respuesta esperada |
| --- | --- |
| `¿Qué hora es?` | Hora local configurada, expresada en lenguaje natural. |
| `¿Qué día es hoy?`, `¿cuál es la fecha?` | Fecha local configurada. |
| `¿Es de mañana?`, `¿ya es de noche?` | Respuesta según la franja horaria local. |
| `¿Cómo está la casa?`, `dime algo de mi hogar` | Un hecho verificable derivado del estado actual autorizado; no una opinión inventada. |
| `¿Qué hay encendido?`, `apaga las luces que están encendidas` | Consulta o acción sobre estados conocidos. La acción masiva solicita confirmación antes de ejecutarse. |
| `¿Qué dispositivos no están disponibles?` | Lista únicamente los dispositivos autorizados cuyo estado actual sea `no disponible`; no adivina el motivo de la falla. |

## 3. Consultar una estancia o un dispositivo

| Puedes decir | Respuesta esperada |
| --- | --- |
| `¿Cómo está la [estancia]?` | Resumen agrupado de dispositivos encendidos y apagados en esa estancia. |
| `¿Qué hay prendido en [estancia]?` | Lista o conteo de elementos activos de esa estancia. |
| `¿Está encendida [dispositivo]?` | Estado real: `sí, [dispositivo] está encendido` o `no, está apagado`. |
| `¿Cuál es el estado de [dispositivo]?` | Estado actual del dispositivo, si está disponible. |
| `¿Cuántas luces tengo en [estancia]?` | Conteo de entidades autorizadas que coinciden con la consulta. |
| `¿Qué temperatura hay en [estancia]?` | Última lectura persistida del sensor, por ejemplo `La lectura de Temperatura Sala es 24 °C`. |
| `¿Cuál es la humedad?` | Lectura del sensor de humedad correspondiente. |

Si el nombre coincide con varias estancias, dispositivos o sensores, HomePilot responde con una aclaración como `Encontré varias opciones. ¿A cuál te refieres?`. Si no hay coincidencia o el dato no está disponible, lo informa sin ejecutar ninguna acción.

## 4. Control de luces, interruptores y otros dispositivos compatibles

| Puedes decir | Respuesta esperada |
| --- | --- |
| `Enciende [dispositivo]`, `prende la luz de [estancia]` | Enciende el objetivo único y confirma el resultado real. |
| `Apaga [dispositivo]`, `cuando puedas apaga la luz de la sala` | Apaga el objetivo único y confirma el resultado real. |
| `Alterna [dispositivo]` | Cambia el estado únicamente si el dispositivo admite conmutación. |
| `Enciende todo`, `apaga todas las luces` | Resume las acciones candidatas y solicita confirmación; al aceptar, ejecuta solo los dispositivos con estado conocido que requieren cambio. |
| `Enciende la sala y la cocina` | Puede preparar una acción múltiple y solicita confirmación. |
| `Apaga la sala, pero prende la cocina` | Procesa las órdenes separadas mediante las capacidades reales y aplica la política de confirmación correspondiente. |

También entiende expresiones naturales como `¿me ayudas a encender la luz de cocina?` y corrige errores leves contra los nombres reales del hogar. No controla un dispositivo que no existe, está fuera del hogar autorizado o no admite esa operación.

## 5. Cortinas, persianas y climatización

| Puedes decir | Respuesta esperada |
| --- | --- |
| `Abre la cortina de [estancia]` | Abre una cortina o persiana única que admita abrir. |
| `Cierra [cortina]` | Cierra el objetivo si la capacidad está disponible. |
| `Ajusta [clima] a 23 grados` | Configura la temperatura en un dispositivo `climate` compatible y confirma la acción. |
| `¿Cómo está la cortina de [estancia]?` | Informa el estado sincronizado cuando esté disponible. |

HomePilot no inventa soporte: si una cortina o equipo de clima no fue importado con esa capacidad, responde que la operación no está disponible.

## 6. TV, Chromecast y reproductores multimedia

| Puedes decir | Respuesta esperada |
| --- | --- |
| `¿Qué está reproduciendo [reproductor]?` | Estado de reproducción, título, artista y volumen cuando el dispositivo los publica. |
| `¿Qué reproductores tengo?`, `¿qué se reproduce en [estancia]?` | Estado de los reproductores importados, global o por estancia. |
| `Pausa [reproductor]`, `reanuda la TV` | Pausa o reanuda si la entidad admite esa operación. |
| `Siguiente canción en [reproductor]`, `pista anterior` | Cambia de pista si la integración expone los controles. |
| `Sube el volumen de [reproductor] en 10%` | Ajusta el volumen dentro del intervalo 0–100 % y confirma el valor final. |
| `Pon el volumen de [reproductor] en 35%` | Establece el volumen al porcentaje indicado. |
| `Enciende [TV o reproductor]` | Intenta encenderlo solo cuando la entidad admite encendido remoto. |

Si el reproductor está apagado, no disponible o no expone una capacidad, la respuesta lo explica. La miniatura del contenido depende de que el Chromecast/servicio de origen publique una imagen; no se puede deducir a partir del título.

## 7. Escenas y automatizaciones

| Puedes decir | Respuesta esperada |
| --- | --- |
| `¿Qué escenas tengo disponibles?` | Lista concisa de escenas autorizadas. |
| `Activa la escena [escena]` | Inicia la escena existente y comunica que está en ejecución. |
| `¿Qué escena puedo usar para una película?` | Sugiere únicamente escenas reales que coincidan con el objetivo; no ejecuta ninguna por sí sola. |
| `Haz la [estancia] acogedora`, `ayúdame a relajarme` | Recomienda escenas reales o controles compatibles del ambiente, sin activarlos automáticamente. |
| `¿Qué puedo hacer esta noche?`, `prepara la casa para dormir` | Muestra escenas, luces activas o cortinas controlables relevantes; no realiza cambios sin orden posterior. |
| `¿Qué automatizaciones tengo?` | Lista las automatizaciones disponibles. |
| `Activa la automatización [nombre]`, `desactiva [nombre]` | Explica el cambio y pide confirmación antes de habilitar o deshabilitarla. |

## 8. Crear y gestionar estancias, escenas y rutinas

Estas funciones son administrativas: HomePilot siempre describe el cambio y pide confirmación antes de aplicarlo.

| Puedes decir | Respuesta esperada |
| --- | --- |
| `Crea una estancia llamada [nombre]` | `Voy a crear la estancia [nombre]. ¿Confirmo?` Tras aceptar, confirma la creación. |
| `Renombra la estancia [actual] a [nuevo]` | Muestra el cambio propuesto y solicita confirmación. |
| `Elimina la estancia [nombre]` | Indica cuántos dispositivos quedarían sin estancia y pide confirmación. |
| `Crea una escena [nombre] para apagar las luces de [estancia]` | Prepara un borrador si hay estancia y acción válidas; explica lo preparado y solicita confirmación para activarlo. |
| `Crea una rutina [nombre] a las 22:00 para apagar [dispositivo]` | Prepara un borrador de rutina solo si contiene nombre, hora local, estancia autorizada y acción controlable; solicita confirmación para activarla. |
| `Renombra la escena [actual] a [nuevo]` | Propone el cambio y solicita confirmación. |
| `Agrega [dispositivo] a la escena [escena]` | Propone el cambio seguro y solicita confirmación. |
| `Quita [dispositivo] de la escena [escena]` | Propone el cambio y solicita confirmación. |

## 9. Continuidad, selección y confirmación

| Situación | Puedes responder | Resultado esperado |
| --- | --- | --- |
| Hay una única aclaración pendiente | `sí`, `ese`, `el primero`, `apágala` | Resuelve el único objetivo aún autorizado y continúa la acción. |
| Hay varias opciones | `la Luz principal`, `la segunda` | Usa la opción concreta indicada; no asume una por un `sí` genérico. |
| Existe una confirmación vigente | `sí`, `sí por favor`, `adelante` | Ejecuta únicamente el cambio que acabó de describir HomePilot. |
| No deseas continuar | `no`, `cancelar` | Cancela la acción pendiente sin controlar ningún dispositivo. |
| La confirmación expiró | `sí` después de varios minutos | Indica que la confirmación ya no está disponible y no ejecuta la acción. |
| Hay un único dispositivo en contexto | `¿podrías apagarla por favor?` | Puede entender el pronombre y sustituirlo por ese único dispositivo, con las mismas validaciones normales. |

## 10. Límites actuales importantes

- HomePilot no es todavía un chat general de Internet: no responde con información externa ni realiza búsquedas web.
- No realiza recomendaciones basadas en cámaras, salud, clima externo ni datos que no estén en el inventario autorizado.
- No controla equipos que estén apagados o desconectados si su integración no permite despertarlos remotamente.
- El catálogo de voz editable por dispositivo y alias naturales está planificado, pero todavía no está disponible como configuración completa para el usuario.
- La redacción de respuestas sigue siendo principalmente determinista: puede reconocer formas naturales de pedir algo, pero no tiene aún un modelo generativo local para sostener una conversación abierta tipo ChatGPT.

## Cómo usar este catálogo para detectar faltantes

Pruebe cada ejemplo cambiando los nombres por los de su hogar. Si una frase debería estar soportada pero no produce el resultado descrito, anote:

1. La frase exacta que envió o dijo.
2. La respuesta de HomePilot.
3. El dispositivo, estancia o escena al que se refería.
4. Si era una acción, si el dispositivo terminó en el estado esperado.

Con esos cuatro datos se puede decidir si falta una capacidad real en HomePilot, una integración no publica la información necesaria o solo falta ampliar la comprensión de la frase.

## Fuentes de verdad

- `specs/assistant-v1.md`
- `specs/nezu-domestic-assistant-v1.md`
- `specs/assistant-specialized-domestic-agent-v1.md`
- `specs/assistant-sensor-reading-queries-v1.md`
- `specs/assistant-natural-follow-up-resolution-v1.md`
- `specs/voice-catalog-v1.md`

## 11. Identidad, ayuda y preguntas de cliente frecuentes

Estas preguntas no controlan la vivienda y deben responder rápido.

| Puedes decir | Respuesta esperada |
| --- | --- |
| `¿Quién eres?`, `preséntate`, `¿cómo te llamas?` | Presentación breve de HomePilot como asistente residencial. |
| `¿Quién te creó?`, `¿qué es NEZU?`, `¿qué es Nezu S.A.S.?` | Información oficial de NEZU S.A.S. y su sitio web. |
| `¿Qué servicios ofrece NEZU?` | Información oficial sobre automatización, seguridad e infraestructura. |
| `¿Puedes responder cualquier cosa?`, `¿me puedes ayudar con cualquier cosa?` | Aclara que se concentra en el hogar registrado en HomePilot. |
| `¿Qué puedo pedirte?`, `¿cómo me ayudas con la casa?` | Explica control, consultas, escenas, automatizaciones, alias y confirmaciones. |
| `¿Puedes usar nombres que yo invente?` | Explica que se pueden crear alias personales para estancias o dispositivos existentes. |
| `Gracias`, `muchas gracias`, `perfecto` | Cierre breve y cordial. |
| `¿Cómo estás?`, `¿todo bien?`, `¿descansas?` | Respuesta breve y honesta; no inventa datos de la casa. |

## 12. Alias personales: hablar como habla cada familia

Los alias son personales: no cambian el nombre visible del dispositivo ni afectan a otros usuarios. Pueden apuntar a una estancia o a un dispositivo existente.

| Puedes decir | Respuesta esperada |
| --- | --- |
| `Cuando diga mi cuarto me refiero a Cuarto Master` | Crea el alias si `Cuarto Master` existe y no hay una colisión de nombre. |
| `Cuando diga oficinita me refiero a Estudio` | Confirma que `oficinita` ahora representa a `Estudio`. |
| `Llama zona de lectura a Lámpara Escritorio` | Crea un alias para ese dispositivo si es un objetivo único y autorizado. |
| `¿Qué aliases tengo?`, `lista mis alias` | Lista cada alias y su objetivo actual. |
| `¿Qué significa mi oficina?` | Devuelve a qué estancia o dispositivo se refiere el alias. |
| `Olvida mi oficina`, `borra el alias mi oficina` | Pide confirmación antes de eliminarlo. |
| `Sí` después de la pregunta anterior | Elimina solo el alias indicado. |
| `No` después de la pregunta anterior | Conserva el alias y cancela el cambio. |
| `Apaga las luces de mi oficina` | Usa el alias de estancia para resolver la orden normal. |
| `Enciende luz lectura` | Usa el alias de dispositivo si no existe un dispositivo real con ese mismo nombre. |

HomePilot rechaza aliases que coincidan con el nombre real de una estancia o dispositivo, apunten a algo inexistente o sean ambiguos.

## 13. Entender errores y reintentos

Estas preguntas usan el historial de ejecución local. No inventan una causa: explican únicamente el último resultado que HomePilot pueda comprobar.

| Puedes decir | Respuesta esperada |
| --- | --- |
| `¿Por qué falló?` | Explica la falla reciente, si existe, con el mensaje útil y una acción sugerida. |
| `¿Por qué no prendió?`, `por que no prendio` | Busca el resultado reciente y explica el error confirmado. |
| `¿Qué pasó?`, `que paso` | Indica si hubo una falla reciente; si no la hay, lo comunica. |
| `Revisa qué falló` | Entrega la explicación disponible sin volver a ejecutar nada. |
| `Reintenta`, `prueba otra vez`, `intenta de nuevo` | Reintenta la última acción fallida cuando era una sola acción válida. |
| `Reintenta todo` después de varias acciones fallidas | Describe cuántas acciones reintentará y pide confirmación. |
| `Sí, reintenta` | Ejecuta únicamente los reintentos que acababa de proponer. |
| `No, cancelar` | No reintenta nada. |

## 14. Batería extensa de frases realistas

Las secciones 14.1 a 14.11 son preguntas de aceptación: cuando existen los nombres y capacidades indicados, deben producir el resultado funcional descrito. La sección 14.12 recoge frases que deben terminar en aclaración, límite o rechazo seguro; nunca en una ejecución accidental.

### 14.1 Saludos, ayuda y contexto

- `Hola HomePilot`
- `Ok Nezu, hola`
- `Buenas`
- `Buenas noches`
- `¿Quién eres?`
- `¿Cómo te llamas?`
- `¿Qué haces aquí?`
- `¿Qué puedes hacer por mí?`
- `¿Qué te puedo pedir?`
- `¿Cómo me ayudas con mi casa?`
- `Necesito ayuda`
- `Muéstrame ejemplos`
- `¿Qué dispositivos puedes controlar?`
- `¿Qué hay configurado en mi casa?`
- `¿Qué estancias tengo?`
- `¿Qué espacios tengo?`
- `¿Qué habitaciones tengo?`
- `¿Qué cuartos tengo?`
- `¿Qué zonas tengo?`
- `¿Qué escenas tengo?`
- `¿Qué automatizaciones tengo?`
- `¿Qué alias tengo?`

Resultado esperado: una guía basada exclusivamente en el inventario autorizado. Si no hay estancias, escenas o automatizaciones, debe indicarlo claramente, no rellenar la respuesta con datos ficticios.

### 14.2 Hora, fecha y conversación breve

- `¿Qué hora es?`
- `Dime la hora`
- `¿Qué hora tenemos?`
- `¿Qué fecha es hoy?`
- `¿Qué día es hoy?`
- `¿En qué día estamos?`
- `¿Es de mañana?`
- `¿Ya es tarde?`
- `¿Es de noche?`
- `¿Cómo estás?`
- `¿Todo bien?`
- `Gracias`
- `Muchas gracias, Nezu`
- `Hasta luego`

Resultado esperado: datos de tiempo local o una respuesta breve y residencial. No debe intentar controlar dispositivos solo porque la frase contenga el nombre del asistente.

### 14.3 Estado global y disponibilidad

- `¿Cómo está la casa?`
- `¿Qué está encendido?`
- `¿Qué hay prendido?`
- `¿Qué luces están encendidas?`
- `¿Qué está apagado?`
- `¿Qué luces están apagadas?`
- `¿Qué dispositivos están activos?`
- `¿Cuántas luces tengo?`
- `¿Cuántos dispositivos tengo?`
- `¿Cuántas luces tengo en la sala?`
- `¿Hay algo encendido en la cocina?`
- `¿Hay algo prendido en la casa?`
- `¿Qué dispositivos no están disponibles?`
- `¿Hay algo desconectado?`
- `¿Qué necesita atención?`
- `Dime algo interesante de mi casa`

Resultado esperado: conteos, listas breves o un hecho verificable. `No disponible` debe informarse como estado, sin diagnosticar una causa que HomePilot no conoce.

### 14.4 Preguntas por estancia

- `¿Cómo está la sala?`
- `¿Cómo está la cocina?`
- `¿Qué hay prendido en el cuarto master?`
- `¿Qué luces están encendidas en la sala?`
- `¿Hay algo apagado en la oficina?`
- `¿La cocina está encendida?`
- `¿Está todo apagado en la habitación?`
- `¿Cuántos dispositivos hay en el estudio?`
- `¿Qué hay en el baño?`
- `¿Qué puedo controlar en la terraza?`
- `¿Qué se reproduce en la sala?`
- `¿Qué temperatura hay en el cuarto?`
- `¿Cómo está mi oficina?`
- `¿Qué hay en mi cuarto?`

Resultado esperado: resumen limitado a esa estancia. Si `mi oficina` o `mi cuarto` es un alias, se resuelve para el usuario actual. Si hay varias coincidencias, debe pedir precisión.

### 14.5 Encender, apagar y alternar

- `Enciende la luz de la sala`
- `Prende la luz de la sala`
- `Activa la luz de sala`
- `¿Me ayudas a prender la luz de cocina?`
- `Cuando puedas apaga la luz de la sala`
- `Por favor apaga la lámpara del escritorio`
- `HomePilot, apaga el interruptor de entrada`
- `Ok Nezu, prende la luz del cuarto`
- `Desactiva la luz del pasillo`
- `Alterna la luz de la cocina`
- `Cambia el estado de la luz del baño`
- `Apaga esa`
- `Ahora apágala`
- `¿Podrías prenderla por favor?`
- `La primera`
- `La segunda`
- `Esa misma`

Resultado esperado: controla un objetivo único y autorizado. Los pronombres solo se aceptan si el contexto previo contiene exactamente un objetivo inequívoco. Ante varios dispositivos, HomePilot ofrece opciones en lugar de adivinar.

### 14.6 Órdenes por estancia, categorías y grupos

- `Prende las luces de la sala`
- `Apaga las luces de la cocina`
- `Enciende toda la sala`
- `Apaga todo en el cuarto master`
- `Prende todos los focos de la oficina`
- `Apaga las luces que están prendidas`
- `Enciende todas las luces apagadas`
- `Apaga todo`
- `Enciende todo`
- `Apaga la sala y la cocina`
- `Prende la sala y la cocina`
- `Apaga la sala, pero prende la cocina`
- `Apaga todo excepto la luz de noche`
- `Deja encendida la lámpara del pasillo y apaga el resto`

Resultado esperado: el alcance se resuelve con dispositivos disponibles y estado conocido. Las acciones masivas se proponen para confirmación; exclusiones y acciones compuestas se procesan solo cuando la interpretación es clara y las capacidades existen.

### 14.7 Cortinas, persianas y clima

- `Abre la cortina de la sala`
- `Cierra la persiana del cuarto`
- `Abre las cortinas de mi oficina`
- `Baja la cortina de la sala`
- `Sube la persiana del estudio`
- `¿La cortina de la sala está abierta?`
- `¿Cómo está la persiana del cuarto?`
- `Ajusta el aire de la sala a 23 grados`
- `Pon el clima del cuarto a 21`
- `Configura el aire acondicionado a 24 grados`

Resultado esperado: solo abre, cierra o ajusta entidades importadas con esas capacidades. Si el nombre es genérico y hay varias cortinas, solicita aclaración.

### 14.8 Sensores y lecturas

- `¿Qué temperatura hay?`
- `¿Cuál es la temperatura de la sala?`
- `Dime la humedad`
- `¿Qué humedad hay en el cuarto?`
- `¿Cuánto marca el sensor de cocina?`
- `¿Cuál es la lectura de [sensor]?`
- `¿Está disponible el sensor de temperatura?`
- `Muéstrame la temperatura del estudio`

Resultado esperado: muestra la última lectura sincronizada y su unidad. Si hay varios sensores posibles, pregunta cuál; si el sensor está indisponible, lo dice sin modificar el dispositivo.

### 14.9 TV, música y media

- `¿Qué está reproduciendo la TV?`
- `¿Qué canción está sonando?`
- `¿Qué se está escuchando en la sala?`
- `¿Qué reproductores tengo?`
- `¿Qué reproductores hay en el cuarto?`
- `Pausa la TV`
- `Pausa el reproductor de la sala`
- `Reanuda la música`
- `Dale play a la TV`
- `Siguiente canción`
- `Pista anterior en el parlante`
- `Sube el volumen de la TV en 10%`
- `Baja el volumen del parlante en 5%`
- `Pon el volumen de la sala en 30%`
- `Pon la TV al 50%`
- `Enciende el reproductor`
- `¿Por qué no puedo subir el volumen?`

Resultado esperado: consulta o controla solo el `media_player` elegido. Si hay más de uno, solicita el nombre; si no existe un reproductor importado en esa estancia, lo informa. El estado, título, artista, volumen y miniatura dependen de los datos que la integración publique.

### 14.10 Escenas, automatizaciones y recomendaciones domésticas

- `Activa Modo Cine`
- `Ejecuta la escena Buenas Noches`
- `Prende la escena Llegada`
- `¿Qué escena puedo usar para ver una película?`
- `Quiero un ambiente relajado en la sala`
- `Haz la sala acogedora`
- `¿Cómo puedo preparar la casa para dormir?`
- `¿Qué puedo hacer esta noche?`
- `¿Qué opciones tengo para la noche?`
- `¿Qué escenas hay disponibles?`
- `Lista mis escenas`
- `¿Qué automatizaciones tengo?`
- `¿La automatización Luz Pasillo está activa?`
- `Activa la automatización Luz Pasillo`
- `Desactiva la automatización Ahorro de Energía`

Resultado esperado: una escena existente se ejecuta; una recomendación solo sugiere escenas o controles reales y no actúa sola. Cambiar una automatización se explica y requiere confirmación.

### 14.11 Crear, modificar y cancelar cambios administrativos

- `Puedo agregar una estancia?`
- `Crea una estancia llamada Biblioteca`
- `Agrega una habitación llamada Juegos`
- `Renombra la estancia Biblioteca a Estudio`
- `Cambia el nombre de Sala a Sala Familiar`
- `Elimina la estancia Bodega`
- `Crea una escena llamada Modo Noche para apagar las luces de la sala`
- `Crea una rutina llamada Descanso a las 22:00 para apagar la TV`
- `Renombra la escena Modo Cine a Cine Familiar`
- `Agrega Luz Lectura a la escena Modo Noche`
- `Quita Luz Lectura de la escena Modo Noche`
- `Sí, confirma`
- `Sí por favor`
- `Adelante`
- `No, cancela`
- `Mejor no`

Resultado esperado: nunca aplica el cambio en la primera frase. Primero explica qué creará, renombrará, eliminará o modificará. La eliminación de una estancia revela cuántos dispositivos quedarán sin asignar.

### 14.12 Frases incompletas, ambiguas o con errores

- `Prende la luz`
- `Apaga eso`
- `Cierra la cortina`
- `Sube el volumen`
- `Pon música`
- `Activa la escena`
- `Crea una rutina`
- `Renombra una estancia`
- `Elimina una habitación`
- `Apaga la luz de la cosina`
- `A paga la lus de la sala`
- `Prende la luy del cuarto`
- `En sala apaga la luz`
- `Ok nesu apaga la luz de la sala`
- `Oye Nezu, apaga todo`
- `eres mi perra?`
- `Haz que la casa sea feliz`

Resultado esperado: HomePilot intenta normalizar formas naturales, errores ortográficos leves y algunas pronunciaciones controladas. Si falta un destino, propone el dato que necesita. Si una frase no pertenece al hogar o no puede interpretarse con seguridad, responde con sus límites o pide una orden más clara; no crea aliases ni ejecuta acciones por accidente.

## Cobertura del catálogo

Este catálogo cubre familias de preguntas y más de 150 frases de prueba. No puede enumerar todas las combinaciones lingüísticas posibles; el criterio es que las reformulaciones naturales de una intención ya soportada produzcan el mismo resultado seguro o una aclaración útil.
## 15. Mapa de cobertura: lo que un cliente razonablemente esperaría

Esta sección amplía el catálogo con intenciones distintas, no solo reformulaciones. Cada entrada marca su situación actual:

- **Ahora:** existe una ruta funcional y autorizada en HomePilot.
- **Parcial:** existe una parte del flujo, pero faltan capacidades, configuración o una forma natural de cubrir el caso completo.
- **Pendiente:** es una expectativa razonable de cliente, pero aún no debe prometerse ni simularse; requiere especificación e implementación.

### 15.1 Control cotidiano de dispositivos

- **Ahora** — `Enciende [luz]`.
- **Ahora** — `Apaga [interruptor]`.
- **Ahora** — `Alterna [dispositivo]`.
- **Ahora** — `Prende las luces de [estancia]`.
- **Ahora** — `Apaga todo en [estancia]`.
- **Ahora** — `Apaga las luces que están encendidas`.
- **Ahora** — `Enciende todas las luces apagadas`.
- **Ahora** — `Abre [cortina]`.
- **Ahora** — `Cierra [persiana]`.
- **Ahora** — `Ajusta [clima] a [temperatura] grados` cuando el equipo lo permite.
- **Parcial** — `Sube la persiana al 50 %`; requiere que la entidad publique posición y que la conversación exponga ese control.
- **Pendiente** — `Baja la luz al 30 %`; requiere soporte conversacional de brillo.
- **Pendiente** — `Pon la luz cálida`; requiere color o temperatura de color importados y un contrato de control.
- **Pendiente** — `Haz parpadear la luz de la entrada`; requiere una capacidad explícita de alerta visual.
- **Pendiente** — `Bloquea la puerta`; requiere un tipo de cerradura y una política de riesgo específica.

### 15.2 Estado, inventario y contexto del hogar

- **Ahora** — `¿Qué está encendido?`.
- **Ahora** — `¿Qué luces están apagadas en [estancia]?`.
- **Ahora** — `¿Cómo está [estancia]?`.
- **Ahora** — `¿Está encendido [dispositivo]?`.
- **Ahora** — `¿Cuántas luces tengo en [estancia]?`.
- **Ahora** — `¿Qué dispositivos no están disponibles?`.
- **Ahora** — `¿Qué temperatura hay en [estancia]?`.
- **Ahora** — `¿Cuál es la humedad?`.
- **Ahora** — `¿Qué escenas tengo disponibles?`.
- **Ahora** — `¿Qué automatizaciones tengo?`.
- **Parcial** — `¿Qué cambió hoy en la casa?`; existe historial de ejecución, pero no un resumen cronológico residencial completo.
- **Pendiente** — `¿A qué hora se encendió la sala?`.
- **Pendiente** — `¿Cuánto tiempo lleva encendida la TV?`.
- **Pendiente** — `¿Quién apagó la luz?`.
- **Pendiente** — `Compárame hoy con ayer`.

### 15.3 TV, música y entretenimiento

- **Ahora** — `¿Qué está reproduciendo [TV o parlante]?`.
- **Ahora** — `¿Qué reproductores tengo?`.
- **Ahora** — `Pausa [reproductor]`.
- **Ahora** — `Reanuda [reproductor]`.
- **Ahora** — `Siguiente canción en [reproductor]`.
- **Ahora** — `Pista anterior en [reproductor]`.
- **Ahora** — `Pon [reproductor] al 35 %`.
- **Ahora** — `Sube o baja [reproductor] en 10 %`.
- **Parcial** — `Enciende la TV`; depende de la capacidad real de Google Cast, Android TV o Wake-on-LAN, no de la frase.
- **Parcial** — `Muéstrame la carátula de la canción`; depende de que la fuente publique una imagen.
- **Pendiente** — `Pon música para cenar`; requiere integración de búsqueda y reproducción musical.
- **Pendiente** — `Reproduce mi lista de Spotify [nombre]`; requiere integración y autorización de Spotify.
- **Pendiente** — `Abre YouTube en la TV`; requiere una capacidad de lanzamiento de aplicación confirmada por la integración.
- **Pendiente** — `Pon el episodio siguiente`; requiere conocer la cola o servicio de contenido.
- **Pendiente** — `Apaga la TV cuando termine este video`; requiere eventos de finalización fiables y una automatización temporal.

### 15.4 Escenas, rutinas y modos de hogar

- **Ahora** — `Activa la escena [nombre]`.
- **Ahora** — `¿Qué escena sirve para una película?` cuando existe una escena compatible.
- **Ahora** — `Haz [estancia] acogedora`; propone opciones reales sin ejecutarlas sola.
- **Ahora** — `¿Qué puedo hacer esta noche?`.
- **Ahora** — `Crea una escena [nombre] para [acción]` con estancia y acción válidas.
- **Ahora** — `Crea una rutina [nombre] a las [hora] para [acción]` con los datos completos.
- **Parcial** — `Modo noche`; funciona si existe una escena llamada así, pero aún no es un modo de hogar de primera clase.
- **Parcial** — `Modo cine`; funciona si está modelado como una escena.
- **Pendiente** — `Estoy saliendo` para activar un conjunto de acciones y verificaciones de salida.
- **Pendiente** — `Llegué a casa` para restaurar el modo normal.
- **Pendiente** — `Hay visitas` para aplicar una escena temporal y revertirla luego.
- **Pendiente** — `Modo vacaciones` para simular presencia y cambiar notificaciones.
- **Pendiente** — `Desactiva temporalmente el modo noche hasta mañana`.
- **Pendiente** — `¿Qué modos de casa están activos?`.
- **Pendiente** — `Vuelve al estado anterior`; requiere historial reversible de acciones.

### 15.5 Automatizaciones por horario, evento y condición

- **Parcial** — `Crea una rutina a las 22:00`; actualmente admite una acción y hora local concretas.
- **Pendiente** — `Todos los días a las 22:00, apaga las luces de sala`.
- **Pendiente** — `Solo de lunes a viernes, enciende la entrada a las 18:30`.
- **Pendiente** — `Apaga la TV en 30 minutos`.
- **Pendiente** — `Recuérdame cerrar la cortina a las 20:00`.
- **Pendiente** — `Cuando llegue a casa, enciende la sala`.
- **Pendiente** — `Cuando salga el último, apaga todo`.
- **Pendiente** — `Si la temperatura pasa de 28 grados, enciende el aire`.
- **Pendiente** — `Si se abre la puerta de noche, prende la entrada`.
- **Pendiente** — `Si llueve, cierra las cortinas`.
- **Pendiente** — `No ejecutes esa automatización si hay visitas`.
- **Pendiente** — `Muéstrame por qué se ejecutó esta automatización`.
- **Pendiente** — `Pausa todas las automatizaciones por dos horas`.
- **Pendiente** — `¿Qué automatizaciones se ejecutaron hoy?`.
- **Pendiente** — `Edita la rutina [nombre]` mediante una conversación completa y auditable.

### 15.6 Seguridad, cámaras y acceso

- **Pendiente** — `¿Está cerrada la puerta principal?`.
- **Pendiente** — `¿Hay movimiento en la sala?`.
- **Pendiente** — `Muéstrame la cámara de entrada`.
- **Pendiente** — `Graba un clip de la cámara`.
- **Pendiente** — `Activa el modo seguridad`.
- **Pendiente** — `Desactiva la alarma`; requeriría confirmación fuerte y, según el riesgo, otro factor de autenticación.
- **Pendiente** — `Avísame si se abre la puerta`.
- **Pendiente** — `¿Quién tocó el timbre?`; requiere integración y una política de privacidad de video/audio.
- **Pendiente** — `Revisa si dejé una ventana abierta`.
- **Pendiente** — `¿Hay alguna puerta sin seguro?`.
- **Pendiente** — `Comparte la cámara con un invitado`; requiere permisos temporales.
- **Pendiente** — `Silencia las alertas de seguridad por una hora`.

### 15.7 Energía, ahorro y confort

- **Pendiente** — `¿Cuánto estoy consumiendo ahora?`.
- **Pendiente** — `¿Qué aparato consumió más hoy?`.
- **Pendiente** — `¿Cuánto gasté este mes?`.
- **Pendiente** — `Compara el consumo con el mes pasado`.
- **Pendiente** — `¿Qué puedo apagar para ahorrar?`.
- **Pendiente** — `Avísame si el consumo pasa de [valor]`.
- **Pendiente** — `¿Qué habitación está más caliente?`.
- **Pendiente** — `Mantén la casa a 23 grados`; requiere una estrategia multi-equipo y reglas de seguridad.
- **Pendiente** — `¿Conviene cerrar las cortinas por el calor?`; requeriría sensores y una política explícita.
- **Pendiente** — `Activa el modo ahorro de energía` como modo de hogar configurado.

### 15.8 Notificaciones, recordatorios y comunicación

- **Pendiente** — `Avísame cuando termine la lavadora`.
- **Pendiente** — `Recuérdame apagar el aire en una hora`.
- **Pendiente** — `Notifícame si la TV queda encendida después de medianoche`.
- **Pendiente** — `Mándame una alerta si la cámara detecta movimiento`.
- **Pendiente** — `No me molestes hasta las 7:00`.
- **Pendiente** — `Envía una notificación a [usuario] cuando llegue`.
- **Pendiente** — `¿Qué notificaciones tengo pendientes?`.
- **Pendiente** — `Cancela el recordatorio de la cena`.
- **Pendiente** — `Resume las alertas importantes del día`.
- **Pendiente** — `Configura una alerta semanal de mantenimiento`.

### 15.9 Diagnóstico y soporte de la instalación

- **Ahora** — `¿Qué dispositivos no están disponibles?`.
- **Ahora** — `¿Por qué falló?` después de una ejecución reciente.
- **Ahora** — `Reintenta` la última acción fallida válida.
- **Pendiente** — `¿Por qué está desconectado [dispositivo]?` con diagnóstico de red e integración.
- **Pendiente** — `¿La integración de Home Assistant está bien?`.
- **Pendiente** — `¿Tiene Internet la MiniPC?`.
- **Pendiente** — `¿Cuánto espacio libre queda?`.
- **Pendiente** — `¿Cuándo fue la última copia de seguridad?`.
- **Pendiente** — `Actualiza HomePilot` con un flujo seguro y mantenimiento programado.
- **Pendiente** — `Reinicia solo la integración de la TV`.
- **Pendiente** — `Genera un diagnóstico para soporte técnico`.
- **Pendiente** — `¿Qué versión de HomePilot tengo?`.

### 15.10 Personas, permisos y convivencia

- **Pendiente** — `¿Quién tiene acceso a la casa?`.
- **Pendiente** — `Crea un acceso de invitado hasta mañana`.
- **Pendiente** — `No permitas que los niños controlen la TV después de las 21:00`.
- **Pendiente** — `¿Qué puede controlar [usuario]?`.
- **Pendiente** — `Revoca el acceso de [usuario]`.
- **Pendiente** — `Cambia mi código o contraseña`.
- **Pendiente** — `¿Quién ejecutó esta escena?`.
- **Pendiente** — `Crea un alias compartido para todos`; hoy los aliases están acotados al usuario.

## Lectura honesta de la cobertura

HomePilot cubre bien el control y la consulta directa: aproximadamente **45 % de las intenciones cotidianas de control básico**. Frente a todas las expectativas de un cliente sobre un asistente doméstico —automatización avanzada, seguridad, energía, alertas, soporte y convivencia— la cobertura actual se mantiene alrededor de **20–25 %**.

Las secciones marcadas como **Pendiente** son un backlog de producto, no una promesa al cliente. Para convertir cualquiera en funcionalidad se requiere una especificación, permisos, contratos de integración, pruebas y validación de seguridad antes de escribir código.
## 16. English client question catalogue

HomePilot supports English for the same safe household conversation flows. Replace bracketed names with the real names in the installation. The expected result remains dependent on the actual device capability and on the authenticated user's authorization.

### 16.1 Greeting, identity and help

- `Hello HomePilot`
- `Hi`
- `Good morning`
- `Good evening`
- `Who are you?`
- `What is your name?`
- `Who created HomePilot?`
- `What is NEZU?`
- `What services does NEZU offer?`
- `What can you do?`
- `How can you help with my home?`
- `What can I ask you?`
- `Can you answer anything?`
- `What devices can you control?`
- `What rooms do I have?`
- `What scenes are available?`
- `What automations do I have?`
- `What aliases do I have?`
- `Thank you`
- `How are you?`

Expected result: a concise answer about HomePilot, its authorized home inventory or its residential scope. General Internet questions remain outside the local assistant's scope.

### 16.2 Time, date and home status

- `What time is it?`
- `Tell me the time`
- `What is today's date?`
- `What day is it today?`
- `Is it morning?`
- `Is it night already?`
- `How is the house?`
- `What is on?`
- `What lights are on?`
- `What is off?`
- `What devices are active?`
- `How many lights do I have?`
- `How many lights are in the living room?`
- `Is anything on in the kitchen?`
- `What devices are unavailable?`
- `Is anything disconnected?`
- `Tell me something about my home`

Expected result: local time/date or an authorized, factual state summary. It must not invent device states or reasons for an unavailable device.

### 16.3 Room and device state questions

- `How is the living room?`
- `What is on in the kitchen?`
- `What lights are on in the bedroom?`
- `Is the kitchen on?`
- `Is everything off in the office?`
- `How many devices are in the study?`
- `What can I control on the terrace?`
- `Is [device] on?`
- `What is the status of [device]?`
- `Where is [device]?`
- `What temperature is the bedroom?`
- `What is the humidity?`
- `What is the reading of [sensor]?`
- `How is my office?`
- `What is in my room?`

Expected result: an authorized room summary, point-state answer or latest persisted sensor reading. Ambiguous room, device or sensor names require a clarification.

### 16.4 Everyday device control

- `Turn on the living room light`
- `Switch on the kitchen light`
- `Could you turn on the office light, please?`
- `Turn off the hallway switch`
- `Please switch off the desk lamp`
- `Deactivate the bathroom light`
- `Toggle the kitchen light`
- `Turn on the lights in the living room`
- `Turn off all lights in the kitchen`
- `Turn everything off in the main bedroom`
- `Turn on all the lights that are off`
- `Turn off the lights that are on`
- `Turn everything off`
- `Turn on the living room and the kitchen`
- `Turn off the living room but turn on the kitchen`
- `Turn everything off except the night light`
- `Turn that one off`
- `Could you turn it off, please?`
- `The first one`
- `The second one`

Expected result: a unique authorized target is controlled and the confirmed result is reported. Bulk operations require confirmation. A pronoun works only when one safe, remembered target exists.

### 16.5 Covers, climate and sensors

- `Open the living room curtain`
- `Close the bedroom blind`
- `Open the curtains in my office`
- `What is the status of the living room curtain?`
- `Set the living room climate to 23 degrees`
- `Set the bedroom air conditioner to 21 degrees`
- `What temperature is the living room?`
- `What is the kitchen humidity?`
- `What does the office sensor read?`
- `Show me the study temperature`

Expected result: HomePilot uses only the open, close, temperature or read capabilities exposed by the imported entity. Unsupported capabilities must be explained rather than guessed.

### 16.6 TV, music and media players

- `What is the TV playing?`
- `What song is playing?`
- `What is playing in the living room?`
- `What players do I have?`
- `What players are in the bedroom?`
- `Pause the TV`
- `Pause the living room player`
- `Resume the music`
- `Play on the TV`
- `Next track on the speaker`
- `Previous track on the speaker`
- `Increase the TV volume by 10 percent`
- `Decrease the speaker volume by 5 percent`
- `Set the living room volume to 30 percent`
- `Set the TV volume to 50 percent`
- `Turn on the player`
- `Why can't I change the volume?`

Expected result: HomePilot reports title, artist and volume only when provided by the player. It asks which player to use when the target is ambiguous, and explains when the player is unavailable or the requested control is unsupported.

### 16.7 Scenes, automations and household recommendations

- `Activate Movie Mode`
- `Run the Good Night scene`
- `Turn on the Arrival scene`
- `Which scene can I use for a movie?`
- `Make the living room cozy`
- `Help me create a relaxing atmosphere`
- `What can I do tonight?`
- `How can I prepare the house for sleep?`
- `What scenes are available?`
- `List my scenes`
- `What automations do I have?`
- `Enable the Hallway Light automation`
- `Disable the Energy Saving automation`

Expected result: a named existing scene can be run. Recommendations list only actual authorized scenes or controllable entities and never execute without a subsequent request. Enabling or disabling an automation requires confirmation.

### 16.8 Aliases, administration and follow-ups

- `When I say my office, I mean Main Bedroom`
- `Call the desk lamp reading light`
- `What aliases do I have?`
- `What does my office mean?`
- `Forget my office`
- `Delete the alias my office`
- `Create a room called Library`
- `Rename the Library room to Study`
- `Delete the Storage room`
- `Create a scene called Night Mode to turn off the living room lights`
- `Create a routine called Rest at 10 PM to turn off the TV`
- `Rename the Movie Mode scene to Family Movie`
- `Add Reading Light to the Night Mode scene`
- `Remove Reading Light from the Night Mode scene`
- `Yes, confirm`
- `Yes, please`
- `Go ahead`
- `No, cancel`
- `Never mind`

Expected result: aliases are personal; administrative operations are described first and are only applied after explicit confirmation. Deleting a room discloses the devices that would be left unassigned.

### 16.9 Failures and recovery

- `Why did it fail?`
- `Why didn't it turn on?`
- `What happened?`
- `Check what failed`
- `Retry`
- `Try again`
- `Retry the last action`
- `Retry everything`
- `Yes, retry`
- `No, cancel`

Expected result: the assistant consults the recent local execution record. A valid single failure may be retried; multiple failures require a confirmation. Without a recent failure it reports that there is no actionable failure history.

### 16.10 English prompts that must stay safe

- `Turn on the light`
- `Turn that off`
- `Close the curtain`
- `Raise the volume`
- `Play music`
- `Activate the scene`
- `Create a routine`
- `Rename a room`
- `Delete a room`
- `Turn on the kitchen lght`
- `Ok Nesu, turn off the living room light`
- `Hey Nezu, turn everything off`
- `Make the house happy`
- `Tell me tomorrow's lottery numbers`
- `Open my bank app`

Expected result: HomePilot may normalize a safe, known wording or typo. When the target is missing, ambiguous, unsupported or outside the home domain, it asks for the minimum clarification or states its limit. It must never execute an inferred action, create an alias or expose information accidentally.

### 16.11 Additional English parity prompts

- `Can you turn on the living room light?`
- `Please turn off the kitchen light`
- `Switch on the desk lamp`
- `Could you switch off the hallway light?`
- `Turn on all lights in the office`
- `Turn off all lights in the bedroom`
- `Open the curtain in the living room`
- `Close the bedroom blind`
- `Is the desk lamp on?`
- `Is the kitchen light off?`
- `What is on in my office?`
- `How many lights are in the bedroom?`
- `Which devices are unavailable?`
- `What is the temperature in the office?`
- `What is the humidity in the living room?`
- `What is the current status of the TV?`
- `Pause the bedroom TV`
- `Resume the living room speaker`
- `Set the speaker volume to 40 percent`
- `Skip to the next track on the TV`
- `Run the Movie Mode scene`
- `What scenes can I use tonight?`
- `What does my bedroom alias mean?`
- `Forget the reading light alias`

Expected result: each prompt uses the same authorization, capability validation, confirmation and truthful-result rules as its Spanish equivalent.
## 17. Language parity rule

Every supported Spanish intent must have an English equivalent with the same security, authorization, confirmation and capability rules. A language change changes the wording of the response, never the permitted target, the device operation or the result reported by HomePilot.