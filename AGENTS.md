# Directrices para Agentes de IA

Este repositorio depende en gran medida de agentes de inteligencia artificial (como GitHub Copilot, Claude, Gemini, etc.) para el desarrollo, utilizando un enfoque de Context Engineering (Ingeniería de Contexto) y Desarrollo Basado en Especificaciones (Spec-Driven Development - SDD).

Para asegurar la mantenibilidad a largo plazo y prevenir regresiones inducidas por IA, **TODOS LOS AGENTES DEBEN CUMPLIR CON ESTAS REGLAS CRÍTICAS:**

## 1. Sin Suposiciones, Sin Lógica Oculta
- Explícito es mejor que implícito.
- Si un requerimiento o límite no está claro, NO llenes los espacios en blanco. Márcalo como un `TODO` o pregunta explícitamente al usuario para obtener claridad.
- No inventes lógica de negocio. Únicamente implementa lo que está escrito explícitamente en la especificación.

## 2. Seguir Siempre las Especificaciones (Specs)
- Toda tarea de implementación DEBE rastrearse de vuelta hacia un documento de especificación ubicado en `/specs/`.
- Si la especificación está incompleta, actualiza la especificación primero (y obtén aprobación del usuario) antes de escribir código.
- Valida tu implementación respecto a los Criterios de Aceptación ("Acceptance Criteria") definidos en la especificación.

## 3. Mantener los Cambios Pequeños y Acotados
- No realices refactorizaciones masivas a través de todo el código (codebase) a menos que se te indique explícitamente.
- Respeta los límites de la tarea asignada. Si ves código desordenado no relacionado, ignóralo o propón una tarea separada para arreglarlo después.

## 4. Respetar los Límites Arquitectónicos
- HomePilot utiliza una arquitectura modular estricta (definida en `/docs/architecture.md`).
- No acoples directamente la capa Edge con la capa Cloud.
- No eludas (bypass) la inyección de dependencias, las interfaces o los límites de dominio (bounded contexts).

## 5. Explicitud por Encima de Ingenio (Cleverness)
- Evita el código "ingeonioso", altamente anidado o excesivamente corto/críptico.
- Prefiere implementaciones que sean legibles, estrictamente tipadas y bien documentadas.
- Escribe pruebas (tests) para demostrar que la implementación cumple con la especificación.
