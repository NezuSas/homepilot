# HomePilot — Directrices para Agentes de IA (STRICT)

Este repositorio utiliza agentes de IA bajo un enfoque de Context Engineering y Spec-Driven Development (SDD).

Estas reglas son OBLIGATORIAS. El agente debe cumplirlas sin excepción.

---

## 1. Sin Suposiciones, Sin Lógica Oculta
- Explícito es mejor que implícito.
- Si falta información, NO inventes lógica. Marca `TODO` o pide aclaración.
- No introduzcas reglas de negocio no especificadas.

---

## 2. Seguir Siempre las Especificaciones (Specs)
- Toda implementación debe rastrearse a `/specs/`.
- Si la spec está incompleta, actualízala primero (con aprobación) antes de codificar.
- Valida contra Acceptance Criteria.

---

## 3. Cambios Pequeños y Acotados
- Prohibidas refactorizaciones masivas sin instrucción explícita.
- Respeta el alcance. Ignora código no relacionado o propone tarea aparte.

---

## 4. Respetar los Límites Arquitectónicos
- Arquitectura modular estricta (ver `/docs/architecture.md`).
- No acoplar Edge y Cloud directamente.
- No hacer bypass de DI, interfaces ni bounded contexts.

---

## 5. Explicitud por Encima de Ingenio
- Evita código críptico o “clever”.
- Prefiere claridad, tipado estricto y legibilidad.
- Añade tests cuando aplique.

---

## 6. Regla de Terminación: Nada Parcial, Nada Roto
- Una tarea NO está terminada si deja:
  - variables, estados, imports o funciones sin uso
  - handlers duplicados
  - código comentado tipo "ready for integration"
  - lógica a medio integrar
- Prohibido devolver trabajo parcial.
- Si introduces errores de compilación, build o runtime, DEBES corregirlos antes de finalizar.

---

## 7. Validación Obligatoria Antes de Finalizar
Toda tarea frontend o full-stack DEBE pasar:

- `npm run typecheck`
- `npm run build`
- `npm run build --prefix apps/operator-console`

Si cualquiera falla:
- el trabajo NO está terminado
- debes seguir corrigiendo hasta dejarlo en verde
- NO devuelvas la respuesta hasta que todo pase

---

## 8. Regla de Alcance Estricto
- Modifica SOLO los archivos indicados.
- Si necesitas tocar otros, justifica y mantén el cambio mínimo.
- Prohibido expandir alcance por iniciativa propia.

---

## 9. Reglas React / Zustand (CRITICAS)
- NUNCA dependencias inestables en `useEffect`
- NUNCA loops de actualización o fetch
- NUNCA derivar arrays u objetos dentro de selectores Zustand si cambian referencia en cada render
- Preferir dependencias primitivas (`id`, `boolean`, `string`)
- Evitar `Maximum update depth exceeded` a toda costa

---

## 10. Reglas UX de Estado de Carga
- No ocultar datos existentes durante refresh
- No mostrar skeletons después de la carga inicial
- Mantener data previa visible mientras llega nueva
- Minimizar flicker y spinner churn
- No resetear secciones completas innecesariamente

---

## 11. Reglas de Implementación
- Preferir cambios incrementales y seguros
- No introducir nuevas abstracciones innecesarias
- No modificar contratos de API ni stores existentes sin autorización
- Mantener comportamiento actual estable

---

## 12. Específico para HomePilot Frontend (`apps/operator-console`)
- NO crear stores globales nuevos sin autorización explícita.
- NO modificar contratos API ni flujos backend sin autorización.
- Cuando store y UI usen tipos distintos, mapear localmente en vez de relajar tipos.
- No usar `any` ni castings para esconder errores.
- Respetar estrictamente los contratos de props de componentes.
- Si introduces un nuevo estado de carga, debe estar totalmente integrado o eliminado antes de terminar.

---

## 13. Formato de Respuesta Obligatorio
Responder SOLO con:
- archivos modificados
- cambios exactos realizados
- resultado de:
  - `npm run typecheck`
  - `npm run build`
  - `npm run build --prefix apps/operator-console`

NO incluir:
- "ready for integration"
- "next steps"
- trabajo parcial
- cambios pendientes
- código incompleto

---

## 14. Si hay duda
Si no puedes completar la tarea sin romper estas reglas:
- NO hagas cambios destructivos
- pide aclaración antes de continuar

---

## 15. Stack Vigente (actualizar si cambia)

| Capa | Tecnología | Notas |
|---|---|---|
| HTTP server | **Fastify v5** | Reemplaza `node:http` nativo desde Módulo 1 |
| WebSocket | `ws` library | Adjunto a `fastify.server` (upgrade event) |
| Body parsing | Fastify content type parsers | Cuerpo disponible en `request.raw._fastifyParsedBody` |
| CORS | Inline en catch-all handler | `reply.hijack()` bypasa lifecycle de Fastify |
| CI/CD | GitHub Actions | `.github/workflows/ci.yml` — typecheck + build + test en cada PR |
| RouteHandler | `apps/api/RouteHandler.ts` | Interfaz estable — NO modificar sin revisión |

### Restricciones Fastify
- NUNCA registrar rutas específicas de dominio en `ApiGateway.ts` — toda lógica de rutas va en `RouteHandler` implementations.
- NUNCA usar `reply.send()` o `reply.code()` en handlers que llamen a `reply.hijack()` — escribir directamente a `reply.raw`.
- `parseBody<T>` en `ApiRoutes` lee `_fastifyParsedBody` del raw request. NO reemplazar por `request.body` de Fastify sin actualizar todos los handlers.

## 16. Prohibición de Código Muerto y Estados Incompletos
- Está prohibido dejar variables, estados, imports, funciones, handlers o efectos declarados y no usados.
- Está prohibido dejar código parcial, comentado como pendiente, o “ready for integration”.
- Si durante una tarea se introduce una variable o estado nuevo, debe quedar completamente integrado o eliminado antes de finalizar.
- Si TypeScript, Vite o el build de Docker detectan código muerto o errores, la tarea NO está terminada.

## 17. Validación de Runtime y Docker (OBLIGATORIA para cambios de frontend o full-stack)
Además de las validaciones locales:
- `npm run typecheck`
- `npm run build`
- `npm run build --prefix apps/operator-console`

Toda tarea que toque frontend, auth, runtime o integración debe considerar también la validación real de despliegue:

- `docker compose up --build`

Si el cambio compila pero falla en runtime, la tarea NO está terminada.

## 18. Regla de Limpieza Final
Antes de finalizar cualquier tarea, el agente debe:
- eliminar variables no usadas
- eliminar imports no usados
- eliminar handlers duplicados
- eliminar estado parcial o no integrado
- verificar que no existan errores TS6133, TS2451 ni loops de render React

## 19. Validación de Tests en CI
Toda tarea backend o full-stack que afecte runtime, API, gateway, auth, automatización o bootstrap DEBE pasar también:

- `npm run test`

No está permitido declarar una tarea terminada si typecheck/build pasan pero los tests fallan.