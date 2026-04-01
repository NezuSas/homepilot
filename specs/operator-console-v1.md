# SPEC: HomePilot Operator Console V1

**Estado:** Borrador  
**Autor:** Antigravity (IA Architect)  
**Fecha:** 2026-04-01  

## 1. Declaración del Problema (Problem Statement)
HomePilot ya tiene implementado y operando de manera validada todo su core backend local: Topología (homes, rooms), Dispositivos (discovery, inbox, asignación, ejecución de comandos, state sync), Reglas de Automatización V1 y Persistencia Durable con SQLite. Sin embargo, el sistema carece actualmente de cualquier interfaz visual (UI). Sin una UI, los desarrolladores, operadores técnicos y/o instaladores no pueden inspeccionar el estado en tiempo real del sistema, operar dispositivos directamente, examinar el log de auditorías ni habilitar/deshabilitar las automatizaciones sin usar llamadas a API o consultas SQL manuales.

## 2. Alcance (Scope)
Definir una interfaz de usuario Web Local V1 orientada netamente a un **operador, instalador técnico o propósitos de debugging**. El alcance incluye:
- **Vista de Homes / Rooms:** Navegación básica sobre la topología persistida.
- **Vista de Devices:**
  - Visualización del Inbox (dispositivos descubiertos no asignados).
  - Visualización de dispositivos asignados por habitación.
  - Visualización del estado actual (`lastKnownState`).
  - Inspección de metadatos visibles (capabilities, vendor, type, status).
- **Vista de Automation Rules:**
  - Listado general de las reglas cargadas en el sistema.
  - Estado visible de enabled / disabled.
  - Detalle técnico expuesto del trigger y la action configurados.
- **Vista de Activity Log:**
  - Historial de eventos filtrado por dispositivo.
  - Visualización de eventos recientes en orden cronológico inverso (LIFO).
- **Acciones Mínimas Operativas:**
  - "Assign Device" (trasladar del Inbox a una habitación).
  - "Execute Command" (disparar un comando manual básico V1).
  - "Enable / Disable Rule" (alternar el encendido/apagado de una regla).

## 3. Fuera de Alcance (Out of Scope)
Quedan estrictamente excluidos de esta iteración:
- Un diseño "premium" pulido o estética para cliente/usuario final masivo.
- Desarrollo de aplicación móvil nativa (Mobile App).
- Autenticación real o control multiusuario complejo (RBAC).
- Paneles o Dashboards con analytics avanzados.
- Soporte para "Escenas" complejas compuestas.
- Creador visual de automatizaciones drag-and-drop.
- Branding final comercial.
- Sincronización de interfaz hacia entornos Cloud.

## 4. Requisitos Funcionales (Functional Requirements)
- **REQ-01**: El operador debe poder visualizar la lista de hogares y navegar por sus habitaciones en forma de solo lectura.
- **REQ-02**: El operador debe poder consultar la lista "Inbox" con todos los dispositivos con estado `PENDING`.
- **REQ-03**: El operador debe poder asignar un dispositivo PENDING a una habitación válida.
- **REQ-04**: El operador debe ver los dispositivos asignados y despachar comandos operacionales (ej: encender, apagar) para validar que la capa Execution funciona.
- **REQ-05**: El operador debe poder ver la configuración técnica (trigger/action) de todas las automatizaciones existentes, y cambiar rápidamente su atributo `enabled`.
- **REQ-06**: El operador debe disponer de una consola temporal o feed para inspeccionar el Activity Log de los nodos seleccionados.

## 5. Requisitos No Funcionales (Non-Functional Requirements)
- **NFR-01 (Local-First)**: La interfaz Web debe ser servida de manera local por la propia miniPC al estar en la misma red de área local (LAN).
- **NFR-02 (Validación de Backend)**: El frontend debe consumir exactamente las mismas operaciones documentadas en el backend (zero bypass); el Frontend oficia de "test de validación visual" del servicio construido.
- **NFR-03 (Pragmatismo UI)**: Priorizar visibilidad técnica y operación rápida. Diseños tabulares simples y coherentes son preferibles a estéticas caprichosas o animaciones pesadas.

## 6. Navegación / Pantallas Principales
Se proyecta un diseño de consola clásica (Sidebar izquierdo + Main View):
1. **Página "Topology" (Home/Rooms View)**: Lista de la jerarquía física actual instalada.
2. **Página "Network & Inbox"**: Visor enfocado en dispositivos no provisionados, con su identificador de red para asignarlos rápidamente.
3. **Página "Device Manager"**: Grilla de nodos operando actualmente, exponiendo el último estado sincronizado y botones directos de test (Ej: `[ON]`, `[OFF]`).
4. **Página "Automations Workbench"**: Lista plana con toggle switches para pausar/reanudar lógica Edge y ver el mapping (Trigger -> Action).
5. **Página "Audit Logs"**: Visor crudo estilo terminal/tabla filtrable del Activity Log.

## 7. Modelo Conceptual de UI
Se propone una consola de administración pragmática:
- **Layout**: Barra de navegación lateral persistente, encabezado indicando el ambiente local y panel central para el volcado de datos.
- **Componentes**: Tablas simples de datos, tarjetas (cards) resumidas para entidades y diálogos rápidos/modales para acciones de estado (Ej: un `<select>` para "Assign Room").
- **Estilo**: Uso de vanilla CSS nativo o un framework sobrio integrado para maximizar compatibilidad y agilizar el armado sin sobrediseñar.

## 8. Criterios de Aceptación (Acceptance Criteria)
- [ ] AC1: Es posible compilar y levantar la interfaz Operator Console junto (o adyacente) al proceso backend actual de HomePilot.
- [ ] AC2: Un dispositivo ubicado en el Inbox puede ser seleccionado y asignado a una Room existente, removiéndose de la vista Inbox de inmediato.
- [ ] AC3: El switch de Enabled/Disabled de una Regla cambia su base de datos local visiblemente (reflejado de persistencia).
- [ ] AC4: Al encender una luz desde "Device Manager", el Activity Log plasma el evento `COMMAND_DISPATCHED`.

## 9. Notas Técnicas y Arquitectura
- El backend actual debe exponer (si no lo hace aún) los endpoints mínimos para soportar estas vistas (ej. REST V1 `GET /api/devices/inbox`, `POST /api/devices/{id}/assign`, etc.).
- Como el frontend es meramente una consola Edge Operator, se asumirá una entrega estática (Static Bundle) servida directamente por el backend de HomePilot o un puerto contiguo.
- Se fomentará el uso de tecnologías que respeten las exigencias del proyecto: tipado estricto (TypeScript) en el frontend, y coherencia arquitectónica entre el modelo de llamadas locales.

## 10. Preguntas Abiertas / TODOs
- TODO: ¿Se utilizará un framework JS como Next.js/Vite en modo estático para este cliente, o se armará de forma nativa mínima para ahorrar dependencias en el binario Edge?
- TODO: ¿Será necesario implementar Polling, SSE (Server-Sent Events) o WebSockets iniciales para el refreso en tiempo real de los estados o bastará con F5 (recarga natural) para esta V1?
- TODO: ¿Las credenciales estáticas de "Admin Local" estarán hardcodeadas en una constante de entorno para el acceso Edge o se entra ciegamente sin barreras?
