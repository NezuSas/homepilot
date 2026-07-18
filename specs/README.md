# Especificaciones (Specs)

## Spec-Driven Development (SDD) en HomePilot

Bienvenido al directorio `/specs` de HomePilot. En este proyecto, seguimos estrictamente el Desarrollo Basado en Especificaciones (Spec-Driven Development).

**Regla #1: No se escribe ningún código sin una especificación.**

## El Flujo de Trabajo (Workflow)

1. **Redacción de una Especificación (Drafting a Spec)**: Antes de comenzar cualquier funcionalidad, refactorización o cambio de infraestructura, se debe crear un documento de especificación en formato markdown en este directorio utilizando el `spec-template.md`.
2. **Revisión y Refinamiento (Review & Refinement)**: La especificación se revisa para garantizar consistencia arquitectónica, definir explícitamente el alcance e identificar casos límite (edge cases). Todas las suposiciones deben neutralizarse.
3. **Generación de Tareas (Task Generation)**: Una vez aprobada la especificación, se definen las tareas accionables.
4. **Implementación (Implementation)**: Agentes de IA o desarrolladores humanos implementan el código *exactamente* como se describe en la especificación. No se permiten adiciones no aprobadas.
5. **Validación (Validation)**: El código implementado se verifica respecto a los Criterios de Aceptación (Acceptance Criteria) definidos en la especificación.

Este proceso garantiza que a medida que el sistema crece, el contexto se preserva en lenguaje claro, y los agentes de IA tienen reglas concretas a seguir, previniendo alucinaciones y la extensión excesiva del alcance (scope creep).

## Matriz de trazabilidad obligatoria

La cobertura vigente entre dominios, rutas, vistas y specs se mantiene en
[`docs/spec-coverage-matrix.md`](../docs/spec-coverage-matrix.md). Antes de
modificar una funcionalidad se debe identificar su spec primaria en esa matriz.

Para toda funcionalidad nueva o cambio de comportamiento:

1. Crear o actualizar una spec usando `spec-template.md`.
2. Crear o actualizar el archivo `<spec>.tasks.md` asociado.
3. Declarar alcance, fuera de alcance, permisos, datos modificados, errores y
   criterios de aceptación comprobables.
4. Implementar únicamente después de que la spec refleje el comportamiento
   acordado.
5. Validar los criterios de aceptación y los comandos definidos por `AGENTS.md`.

Una vista de composición puede heredar la spec del dominio que representa. Una
nueva ruta, persistencia, permiso, integración o interacción funcional no puede
quedar sin spec propia o sin una ampliación explícita de la existente.

Los componentes modulares de Operator Console se rigen por
`operator-console-modular-components-v1.md`; los widgets de tablero mantienen
además `dashboard-layout-and-widgets-v1.md` como spec de comportamiento.

La trazabilidad de código se comprueba con:

```bash
npm run check:spec-coverage
```
