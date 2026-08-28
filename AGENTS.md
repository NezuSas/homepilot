# HomePilot — guía local para agentes

HomePilot sigue [NEZU Engineering Standards](https://github.com/NezuSas/nezu-engineering-standards). Ese repositorio es la fuente de verdad para el flujo transversal, la seguridad, Git, releases y seguimiento. Este archivo solo añade reglas verificables y específicas de HomePilot.

## Propósito y límites

- HomePilot opera automatización residencial local, integraciones de dispositivos, consola de operador, asistentes y servicios Edge/Cloud.
- Datos y activos críticos: credenciales de integraciones, sesiones y RBAC, topología del hogar, estados de dispositivos, automatizaciones, registros de auditoría y flujos de control físico.
- Toda implementación funcional debe ser trazable a una spec de `specs/`, sus tareas y criterios de aceptación. Si falta una spec o no permite decidir con seguridad, detenerse y pedir aprobación para completarla antes de programar.
- Los cambios deben ser pequeños, explícitos y acotados; preservar los cambios ajenos y no introducir lógica de negocio no especificada.

## Roles aplicables

Los roles son responsabilidades que se activan según el cambio, no agentes permanentes:

- **Coordinador:** delimita alcance, spec aplicable, integración entre capas, riesgos, evidencia de validación y comunicación.
- **Seguridad/Arquitectura:** revisa amenazas, secretos, permisos, aislamiento entre hogares, RBAC, límites de confianza y compatibilidad arquitectónica.
- **UI/UX:** se activa para `apps/operator-console`; protege accesibilidad, coherencia del sistema visual, estados de carga y estabilidad de interacción.
- **QA y regresión:** conecta criterios de aceptación con pruebas TDD/BDD, ejecuta la matriz de calidad y documenta evidencia de no regresión.
- **Releases/DevOps:** revisa Git, CI, Docker, perfiles de ejecución, versionado, artefactos y reversión antes de recomendar publicar.
- **Documentación:** mantiene specs, tareas, matriz de cobertura, decisiones, guías operativas y referencias de componente coherentes con el código.
- **Especialista de integraciones Edge y dispositivos:** se activa para Home Assistant, cámaras, protocolos locales, agentes PC y control físico; protege la seguridad de comandos, resiliencia y la separación Edge/Cloud.

## Arquitectura y diseño

- Mantener las capas de interfaz, dominio, datos, red e infraestructura/seguridad separadas según `docs/architecture.md`; no acoplar Edge y Cloud directamente.
- Respetar puertos, inyección de dependencias y bounded contexts. No introducir dependencias concretas en handlers de dominio ni acceso directo a SQLite desde orquestadores.
- No registrar rutas de dominio en `ApiGateway.ts`; implementarlas mediante `RouteHandler`.
- En Fastify, los handlers que usan `reply.hijack()` escriben directamente en `reply.raw`; no usan `reply.send()` ni `reply.code()`. `parseBody<T>` conserva el contrato basado en `request.raw._fastifyParsedBody`.
- No modificar contratos de API, stores globales, flujos backend, migraciones ni formatos de persistencia sin autorización explícita y una estrategia de compatibilidad y reversión documentada.

## Seguridad y datos

- Nunca almacenar, registrar ni incluir en Issues, Projects, documentación o salida de herramientas secretos, tokens, claves, datos de clientes o URLs firmadas.
- Aplicar mínimo privilegio; validar autorización y pertenencia al hogar antes de leer, emitir o ejecutar comandos de dispositivos.
- Tratar integraciones, WebSocket, tráfico de red y recursos remotos como límites de confianza; validar entradas, contratos, timeouts y fallos explícitamente.
- Los cambios de autenticación, autorización, red, runtime, bootstrap o integraciones deben activar Seguridad/Arquitectura, QA y Releases/DevOps.

## Reglas de interfaz

- No crear stores globales nuevos sin autorización. Si store y UI usan tipos distintos, mapear localmente sin `any` ni castings que oculten errores.
- Los `useEffect` deben tener dependencias estables y primitivas cuando sea posible. No derivar arrays u objetos con referencia nueva dentro de selectores Zustand.
- Conservar datos existentes durante refresh; usar skeletons solo para la carga inicial y minimizar flicker y churn de spinners.
- No dejar imports, estados, handlers, efectos, variables o código comentado sin uso; evitar duplicación y bucles de render.

## Validaciones obligatorias

Ejecutar desde la raíz del repositorio las validaciones que correspondan al área tocada. Antes de recomendar publicación, ejecutar como mínimo todas las de la categoría aplicable:

| Alcance | Validaciones requeridas |
| --- | --- |
| Cualquier cambio de código o documentación gobernada por spec | `npm run check:spec-coverage`, `npm run check:bdd-traceability`, `npm run check:module-test-coverage` |
| Dominio, API, datos, red, seguridad, automatización o runtime | `npm run test`, `npm run typecheck`, `npm run build`, `npm run check:no-production-any`, `npm run check:architecture-boundaries`, `npm run check:tuya-policy`, `npm run check:docker-profiles` |
| Interfaz `apps/operator-console` | `npm run lint --prefix apps/operator-console`, `npm run typecheck`, `npm run build`, `npm run build --prefix apps/operator-console`, `npm run test:responsive` |
| Frontend, auth, runtime o integración desplegable | las validaciones anteriores aplicables y `docker compose up --build`; detener el entorno de validación de forma segura al finalizar |
| Candidato a publicación | `npm run verify:quality`, `npm run verify:release` en un entorno autorizado con credenciales protegidas, y revisar el workflow CI exitoso |

- No desactivar ni omitir controles para declarar una entrega válida. Si una validación no se puede ejecutar, informar la causa, el impacto y la evidencia alternativa; no afirmar que pasó.
- Antes de finalizar, revisar `git status`, limpiar artefactos temporales y confirmar que no quedan errores TS6133, TS2451 ni estados parciales.

## Seguimiento, Git y publicación

- Para trabajo trazable, crear una Issue real en `NezuSas/homepilot`, agregarla a **NEZU — Desarrollo y Releases** y completar Agente, Área, Prioridad y Versión objetivo. No usar tarjetas Draft.
- El flujo de estado es: `Pendiente → En desarrollo → QA → Esperando tu aprobación → Listo para release → Completado`.
- No ejecutar `commit`, `push`, release, deploy, cambios de producción ni cambios externos sin autorización explícita del usuario. No usar force push, reset destructivo ni borrado masivo.
- Los cambios de release requieren versión, notas, artefactos verificables, workflow exitoso y plan de reversión antes de solicitar autorización.
