# SPEC: SDD and SOLID Modular Remediation V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-11

## Problema

La cobertura SDD existente valida referencias por patrón, pero no asegura que la evidencia de una PR corresponda a criterios de aceptación reales. Además, algunos orquestadores y rutas conservan dependencias concretas, tipado `any` y responsabilidades acumuladas.

## Requisitos

- **REQ-01:** Toda PR funcional debe referenciar una spec existente, en estado Aprobado o Implementado, y criterios AC-## declarados en esa spec.
- **REQ-02:** La comprobación de cobertura debe fallar cuando una spec primaria configurada sea inválida.
- **REQ-03:** Las rutas deben recibir servicios de infraestructura por inyección desde el composition root.
- **REQ-04:** Los orquestadores de Assistant y UI deben delegar responsabilidades a colaboradores explícitos y testeables.
- **REQ-05:** El código de producción no debe usar `any`; los cuerpos HTTP se validan como `unknown` antes de usar contratos de dominio.

## Criterios de aceptación

- [x] AC1: CI rechaza evidencia que apunte a una spec inexistente, borrador o a AC no declarado.
- [x] AC2: El chequeo de cobertura falla ante una spec primaria inválida.
- [x] AC3: `AuthRoutes`, `DashboardRoutes` y `SceneRoutes` reciben o consumen servicios compuestos sin instanciar `MediaService` ni `SceneExecutionService` directamente. Evidencia: `npm run check:architecture-boundaries`.
- [x] AC4: AssistantConversationService recibe el resolvedor fast-path por dependencia explícita.
- [x] AC5: Las rutas de automatización y dispositivos afectadas no declaran `any` en producción.
- [x] AC6: Una regla que varias capas necesitan vive en un solo lugar, y el código superado se retira. La validación de usuarios compartidos de una rutina es un método `protected` de `ApiRoutes`, no una copia privada en `AutomationRoutes` y otra en `SceneRoutes`: era una comprobación de autorización duplicada, donde endurecer una copia dejaba la otra atrás. `asRecord` —la lectura defensiva de un estado de dispositivo desconocido— se declara una vez en `packages/shared/domain/utils/asRecord.ts` y la consumen las rutas de media player, el estado de dominio y los formateadores del asistente; `resolveEdgeTimeout` —el suelo mínimo de un tiempo de espera leído del entorno— una vez en `packages/assistant/application/resolveEdgeTimeout.ts` para voz a texto y texto a voz. `isSingularLightRequest` se elimina de `fastPathMatching`: `isRoomSingularLightFastPath`, en el mismo archivo, lo sustituyó al devolver la estancia además del comando, y era el único que el router usaba. Sin cambio de comportamiento: 2015/2015 pruebas de asistente, API, dispositivos y shared PASS.

## Fuera de alcance

- Reescribir retrospectivamente cada spec histórica.
- Cambiar contratos HTTP públicos o comportamiento de negocio.
- Refactorizar módulos no relacionados.