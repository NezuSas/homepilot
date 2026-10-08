# Validación local completa reutilizable

La validación completa se ejecuta explícitamente:

```powershell
npm run verify:quality
```

Ejecuta primero todos los controles de `verify:ci`, después toda la suite
responsive, sin filtros. Solo al terminar ambos correctamente registra una
huella SHA-256 y fecha en `homepilot-quality-receipt.json` dentro del directorio
Git local. No se versiona ni se comparte; no contiene código, credenciales,
variables de entorno ni datos de clientes.

Después pueden hacerse staging y commit sin repetir las pruebas si los bytes
validados no cambian. El pre-push exige HEAD limpio, ningún archivo no ignorado
pendiente y que las revisiones publicadas correspondan a HEAD. Comprueba la
evidencia y después ejecuta `verify:local-control-runtime` de nuevo.

Si falta evidencia, tiene más de 24 horas, el código cambia o cambia alguna
condición comprobada, el push falla rápido e indica ejecutar `verify:quality`.
No inicia silenciosamente otra ejecución larga. Una ejecución fallida o
interrumpida invalida la evidencia anterior. Una prueba focalizada, un resultado
pegado en el chat o un CI ordinario no crean esta evidencia.

La huella incluye archivos registrados y no ignorados, incluso tests, scripts,
specs y archivos borrados; versión Node, plataforma/arquitectura, npm, lock
instalado, metadatos de ejecutables Playwright y condiciones CI/NODE_ENV/
NODE_OPTIONS/TZ/LANG/LC_ALL/PLAYWRIGHT_BROWSERS_PATH/
HOMEPILOT_RESPONSIVE_SERVER_MANAGED. Conserva las mismas condiciones entre
validación y push. Si una herramienta modifica archivos después de validar,
hay que validar de nuevo. Los archivos ignorados de runtime y artefactos
generados no forman parte del código validado.

Los exports locales de diagnóstico `/ci-failed-[0-9]*.txt` están ignorados
explícitamente: no se publican, no bloquean el push y pueden crearse o retirarse
sin invalidar nuevas evidencias. La regla solo aplica en la raíz y no excluye
todos los TXT, código ni tests. Un archivo ya registrado sigue siendo parte de
la huella incluso si después coincide con una regla de ignore. No borrar logs
ni agregarlos a Git para resolver este caso. Al introducir por primera vez la
regla, la evidencia antigua (que los incluía) queda obsoleta y hay que generar
una nueva validación completa; no se reescribe ni se reetiqueta como vigente.

Es evidencia operativa local, no una firma resistente a manipulación: no protege
contra alteraciones manuales internas de node_modules, cambios del sistema
operativo ni falsificación deliberada del archivo. Tras cambiar dependencias,
reparar la instalación o cambiar el entorno, ejecuta de nuevo la validación.
El control independiente de CI sigue intacto. Esto no autoriza un deploy ni
reemplaza `verify:release` y las verificaciones del entorno de destino.

No hay opción de importar éxitos anteriores ni argumento para omitir etapas.
La primera ejecución con este mecanismo requiere la suite completa una vez.
