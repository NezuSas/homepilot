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

## Verificación obligatoria ante cambios

- [ ] Probar teclado, foco, lector de pantalla y áreas táctiles.
- [ ] Probar 320px, móvil, tablet y escritorio sin overflow no intencional.
- [ ] Probar ES/EN, texto largo, error, vacío, loading y disabled.
- [ ] Confirmar que tamaños, espaciados y colores consumen tokens vigentes.
