# Spec: Navegación de Tableros por Usuario

## Problema
La consola mostraba "Paneles" como una pantalla única y además repetía una navegación interna de paneles dentro del contenido. Para un flujo similar a Home Assistant, los tableros deben vivir como una familia de navegación del sidebar, evitando llenar la navegación principal y evitando duplicar listas dentro de la pantalla.

## Alcance
- Cambiar la etiqueta visible de `Paneles` a `Tableros` en español y mantener `Dashboards` en inglés.
- Mostrar `Tableros/Dashboards` como un grupo colapsable del sidebar.
- Listar debajo los tableros disponibles para el usuario autenticado.
- Mostrar el logo visual de Nezu en la cabecera del sidebar.
- Mostrar las pestañas de cada tablero como una barra horizontal superior similar al patrón de Home Assistant.
- La pantalla de tableros no debe mostrar hero/banner grande permanente; la navegación y edición deben vivir en una barra superior compacta.
- El lápiz de una vista debe abrir un modal de configuración con secciones `Configuraciones`, `Fondo` y `Visibilidad`.
- La sección de `Tableros` en el sidebar debe poder abrirse/cerrarse sin forzar navegación al dashboard.
- Crear automáticamente un tablero base por usuario activo cuando no exista.
- Mantener la pantalla de tablero minimalista, responsiva y alineada al design system de HomePilot.

## Fuera de Alcance
- Balanceo masonry por "columna más corta" (se usa flujo por orden con dense-packing sobre CSS Grid, técnica equivalente a Home Assistant "Sections"); el balanceo estricto por altura de columna queda como mejora futura.
- Crear dashboards multi-home avanzados.

## Requisitos Funcionales
1. La navegación principal debe mostrar `Tableros` como padre colapsable en español y `Dashboards` en inglés.
2. Al abrir el grupo, cada tablero visible debe aparecer como hijo de navegación sin duplicar una lista interna dentro de la pantalla.
3. Al cargar `/api/v1/dashboards`, el backend debe garantizar que el usuario autenticado tenga al menos un tablero base.
4. La visibilidad de dashboards y vistas debe resolverse por usuario: ser propietario o estar incluido explícitamente en `visibility.users`.
5. El rol `admin` no debe dar visibilidad automática a dashboards o vistas de otros usuarios.
6. La vista de tablero debe permitir seguir creando, renombrando, editando, agregando pestañas y eliminando con los flujos existentes.
7. El catálogo de tarjetas de una sección debe incluir una tarjeta de sensor para dispositivos `sensor` y `binary_sensor` ya importados al inventario local de HomePilot.
8. La tarjeta de sensor debe ser informativa: muestra el último estado local sincronizado, su unidad y el contexto disponible sin exponer acciones de encendido o apagado.
9. Cuando el sensor represente batería, la tarjeta debe mostrar un indicador porcentual legible; las mediciones y estados no numéricos deben conservar su valor sin inventar una lectura.
10. El catálogo de tarjetas debe incluir un reproductor multimedia para entidades `media_player` ya importadas al inventario local de HomePilot.
11. La tarjeta multimedia debe mostrar el último estado y metadatos sincronizados localmente; sus controles de encendido, reproducción y pausa solo estarán disponibles si el perfil local del dispositivo declara el comando correspondiente. La presentación debe priorizar portada, título, artista, controles compactos y progreso, sin controles de tamaño desproporcionado.
11.1. Cuando la entidad multimedia importada publique una portada local (`entity_picture_local`) o remota (`entity_picture`), HomePilot debe priorizar la ruta local y mostrarla en la tarjeta mediante un proxy autenticado. Los tokens efímeros incluidos por Home Assistant en `entity_picture_local` no pueden persistirse ni exponerse al navegador: HomePilot debe obtener la imagen con el token administrativo del bridge. La portada debe entregarse como una respuesta de imagen completa con `Content-Length`, compatible con el túnel de acceso externo. El preview debe reutilizar exactamente la misma tarjeta sin recortar sus controles.
12. En modo edición, el placeholder para crear una nueva zona debe colocarse en una fila completa inmediatamente después de la zona más baja del tablero; no puede compartir ni superponerse a una fila de zonas existente, incluso cuando una zona contiene tarjetas altas como cámaras, relojes o reproductores multimedia. La posición y el alto del canvas deben calcularse desde el contenido actual y no desde alturas heredadas de secciones antiguas.
13. Las tarjetas internas de una zona deben adaptar sus columnas al ancho real de la zona. Sus selectores solo pueden mostrar entidades locales compatibles con el tipo de tarjeta.
14. El fondo configurado de una vista debe cubrir como mínimo toda el área visible del tablero, detrás del contenido y sin recortarse al alto inicial de sus widgets.
15. El placeholder para la primera zona debe ubicarse inmediatamente después del área de título real, incluso si un tablero existente tiene un título más alto que el tamaño predeterminado.
16. En modo edición, el lápiz del título del tablero debe abrir un editor que persista el contenido Markdown local de ese título. La ejecución de una acción multimedia debe mostrar únicamente un indicador pequeño, sin desenfocar ni bloquear visualmente la tarjeta.
17. El modo de edición de escritorio debe conservar el grid de 3 columnas y los placeholders de creación cuando el área útil del lienzo mida al menos 1024px, incluso si el sidebar reduce el ancho disponible de la ventana.
18. Las tarjetas de control de dispositivos deben comunicar encendido y apagado mediante su color, borde e icono, sin mostrar una etiqueta textual de estado. El selector de iconos de las tarjetas debe incluir Material Design Icons de Home Assistant y conservar los iconos Lucide almacenados previamente.
19. El canvas del tablero debe fluir en columnas responsivas por orden (1 columna en móvil, 2 en tablet, 3 en escritorio), al estilo de las "Sections" de Home Assistant: cada zona ocupa un ancho de columna discreto (1..N) y el usuario puede reordenar zonas arrastrándolas, en cualquier tamaño de pantalla.

