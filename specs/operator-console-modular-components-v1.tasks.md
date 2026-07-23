# Tareas: Operator Console Modular Components V1

## Implementado

- [x] Catálogo de primitivos, navegación, feedback, contenedores y dispositivos comunes.
- [x] Contratos de responsive, accesibilidad, i18n, loading y tokens.
- [x] Mapeo de cobertura de los componentes compartidos.
- [x] Consolidación de todos los selectores generales de Escenas, Automatizaciones, editor de tableros, usuarios, cámaras e inspección en `SearchableSelectField`.
- [x] Consolidación de acciones textuales generales de autenticación, confirmación, perfil, escenas y automatizaciones en `Button`; las acciones exclusivamente icónicas usan `IconButton`.
- [x] Consolidación de campos generales de texto y contraseña en `Input`, incluidos onboarding, topología, escenas e inspector; los rangos, archivos, áreas de texto, radios y entradas de dominio mantienen controles especializados.
- [x] Consolidación de texto multilínea general en `Textarea`; el compositor conversacional conserva su control especializado por voz, atajos y envío.
- [x] Consolidación del marco de automatizaciones en `Modal`, con cabecera alineada, contenido desplazable y etiqueta de cierre traducida.
- [x] Consolidación de las acciones e input en línea de la navegación de tableros con `Button`, `IconButton` e `Input`, incluyendo etiquetas accesibles traducidas para confirmar y cancelar.
- [x] Consolidación de acciones e inputs de la configuración de vistas de tableros con `Button`, `IconButton` e `Input`; los controles de rango, archivo, selección de visibilidad y pestañas conservan su semántica especializada.
- [x] Consolidación de acciones compactas del inspector de dispositivos con `Button` e `IconButton`; el switch de inversión de cortinas conserva su semántica de control especializado.
- [x] Consolidación del selector de disparador y campo de valor esperado del constructor de automatizaciones con `SegmentedControl` e `Input`; el selector múltiple de días mantiene su interacción especializada.
- [x] Consolidación de las acciones de las reglas operativas de automatización con `Button` e `IconButton`, preservando el estado de procesamiento y la confirmación explícita de eliminación.
- [x] Consolidación de la selección de estancia dentro de las acciones del Asistente con `Button`, manteniendo el estado seleccionado y el indicador de confirmación.
- [x] Consolidación del selector de imagen del perfil de usuario con `IconButton`; el control de recorte continuo mantiene el rango nativo por requerir entrada gradual.
- [x] Consolidación de los controles internos de `AudioInputPicker` con `Button`, conservando los roles de lista, selección y cierre del selector de audio.
- [x] Consolidación de acciones de usuarios, tarjetas de dispositivos y registros de ejecución con `Button` e `IconButton`, preservando asignación, cambio de estado, reintento y acciones de seguridad existentes.
- [x] Consolidación de las acciones iconográficas de las tarjetas de escenas con `IconButton`; la ejecución principal se mantiene en la tarjeta para preservar su interacción actual.
- [x] Consolidación de favorito, estado, edición y eliminación de tarjetas de automatización con `Button` e `IconButton`, incluyendo etiquetas de resiliencia traducidas.
- [x] Consolidación de controles internos de tarjetas agrupadas del Asistente con `Button` e `IconButton`; el encabezado expandible conserva semántica de divulgación accesible sin anidar botones.
- [x] Consolidación de acciones convencionales de Auditoría, Registros de ejecución y Energía con `Button`; los controles especializados conservan su semántica propia.
- [x] Consolidación de tarjetas ejecutables de Rutinas favoritas con `Button`, preservando ejecución de escenas, alternancia de automatizaciones y estados de procesamiento.
- [x] Consolidación de acciones de aviso y administración de tarjetas de cámaras nativas con `Button` e `IconButton`, reutilizando etiquetas traducidas y estados visuales compartidos.
- [x] Consolidación de acciones de cierre y omisión del Demo Guiado con `IconButton` y `Button`, preservando navegación, área táctil y traducciones compartidas.
- [x] Creación de `ToggleSwitch` accesible y migración de configuración de vista e inversión de cortina en el inspector, evitando implementaciones booleanas duplicadas.
- [x] Consolidación de la selección exclusiva de comandos en el constructor de escenas con `SegmentedControl`, preservando comandos de energía y cortina por capacidad.
- [x] Consolidación de placeholders y controles flotantes del lienzo de tableros con `Button`, `IconButton` y `SegmentedControl`; el agarre de arrastre conserva su semántica especializada.
- [x] Consolidación de la acción de apagar dispositivos activos de la tarjeta de habitación con `Button` y estado de carga compartido.
- [x] Consolidación de acciones convencionales del editor de encabezados de tablero con `Button` e `IconButton`; los controles de alineación y navegación por pestaña preservan su semántica especializada.

## Verificación obligatoria ante cambios

- [ ] Probar teclado, foco, lector de pantalla y áreas táctiles.
- [ ] Probar 320px, móvil, tablet y escritorio sin overflow no intencional.
- [ ] Probar ES/EN, texto largo, error, vacío, loading y disabled.
- [ ] Confirmar que tamaños, espaciados y colores consumen tokens vigentes.
