# SPEC: Directorio Central de Cuentas y Casas (Multi-Home Account Directory) V1

**Estado:** Aprobado
**Autor:** Claude (análisis solicitado por Oscar)
**Fecha:** 2026-08-14

## 1. Declaración del Problema

Cada instalación HomePilot Edge (miniPC) opera como una casa físicamente aislada, con su propia base de usuarios, roles y Home Assistant — invariante que `single-home-shared-access-v1.md` fija deliberadamente ("una instalación debe contener cero o un hogar"). Un mismo usuario (p. ej. Oscar) puede ser dueño o miembro de varias casas físicas (Casa Oscar, Oficina Nezu), cada una con su propio Edge expuesto por un hostname de Cloudflare Tunnel independiente (`homepilot-public-ingress-v1.md`). Hoy no existe ninguna capa que permita a ese usuario ver, desde una sola sesión, la lista de casas a las que pertenece y cambiar entre ellas: debe recordar y visitar manualmente cada hostname y volver a iniciar sesión en cada uno por separado.

## 2. Alcance

- Un servicio central nuevo, el **Directorio**, separado de cada Edge, que registra: cuentas de usuario, casas (nombre + hostname del Edge) y membresías (qué cuenta ve qué casa).
- Un selector de casa en la interfaz que, tras iniciar sesión en el Directorio, lista las casas del usuario y, al elegir una, navega al hostname de ese Edge.
- Un flujo de invitación por casa: el propietario de una casa invita a otra cuenta por correo/usuario; la cuenta invitada, al aceptar, ve esa casa en su selector.
- Alta manual de un Edge en el Directorio (nombre + hostname + cuenta propietaria) como paso de aprovisionamiento, no automatizado en esta v1.

## 3. Fuera de Alcance

- Cualquier cambio al modelo interno de cada Edge: `User`, `AuthGuard`, roles operativos (`admin/parent/child/guest/operator`), `HomeRepository`, `SingleHomeInstallationError`. El invariante "un Edge = una casa" de `single-home-shared-access-v1.md` se mantiene intacto y **no se toca**.
- Single Sign-On (SSO) o federación de credenciales entre el Directorio y los Edges. En esta v1 el Directorio no conoce ni gestiona contraseñas de ningún Edge; el usuario se autentica en el Directorio con una identidad propia y, por separado, ya tiene (o crea) una cuenta local en cada Edge al que accede. El Directorio solo dirige el navegador al hostname correcto.
- Sincronización de datos, dispositivos, cámaras, escenas o eventos entre casas.
- Cualquier forma de runtime o base de datos compartida entre dos casas físicas.
- Límite arbitrario de número de casas por cuenta (Google Home usa 5; no hay razón técnica propia para copiar ese número en v1).
- Fijado de kiosko a una sola casa (se deja como pregunta abierta, sección 8, para no bloquear esta spec).

## 4. Requisitos Funcionales

- **REQ-01:** El Directorio debe permitir crear una cuenta (identidad global: email, nombre, contraseña) independiente de cualquier Edge.
- **REQ-02:** El Directorio debe permitir registrar una casa con nombre visible, hostname/URL pública del Edge y la cuenta que la registra, quedando esa cuenta como `owner`.
- **REQ-03:** El propietario de una casa debe poder invitar a otra cuenta del Directorio a esa casa; la invitación queda en estado `pending` hasta ser aceptada o rechazada por la cuenta invitada.
- **REQ-04:** Una cuenta debe poder listar únicamente las casas donde tiene una membresía en estado `active` (`owner` o `member`); nunca debe poder listar u obtener metadatos de casas ajenas.
- **REQ-05:** Al seleccionar una casa en el selector, la interfaz debe navegar al hostname de esa casa; si no hay sesión local iniciada en ese Edge, debe mostrarse el login normal de ese Edge, sin ningún intento de autenticación automática o bypass de `AuthGuard`.
- **REQ-06:** El propietario de una casa debe poder revocar la membresía de otra cuenta; tras revocarla, esa cuenta deja de ver la casa en su selector en la siguiente consulta.
- **REQ-07:** El propietario debe poder eliminar el registro de una casa del Directorio; esto no borra ni afecta ningún dato del Edge correspondiente, solo deja de listarla.
- **REQ-08:** El Directorio debe registrar quién y cuándo creó o modificó cada casa y cada membresía (auditoría mínima).

## 5. Requisitos No Funcionales

- **NFR-01:** El Directorio no debe ser una dependencia dura para el control local de una casa: si el Directorio está caído, un usuario que ya conoce el hostname de su Edge y tiene sesión local activa debe poder seguir operando esa casa sin el Directorio.
- **NFR-02:** El Directorio no debe almacenar credenciales, tokens ni datos de dispositivos/cámaras de ningún Edge; solo identidad de cuenta y metadatos de casa (nombre, hostname, membresías).
- **NFR-03:** Las invitaciones deben expresarse mediante un token no adivinable, con expiración configurable.
- **NFR-04:** El hostname de una casa debe poder actualizarse (p. ej. al rotar el túnel de Cloudflare) sin perder membresías ni historial de auditoría.
- **NFR-05:** El Directorio debe correr como servicio independiente del código de cada Edge, sin acoplarse a su base de datos SQLite local.

