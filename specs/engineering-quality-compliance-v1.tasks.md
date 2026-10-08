# Tareas: Engineering Quality Compliance V1

- [x] AC1: `check:spec-coverage` verifica estado, tarea y criterios de aceptación de todas las specs primarias y registradas.
- [x] AC2: Crear matriz de trazabilidad por bounded context.
- [x] AC3: `check:bdd-traceability` exige 22 flujos únicos Given/When/Then, incluido el snapshot y timeline de diagnósticos autenticados.
- [x] AC4: `check:module-test-coverage` exige una suite de comportamiento por módulo mantenido; Automation queda cubierto por su suite conductual en Devices.
- [x] AC5: Extraer persistencia de los handlers a repositorios inyectados y bloquear SQL directo desde rutas. Evidencia: `npm run check:architecture-boundaries`.
- [x] AC6: Añadir quality gates reproducibles en CI.
- [x] AC6: Separar CI ordinario no visual y validación completa local/manual, sin eliminar pruebas ni reducir umbrales. Cubrir la composición de scripts y los triggers con pruebas; validación larga y ejecución remota del nuevo workflow pendientes del usuario.
- [x] AC6: Sustituir repetición automática del pre-push por comprobación de evidencia completa vigente y runtime actual; invalidar evidencia al fallar, caducar o cambiar código/condiciones comprobadas. Pruebas focalizadas de composición y evidencia: 21 PASS. No se importan resultados anteriores ni se desactivan controles.
- [ ] AC6: Ejecutar la nueva validación completa local y comprobar el primer push con evidencia; ejecución larga reservada al usuario. CI remoto y deploy no ejecutados por el agente.
- [x] AC6: Clasificar exports locales `/ci-failed-[0-9]*.txt` como artefactos ignorados sin excluir fuentes ni TXT generales; conservar archivos y no publicar logs. Pruebas focalizadas: 22 PASS. La evidencia anterior no se migra ni se falsifica.
