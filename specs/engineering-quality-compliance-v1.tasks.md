# Tareas: Engineering Quality Compliance V1

- [x] AC1: `check:spec-coverage` verifica estado, tarea y criterios de aceptación de todas las specs primarias y registradas.
- [x] AC2: Crear matriz de trazabilidad por bounded context.
- [x] AC3: `check:bdd-traceability` exige 22 flujos únicos Given/When/Then, incluido el snapshot y timeline de diagnósticos autenticados.
- [x] AC4: `check:module-test-coverage` exige una suite de comportamiento por módulo mantenido; Automation queda cubierto por su suite conductual en Devices.
- [x] AC5: Extraer persistencia de los handlers a repositorios inyectados y bloquear SQL directo desde rutas. Evidencia: `npm run check:architecture-boundaries`.
- [x] AC6: Añadir quality gates reproducibles en CI.