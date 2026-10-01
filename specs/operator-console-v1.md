# SPEC: HomePilot Operator Console V1

**Estado:** Borrador  
**Autor:** Antigravity (IA Architect)  
**Fecha:** 2026-04-01  

## 1. Declaración del Problema (Problem Statement)
HomePilot ya tiene implementado y operando de manera validada todo su core backend local: Topología (homes, rooms), Dispositivos (discovery, inbox, asignación, ejecución de comandos, state sync), Reglas de Automatización V1 y Persistencia Durable con SQLite. Sin embargo, el sistema carece actualmente de cualquier interfaz visual (UI). Sin una UI, los desarrolladores, operadores técnicos y/o instaladores no pueden inspeccionar el estado en tiempo real del sistema, operar dispositivos directamente, examinar el log de auditorías ni habilitar/deshabilitar las automatizaciones sin usar llamadas a API o consultas SQL manuales.

## 2. Alcance (Scope)
Definir una interfaz de usuario Web Local V1 orientada netamente a un **operador, instalador técnico o propósitos de debugging**. El alcance incluye:
- **Vista de Homes / Rooms:** Navegación básica sobre la topología persistida.
- **Vista de Devices:**
  - Visualización del Inbox (dispositivos descubiertos no asignados).
  - Visualización de dispositivos asignados por habitación.
  - Visualización del estado actual (`lastKnownState`).
  - Inspección de metadatos visibles (capabilities, vendor, type, status).
- **Vista de Automation Rules:**
  - Listado general de las reglas cargadas en el sistema.
  - Estado visible de enabled / disabled.
  - Detalle técnico expuesto del trigger y la action configurados.
- **Vista de Activity Log:**
  - Historial de eventos filtrado por dispositivo.
  - Visualización de eventos recientes en orden cronológico inverso (LIFO).
- **Acciones Mínimas Operativas:**
  - "Assign Device" (trasladar del Inbox a una habitación).
  - "Execute Command" (disparar un comando manual básico V1).
  - "Enable / Disable Rule" (alternar el encendido/apagado de una regla).

## 3. Fuera de Alcance (Out of Scope)
Quedan estrictamente excluidos de esta iteración:
- Un diseño "premium" pulido o estética para cliente/usuario final masivo.
- Desarrollo de aplicación móvil nativa (Mobile App).
- Autenticación real o control multiusuario complejo (RBAC).
- Paneles o Dashboards con analytics avanzados.
- Soporte para "Escenas" complejas compuestas.
- Creador visual de automatizaciones drag-and-drop.
- Branding final comercial.
- Sincronización de interfaz hacia entornos Cloud.

## 4. Requisitos Funcionales (Functional Requirements)
- **REQ-01**: El operador debe poder visualizar la lista de hogares y navegar por sus habitaciones en forma de solo lectura.
- **REQ-02**: El operador debe poder consultar la lista "Inbox" con todos los dispositivos con estado `PENDING`.
- **REQ-03**: El operador debe poder asignar un dispositivo PENDING a una habitación válida.
- **REQ-04**: El operador debe ver los dispositivos asignados y despachar comandos operacionales (ej: encender, apagar) para validar que la capa Execution funciona.
- **REQ-05**: El operador debe poder ver la configuración técnica (trigger/action) de todas las automatizaciones existentes, y cambiar rápidamente su atributo `enabled`.
- **REQ-06**: El operador debe disponer de una consola temporal o feed para inspeccionar el Activity Log de los nodos seleccionados.

## 5. Requisitos No Funcionales (Non-Functional Requirements)
- **NFR-01 (Local-First)**: La interfaz Web debe ser servida de manera local por la propia miniPC al estar en la misma red de área local (LAN).
- **NFR-02 (Validación de Backend)**: El frontend debe consumir exactamente las mismas operaciones documentadas en el backend (zero bypass); el Frontend oficia de "test de validación visual" del servicio construido.
- **NFR-03 (Pragmatismo UI)**: Priorizar visibilidad técnica y operación rápida. Diseños tabulares simples y coherentes son preferibles a estéticas caprichosas o animaciones pesadas.
- **NFR-04 (Navegación sin ráfagas)**: Los catálogos de Tableros, escenas y automatizaciones compartidos entre vistas conservan una ventana breve de frescura, separan sesiones y se invalidan tras escrituras; no se altera el polling de diagnósticos. Abrir Asistente consulta hallazgos, pero un escaneo completo solo se ejecuta por acción explícita.