## 6. Criterios de Aceptación

- [ ] AC1: Un usuario nuevo puede crear una cuenta en el Directorio sin tener ya acceso a ningún Edge.
- [ ] AC2: Un usuario puede registrar su primera casa indicando nombre y hostname; queda como propietario.
- [ ] AC3: El propietario de "Casa Oscar" puede invitar a otra cuenta a "Oficina Nezu"; esa cuenta, tras aceptar, ve ambas casas en su selector.
- [ ] AC4: Un usuario sin membresía en una casa no puede verla ni obtener su información desde el Directorio, ni siquiera conociendo su `homeId`.
- [ ] AC5: Al elegir una casa en el selector, la app navega al hostname correcto y ese Edge sigue exigiendo su propio login, sin bypass de `AuthGuard`.
- [ ] AC6: Revocar una membresía hace que la casa desaparezca del selector de esa cuenta en la siguiente carga.
- [ ] AC7: Con el Directorio apagado, un usuario con sesión local vigente sigue controlando su casa entrando directamente por su hostname.
- [ ] AC8: Eliminar el registro de una casa del Directorio no modifica ni borra ningún dato dentro del Edge correspondiente.

## 7. Notas Técnicas y Arquitectura

Modelo de datos propuesto (base de datos propia del Directorio, separada de cada Edge):

```typescript
interface DirectoryAccount {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

interface DirectoryHome {
  id: string;
  name: string;
  edgeHostname: string; // p.ej. https://homepilot-oscar.nezuecuador.com
  ownerAccountId: string;
  createdAt: string;
  updatedAt: string;
}

interface DirectoryHomeMembership {
  id: string;
  homeId: string;
  accountId: string;
  role: 'owner' | 'member';
  status: 'pending' | 'active' | 'revoked';
  invitedByAccountId: string;
  createdAt: string;
  updatedAt: string;
}
```

- El Directorio es un servicio HTTP + base de datos propia, minimalista, desacoplado del código de cada Edge (podría alojarse en infraestructura Nezu o en una miniPC designada; ver pregunta abierta en sección 8).
- Contrato entre Directorio y Edge en esta v1: **ninguno obligatorio**. El Directorio solo entrega `{ homeId, name, edgeHostname }` al frontend; el navegador navega a `edgeHostname` y desde ahí el Edge opera exactamente como hoy, con su propio `AuthGuard`.
- El "rol" descrito en el análisis previo (Propietario / Administrador / Miembro / Invitado) se resuelve en **dos capas distintas que no deben confundirse**:
  - **Rol de membresía en el Directorio** (`owner`/`member`, este documento): solo controla quién puede invitar, revocar acceso o administrar el registro de la casa en el Directorio.
  - **Rol operativo dentro del Edge** (`admin/parent/child/guest/operator`, ya existente en `packages/auth/domain/User.ts` y `AuthGuard.ts`): sigue decidiendo qué puede hacer esa persona dentro de esa casa — dispositivos, cámaras, automatizaciones. No cambia con esta spec.
- Fase futura explícitamente fuera de alcance: si más adelante se decide unificar el login (SSO), se podría añadir un token de "vinculación" que el Edge acepte del Directorio para crear o actualizar automáticamente la cuenta local de un usuario invitado. Eso requeriría su propia spec de seguridad y no debe implementarse como parte de esta v1.

## 8. Decisiones Tomadas y Preguntas Abiertas

### 8.1 Decisiones tomadas (ver justificación completa en la conversación de origen)

- **Alojamiento del Directorio:** servicio cloud gestionado por Nezu (no una miniPC "maestra"). Cada Edge ya tolera la caída del Directorio (NFR-01); una miniPC maestra sería un punto único de falla físico y necesitaría su propia exposición pública sin aportar disponibilidad real. Un servicio cloud pequeño (API + base de datos gestionada) es más simple de mantener y actualizar para todos los clientes de Nezu a la vez.
- **Autenticación del Directorio:** email/contraseña propios (hash con bcrypt o equivalente), sin proveedor externo en esta v1. Mantiene control total y no depende de configurar OAuth de terceros; no cierra la puerta a añadir un proveedor externo más adelante como capa adicional.
- **Ubicación del selector de casa:** landing/app propia, separada de `operator-console`. Cada `operator-console` se compila con origen fijo a un solo Edge (`homepilot-public-ingress-v1.md`); acoplar el selector allí mezclaría dos modelos de sesión (Directorio vs. Edge) y obligaría a llamadas cross-origin innecesarias. La landing solo maneja login del Directorio y navega (`window.location.assign`) al hostname elegido.

### 8.2 Preguntas abiertas (no bloquean el inicio de la Capa 1 de `tasks.md`)

- TODO: Política de kiosko — cómo fijar una pantalla pública a una sola casa sin exponer el selector (config local del kiosko vs. cuenta dedicada sin otras membresías). Se resolverá en una spec posterior; una pantalla kiosko puede seguir apuntando directo al hostname de su Edge sin pasar por el Directorio mientras tanto.
- TODO: Proveedor concreto de hosting/DB para el servicio cloud del Directorio (elección de infraestructura, no de arquitectura) — se decide al aprovisionar, no afecta el contrato de esta spec.
