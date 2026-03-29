# Contribuir a HomePilot

HomePilot es un proyecto con enfoque arquitectónico donde prevalece lo explícito. Para mantener un alto estándar de calidad y preparación para IA (AI-readiness), imponemos un flujo de contribución estricto.

## El Flujo de Contribución

1. **No hay Commits Directos a Main.**
   - Todo trabajo debe realizarse en ramas (branches) formateadas (`feature/*`, `fix/*`, `chore/*`).
2. **Todo requiere un Pull Request (PR).**
   - Ningún código llega a `main` sin pasar por un Pull Request.
3. **Debe Referenciar una Especificación (Spec).**
   - Cada PR debe hacer referencia a un requerimiento específico de un documento aprobado en `/specs/`.
   - Se rechaza el desarrollo de código ad-hoc o improvisado.
4. **Debe Pasar la Validación.**
   - La comprobación de tipos (type-checking), el linter y las pruebas deben pasar exitosamente.
   - Los Criterios de Aceptación (Acceptance Criteria) de la especificación referenciada deben validarse explícitamente.

## Filosofía de Código
- **Los Tipos son Documentación**: Aprovecha al máximo el sistema de tipos. Evita el uso de `any` a toda costa.
- **Fail Fast & Loud (Falla Rápido y Ruidoso)**: No ocultes ni tragues (swallow) los errores. Si el sistema entra en un estado inválido, debería bloquearse (crash) o registrar un error extremadamente claro en los logs, en lugar de intentar seguir cojeando con datos corruptos.
- **Funciones Puras donde sea posible**: Minimiza los efectos secundarios (side effects) en la lógica de dominio para que las pruebas sean triviales de desarrollar.
- **Legible para IA (AI-Readable)**: Asegúrate de que los nombres sean altamente descriptivos. `calculateRoomTemperature` es mejor que `calcTemp`.

## Expectativas de Revisión (Review Expectations)
Al revisar un PR (ya sea humano o IA), evalúa:
- ¿Esto viola los límites (boundaries) definidos en `/docs/architecture.md`?
- ¿Esta lógica está contemplando y manejando los casos límite (edge cases)?
- ¿Son significativas las pruebas, o simplemente están probando el lenguaje mismo?