## 6. Navegación / Pantallas Principales
Se proyecta un diseño de consola clásica (Sidebar izquierdo + Main View):
1. **Página "Topology" (Home/Rooms View)**: Lista de la jerarquía física actual instalada.
2. **Página "Network & Inbox"**: Visor enfocado en dispositivos no provisionados, con su identificador de red para asignarlos rápidamente.
3. **Página "Device Manager"**: Grilla de nodos operando actualmente, exponiendo el último estado sincronizado y botones directos de test (Ej: `[ON]`, `[OFF]`).
4. **Página "Automations Workbench"**: Lista plana con toggle switches para pausar/reanudar lógica Edge y ver el mapping (Trigger -> Action).
5. **Página "Audit Logs"**: Visor crudo estilo terminal/tabla filtrable del Activity Log.

## 7. Modelo Conceptual de UI
Se propone una consola de administración pragmática:
- **Layout**: Barra de navegación lateral persistente, encabezado indicando el ambiente local y panel central para el volcado de datos.
- **Componentes**: Tablas simples de datos, tarjetas (cards) resumidas para entidades y diálogos rápidos/modales para acciones de estado (Ej: un `<select>` para "Assign Room").
- **Estilo**: Uso de vanilla CSS nativo o un framework sobrio integrado para maximizar compatibilidad y agilizar el armado sin sobrediseñar.

