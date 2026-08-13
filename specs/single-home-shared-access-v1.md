# SPEC: Single-Home Shared Access V1

**Estado:** Implementado
**Fecha:** 2026-08-13

## Objetivo

HomePilot Edge representa una única instalación física: una miniPC controla un hogar local. Todas las cuentas autenticadas y activas de esa instalación comparten ese hogar; su rol decide las capacidades administrativas, no la visibilidad ni el control básico de los dispositivos del hogar.

## Alcance

- Una instalación debe contener cero o un hogar. Cero es válido solamente antes del onboarding.
- `HomeRepository.findHomesByUserId` devuelve el hogar único de la instalación a cualquier sesión autenticada. Si detecta más de uno, falla de manera explícita y no entrega datos.
- Las validaciones llamadas históricamente `validateHomeOwnership` verifican que el hogar solicitado sea el único hogar local. La identidad activa ya fue validada por `AuthGuard` en el perímetro HTTP.
- Las rutas administrativas mantienen su guardia de rol `admin`; los roles no administrativos no obtienen permisos para crear, editar o eliminar topología, dispositivos, escenas o rutinas.
- La API rechaza crear un segundo hogar en la misma instalación.
- La vista de topología no expone una acción para crear hogares adicionales; el alta inicial permanece disponible únicamente para el aprovisionamiento de una instalación vacía.

## Fuera de alcance

- Multi-sede o multi-cliente en una misma miniPC.
- Membresías por hogar y asignaciones de permisos por estancia o dispositivo. Esas capacidades sólo aplicarán si HomePilot incorpora gateways múltiples en una futura arquitectura.

## Criterios de aceptación

- [x] AC1: una cuenta activa `parent`, `child`, `guest`, `operator` o `admin` puede resolver el hogar único y controlar un dispositivo existente de la instalación.
- [x] AC2: una cuenta inactiva no llega al control de dispositivos: `AuthGuard` la rechaza.
- [x] AC3: crear un segundo hogar en una instalación con uno existente devuelve `409`.
- [x] AC4: si la base contiene más de un hogar, las operaciones de hogar compartido fallan cerradas con un error explícito; no se mezclan hogares.
- [x] AC5: las acciones de administración de topología, dispositivos, escenas y automatizaciones continúan exigiendo el rol `admin`.
- [x] AC6: con un hogar existente, la interfaz no muestra un campo ni una acción para crear otro hogar.

## Notas de seguridad

El aislamiento entre clientes se realiza por instalación Edge (una base SQLite y una miniPC por cliente), no por `owner_id` dentro de una instalación. El `owner_id` se conserva como procedencia del alta y compatibilidad de datos; no es una ACL de uso cotidiano.