## Criterios de Aceptación
- **AC1:** En español el sidebar muestra `Tableros`; en inglés muestra `Dashboards`.
- **AC2:** `Tableros` se comporta como sección colapsable y lista los dashboards debajo.
- **AC3:** Si el usuario autenticado no tiene tablero, `GET /api/v1/dashboards` crea y devuelve un tablero base para ese usuario, incluyendo usuarios con rol `guest`.
- **AC4:** La pantalla de dashboards no muestra una segunda lista lateral de tableros dentro del contenido.
- **AC5:** Seleccionar un tablero hijo desde el sidebar abre la vista `dashboards` y muestra ese tablero.
- **AC6:** La UI conserva comportamiento responsive en móvil, tablet y escritorio sin crear stores globales nuevos.
- **AC7:** El sidebar muestra el logo de Nezu sin depender de rutas absolutas del sistema operativo.
- **AC8:** Las pestañas del tablero se muestran como navegación horizontal con acciones de edición visibles cuando el tablero está en modo edición.
- **AC9:** El sidebar no muestra separadores ni encabezados de grupo para `Personalización`; los accesos se listan como items normales.
- **AC10:** Presionar la flecha del grupo `Tableros` abre o cierra sus hijos sin bloquearse por la navegación.
- **AC11:** Presionar el lápiz de una vista abre un modal de configuración con pestañas internas de configuración, fondo y visibilidad.
- **AC12:** Los placeholders de creación de widgets/secciones se alinean con el mismo CSS Grid que las tarjetas reales, fluyendo en el mismo orden que las zonas, sin posicionamiento absoluto que ignore los gaps del layout.
- **AC13:** Las tarjetas dentro de una sección son responsivas y accionables: luces/dispositivos/cortinas ejecutan su comando local y refrescan estado; cámaras abren el visor completo sin mantener doble reproducción.
- **AC14:** El catálogo de tarjetas de sección no expone la tarjeta legacy `system`; si existe data antigua persistida con esa tarjeta, la normalización debe ignorarla sin romper el tablero.
- **AC15:** El flujo de edición no expone el inspector legacy de widgets ni presets `XS/S/M/L/XL`; las tarjetas se gestionan desde secciones con dimensiones de filas/columnas.
- **AC16:** La configuración de vista no muestra opciones de diseño no implementadas para el usuario final; conserva el layout existente y permite configurar título, icono, fondo y visibilidad.
- **AC17:** La visibilidad de una vista se respeta en frontend filtrando pestañas por usuario; el propietario ve sus vistas y un usuario externo solo ve pestañas donde su id esté incluido en `visibility.users`.
- **AC18:** La visibilidad de dashboards se respeta en backend sin bypass por rol: un admin no ve dashboards de otro usuario salvo que sea propietario o esté incluido en `visibility.users`.
- **AC19:** Al borrar una pestaña de tablero o remover su fondo, los archivos físicos del fondo en `data/media/dashboards/<dashboardId>/<tabId>` se eliminan.
- **AC20:** Los tableros visibles se ordenan priorizando el tablero propio del usuario autenticado para que un invitado no aterrice por defecto en un tablero compartido ajeno.
- **AC21:** Un usuario `guest` puede leer hogares y habitaciones del appliance local para renderizar Inicio/Espacios/Tableros, pero no puede crear, renombrar ni eliminar hogares o habitaciones.
- **AC22:** El catálogo permite crear una tarjeta `Sensor`; su selector solo lista dispositivos semánticos `sensor` o `binary_sensor` presentes en el inventario local de HomePilot.
- **AC23:** Una tarjeta de sensor muestra el último `state` sincronizado localmente y, cuando existe, `unit_of_measurement`; las tarjetas de batería usan un indicador de 0 a 100 sin enviar comandos al dispositivo.
- **AC24:** Si un sensor no tiene lectura o Home Assistant lo reporta como no disponible, la tarjeta muestra un estado no disponible y no fabrica un valor numérico.
- **AC25:** El selector de una tarjeta multimedia solo lista entidades `media_player` ya importadas a HomePilot; no consulta ni depende de la interfaz de Home Assistant.
- **AC26:** La tarjeta multimedia ejecuta `turn_on`, `turn_off`, `media_play` o `media_pause` únicamente cuando el dispositivo los soporta, y refresca el snapshot local tras una ejecución satisfactoria.
- **AC27:** Tras crear cuatro o más zonas, el control para añadir la siguiente zona aparece debajo de todas las zonas existentes (siempre es el último elemento del flujo) y la nueva zona se inserta al final sin solapar contenido previo.
- **AC28:** Con cuatro zonas en el tablero, las tarjetas pequeñas no desbordan su título ni su estado; el selector de Luz/Cortina/Cámara/Sensor/Multimedia presenta únicamente dispositivos locales del tipo respectivo.
- **AC29:** Con un fondo configurado, el tablero cubre al menos la altura visible completa del área de contenido sin dejar un lienzo plano debajo de sus widgets.
- **AC30:** Un tablero con un título alto muestra el placeholder de su primera zona debajo del título sin requerir redimensionar la ventana ni solaparlo (el título ocupa su propia fila completa y el flujo continúa inmediatamente debajo).
- **AC31:** El lápiz del título permite editar y guardar el texto que se muestra en el encabezado del tablero; al ejecutar un control del reproductor, la tarjeta conserva visible su contenido y solo muestra un indicador compacto de procesamiento.
- **AC32:** Con una ventana de escritorio al 100% de zoom y un lienzo de al menos 1024px, el tablero no cambia a la composición de tablet: mantiene el grid de 3 columnas, sus zonas y el placeholder de creación visibles.
- **AC33:** Una tarjeta de control activa se distingue visualmente de una apagada sin un chip de texto `Encendido/Apagado`, y sus iconos pueden seleccionarse desde el catálogo Material Design Icons sin invalidar iconos existentes.
- **AC34:** En cualquier tamaño de pantalla (móvil, tablet, escritorio), arrastrar una zona por su asa de arrastre la reordena dentro del flujo y el nuevo orden persiste tras recargar.
- **AC35:** El ancho de una zona se controla con un selector discreto (1..N columnas según el breakpoint activo); el valor persiste aunque un breakpoint más angosto lo clamée visualmente sin sobrescribir el dato guardado.