## 8. Criterios de Aceptación (Acceptance Criteria)
- [ ] AC1: Es posible compilar y levantar la interfaz Operator Console junto (o adyacente) al proceso backend actual de HomePilot.
- [ ] AC2: Un dispositivo ubicado en el Inbox puede ser seleccionado y asignado a una Room existente, removiéndose de la vista Inbox de inmediato.
- [ ] AC3: El switch de Enabled/Disabled de una Regla cambia su base de datos local visiblemente (reflejado de persistencia).
- [ ] AC4: Al encender una luz desde "Device Manager", el Activity Log plasma el evento `COMMAND_DISPATCHED`.
- [ ] AC5: La escala tipográfica se consume desde tokens semánticos (`micro`, `label`, `caption`, `body` y jerarquías de encabezado) en componentes compartidos y superficies de dispositivos, evitando tamaños arbitrarios para el mismo rol visual.
- [ ] AC6: El inspector permite eliminar una importación local mediante confirmación explícita, refresca el inventario sin recargar y comunica si el dispositivo está en uso.
- [ ] AC7: El componente de cortina representa posición y movimiento con contraste suficiente en modo claro y oscuro. La UI siempre envía la intención `open`/`close`; la inversión física se aplica una sola vez en el driver.
- [ ] AC8: Inicio no mantiene ni presenta modos del hogar. Su jerarquía queda limitada al saludo del hogar, escenas favoritas, automatizaciones favoritas y sugerencias inteligentes.
- [ ] AC9: Las tarjetas de Inicio distinguen explícitamente un dispositivo con `lastKnownState.state = "unavailable"`, mantienen sus datos visibles y bloquean sus controles hasta que Home Assistant vuelva a reportarlo.
- [ ] AC10: La cortina conserva la animación de persiana vertical existente y utiliza colores semánticos del tema para mantener contraste en modo claro y oscuro, sin sustituirla por una representación visual diferente.
- [ ] AC11: Inicio adopta una jerarquía residencial calmada: encabezado personal, escenas favoritas, automatizaciones favoritas y sugerencias inteligentes, sin listar habitaciones ni dispositivos.
- [ ] AC12: Crear un panel genera una primera pestaña utilizable y cualquier fallo API aparece en la vista sin descartar los datos existentes.
- [ ] AC13: Crear una escena permite seleccionar dispositivos controlables por capacidades, no solo por el valor literal de `type`, y muestra el error real del API si no puede guardarse.
- [ ] AC14: El chat mantiene el compositor visible sobre el teclado virtual en tablet y móvil.
- [ ] AC15: Los cambios de dispositivos se propagan globalmente por eventos en tiempo real y reconciliación periódica sin ocultar datos existentes.
- [ ] AC16: Inicio muestra únicamente escenas marcadas como favoritas en la sección de escenas rápidas.
- [ ] AC17: La edición de paneles distingue eliminar panel de eliminar pestaña, confirma ambas acciones, expone claramente el alta de pestañas y mantiene la gestión de widgets centrada dentro del tablero.
- [ ] AC18: Auditoría presenta el nombre HomePilot del dispositivo junto a su identificador.
- [ ] AC19: Usuarios y accesos conserva completos rol, estado y controles administrativos en tablet.
- [ ] AC20: Las pestañas/ventanas de panel pueden renombrarse y eliminarse sin eliminar el panel completo.
- [ ] AC21: Las cámaras importadas desde Home Assistant/ONVIF se renderizan mediante el componente modular de cámara y permanecen sin controles de toggle.
- [ ] AC22: La shell elimina las barras horizontales superior e inferior en escritorio. El control del sidebar vive junto a la marca HomePilot Edge y el encabezado de Inicio muestra ciudad configurada, hora local y la temperatura actual de esa ciudad, con un estado explícito cuando el servicio meteorológico no está disponible.
- [x] AC23: Las automatizaciones pueden marcarse como favoritas y únicamente esas aparecen en Inicio. La preferencia pertenece al usuario y se conserva de forma durable en backend, separada de escenas; los IDs inaccesibles se ignoran y los favoritos locales válidos se migran una sola vez sin reemplazar los existentes.
- [ ] AC24: El Gestor de Dispositivos resuelve cada dispositivo asignado por capacidades y semántica: cámaras usan `CameraDeviceTile`, cortinas usan `CurtainDeviceTile` y luces, interruptores o sensores usan `DashDeviceTile`. `InboxDeviceTile` queda reservado para el flujo de descubrimiento y asignación.
- [ ] AC12: La identidad visual Nezu utiliza `#D9542B` como color primario, `#C9DF38` exclusivamente para Eco/eficiencia y `#1A1A1A` como ancla neutra. El azul deja de representar marca o estado activo.
- [ ] AC13: Los estados físicos se distinguen por significado: iluminación activa en ámbar cálido, cortinas y acciones de marca en naranja Nezu, Noche en violeta tenue, Eco en lima y apagado/no disponible en neutros accesibles.
- [ ] AC14: Inicio evita analítica decorativa, microtexto técnico y efectos visuales excesivos. La información operativa existente permanece disponible mediante composición clara y controles con contraste equivalente en modo claro y oscuro.
- [x] AC25: Inicio usa una imagen ambiental residencial local, no dependiente de red, como contexto visual del saludo. Mantiene legibles ciudad, hora, temperatura, rutinas y sugerencias, y conserva sus acciones, contratos y comportamiento responsive.
- [x] AC26: Inicio y Rutinas solo reciben escenas y automatizaciones pertenecientes al hogar del usuario autenticado; solicitar explícitamente un hogar ajeno es rechazado por la API.
- [x] AC27: Al abrir Tableros mientras el sidebar carga el mismo catálogo, ambos consumidores comparten una sola lectura; regresar durante la ventana corta de frescura reutiliza el resultado, una edición lo invalida y cambiar de sesión nunca reutiliza datos anteriores.
- [x] AC28: Entrar o regresar al Asistente no dispara `POST /assistant/scan`; el botón de escaneo manual sigue funcionando y los hallazgos existentes se consultan al abrir la vista.
- [x] AC29: Las lecturas de escenas y automatizaciones se comparten entre vistas durante un intervalo breve sin reutilizar datos entre sesiones; las ediciones invalidan la respuesta y una solicitud previa no puede reponer datos obsoletos en la caché.
- [x] AC30: Al navegar de Espacios a Rutinas, hogares, dispositivos y habitaciones ya obtenidos se reutilizan durante la ventana de frescura del snapshot sin repetir sus solicitudes; las mutaciones de topología actualizan el snapshot y solo se muestran habitaciones del hogar autorizado.
- [x] AC31: Inicio omite «Mi Hogar» y muestra saludo y frase según una misma regla horaria de mañana, tarde o noche. Un Admin puede configurar globalmente las tres frases, cada una de hasta 1000 caracteres con validación en UI y API; los demás usuarios autenticados pueden leerlas, pero no modificarlas. Las frases vacías son válidas: se muestra la frase disponible más próxima según prioridad mañana→tarde→noche, tarde→mañana→noche o noche→tarde→mañana; si ninguna existe, se usa el texto neutral. Guardar muestra estado ocupado, éxito o error sin envíos simultáneos. Las frases extensas se muestran completas y sin desbordamiento en el hero.
- [x] AC32: Un Admin puede gestionar hasta cinco imágenes JPEG, PNG o WebP del hero mediante el almacenamiento persistente de medios existente en la MiniPC. Los archivos usan slots contiguos `image_home_1` a `image_home_5`, se compactan al eliminar sin dejar huérfanos y no se guardan como binarios en SQLite. La API rechaza formatos, tamaños o cantidades inválidas y deniega escrituras no autorizadas. Carga y eliminación muestran progreso y resultado; eliminar exige confirmación. Las URLs versionadas por metadatos del archivo permiten caché privada e invalidación tras cambios o compactación, sin alterar nombres físicos.
- [x] AC33: Inicio conserva la imagen ambiental actual cuando no hay imágenes personalizadas, muestra una imagen estática cuando hay una y alterna de dos a cinco en orden de slot cada diez segundos, con transición discreta, dimensiones estables y respeto por movimiento reducido. Saludo y frase permanecen alineados arriba y legibles en los tamaños y orientaciones soportados.
- [x] AC34: Fuera de Inicio, 120 segundos sin interacción humana de puntero, toque, teclado o scroll devuelven mediante navegación SPA a Inicio sin cerrar sesión; renderizados, sensores y timers no reinician el plazo. El flujo considera las protecciones existentes para edición o modales activos y se verifica con pruebas de regresión y responsive.
- [x] AC35: Seleccionar una vista principal desde el Sidebar o retornar a Inicio por inactividad posiciona al inicio el contenedor de scroll efectivo; cambiar una pestaña o modal interno no reinicia el desplazamiento.
- [x] AC36: Las escenas favoritas pertenecen al usuario autenticado y persisten en backend entre dispositivos. Solo se aceptan escenas accesibles; las inexistentes o inaccesibles no se muestran. Una migración puntual une favoritos legacy locales válidos con los del backend sin borrar preferencias existentes, tras lo cual backend es la única autoridad.
- [x] AC37: Las Sections del Dashboard se disponen en slots independientes para cada número efectivo de columnas (1–4). Arrastrar a un slot vacío conserva el hueco anterior; soltar sobre uno ocupado intercambia Sections. Los huecos persisten sin decoración fuera de edición. Dashboards antiguos derivan posiciones contiguas; guardado, revisiones, import/export y permisos compartidos conservan el layout.
- [x] AC38: Inicio mantiene Ubicación como indicador no interactivo y presenta un reloj digital de cuatro fichas (HH:MM) en lugar de los módulos cuadrados de hora y clima. Las cifras que cambian realizan una transición vertical de tipo flip al pasar cada minuto; los dos puntos parpadean cada segundo, con alternativa sin animación para movimiento reducido. La hora, fecha y clima reutilizan la fuente y el formateo de Clock, sin modificar el widget Clock del Dashboard.
- [x] AC39: El acceso al Dashboard propio se presenta como un botón compacto y accesible hacia la derecha del hero en celular, tablet y escritorio. Muestra el icono de tablero, «Ir a tablero» y una sola flecha, con superficie cálida contrastada y respuesta breve al hover, foco y pulsación, sin ondas continuas ni gesto obligatorio. Clic, toque, Intro y Espacio abren la pestaña propia marcada «Abrir al cargar». Si no existe la pestaña, el control queda deshabilitado con explicación clara; los indicadores informativos no aparentan ser acciones.
- [x] AC40: En Inicio, el saludo y el nombre real se muestran en dos líneas, seguidos por la frase configurable completa y por el reloj digital de fichas. Bajo el reloj aparecen tres chips informativos compactos, no interactivos, de ciudad (sin «Ubicación»), fecha local y clima actual con estado no disponible cuando corresponda. El contenido queda a la izquierda bajo una frase que ocupa aproximadamente la mitad del hero cuando hay espacio. «Ir a tablero» permanece separado a la derecha/inferior, con reflow sin desbordamiento en pantallas estrechas y traducción EN. El hero incorpora «HomePilot / by NEZU» discretamente y el pie del Sidebar «Powered by NEZU», también en modo colapsado sin desbordamiento.
- [x] AC41: Escenas y automatizaciones favoritas usan la misma tarjeta de acción momentánea del Dashboard en una grilla compacta adaptable. Pulsar ejecuta una vez, sin activar/desactivar automatizaciones; muestra estado ocupado, éxito o error temporal accesible y evita dobles ejecuciones. La persistencia de favoritos por usuario no cambia.
- [x] AC42: Cada Section modular ocupa un solo slot: no existe selector de ancho. Creación, edición, guardado, importación, lectura y restauración normalizan únicamente su span exterior a 1; las tarjetas internas, orden y slots vacíos por perfil 4/3/2/1 permanecen intactos, incluso para Sections históricas multitrack.
- [x] AC43: Escenas y automatizaciones admiten un icono opcional configurado con el picker existente al crear o editar. El icono persiste en SQLite, se devuelve por API y se conserva tras recarga y respaldo/restauración; las entidades históricas sin icono muestran un fallback estable, sin migración destructiva. La migración `033` solo añade una columna nullable a automatizaciones; revertir el binario conserva los datos y deja esa columna inerte, sin borrarla.
- [x] AC44: El mismo icono de cada escena/automatización se muestra en su lista, en botones de acción enlazados del Dashboard y en favoritas de Inicio. Estas últimas usan exclusivamente el tile real `SectionActionCard` con icono y nombre, sin subtítulos de tipo ni recuento; la ejecución sigue siendo momentánea mediante `/run` para automatizaciones, sin toggle ni cambios en favoritos persistidos.
- [x] AC45: El saludo y la frase de Inicio pasan de tarde a noche a las 18:30 hora local, con actualización automática en ese límite. Los constructores de escenas y automatizaciones excluyen cámaras físicas o reclasificadas; sensores y demás identidades no cámara permanecen visibles, pero una escena no permite seleccionar dispositivos sin un comando compatible.
- [x] AC46: Escenas y automatizaciones ofrecen acciones momentáneas `press`/`activate` únicamente cuando las capacidades reales del dispositivo las admiten, aunque su etiqueta semántica sea luz. Se ejecutan una vez y no se presentan como estado ON/OFF. Los comandos y registros históricos conservan su formato; dispositivos sin comandos compatibles siguen sin poder seleccionarse como acciones.

## 9. Notas Técnicas y Arquitectura
- El backend actual debe exponer (si no lo hace aún) los endpoints mínimos para soportar estas vistas (ej. REST V1 `GET /api/devices/inbox`, `POST /api/devices/{id}/assign`, etc.).
- Como el frontend es meramente una consola Edge Operator, se asumirá una entrega estática (Static Bundle) servida directamente por el backend de HomePilot o un puerto contiguo.
- Se fomentará el uso de tecnologías que respeten las exigencias del proyecto: tipado estricto (TypeScript) en el frontend, y coherencia arquitectónica entre el modelo de llamadas locales.

## 10. Preguntas Abiertas / TODOs
- TODO: ¿Se utilizará un framework JS como Next.js/Vite en modo estático para este cliente, o se armará de forma nativa mínima para ahorrar dependencias en el binario Edge?
- TODO: ¿Será necesario implementar Polling, SSE (Server-Sent Events) o WebSockets iniciales para el refreso en tiempo real de los estados o bastará con F5 (recarga natural) para esta V1?
- TODO: ¿Las credenciales estáticas de "Admin Local" estarán hardcodeadas en una constante de entorno para el acceso Edge o se entra ciegamente sin barreras?
