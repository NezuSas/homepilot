# SPEC: Identidad de marca centralizada V1

**Estado:** Implementado
**Fecha:** 2026-10-12
**Dependencias:** `operator-console-v1.md`, `native-camera-local-integration-v1.md`

## Problema

El nombre del producto («HomePilot») estaba escrito a mano en unas 3.900 menciones repartidas por la consola, el backend, los scripts y la documentación. El nombre comercial no está disponible, así que habrá que cambiarlo, y hacerlo hoy exigiría buscar y reescribir texto en cientos de archivos, con el riesgo de olvidar alguno. Además la marca ya estaba mezclada: la pestaña del navegador decía «Nezu Home» y el resto «HomePilot».

## Alcance

- Un único archivo, `brand.json`, con el nombre del producto y el de la empresa.
- Todo texto que lee una persona (consola, asistente, errores de la API, mensajes de instalación y mantenimiento, título del navegador) toma el nombre de ese archivo.
- Una herramienta que cambia `brand.json` y reescribe el nombre en el README y las guías de `docs/`.
- Una comprobación automática que impida volver a escribir el nombre a mano.

Fuera de alcance: los servicios auxiliares en Python (el fabricante que el agente de Linux publica a Home Assistant y los títulos de la documentación de las APIs de voz), que no leen `brand.json` y se actualizan a mano; los identificadores técnicos (variables `HOMEPILOT_*`, nombres de contenedores e imágenes, `homepilot.db`, cabeceras HTTP, nombres de clases, dominios asignados, etiquetas de Docker) y las especificaciones y pruebas, que son registro histórico. Renombrarlos exige migrar instalaciones existentes y se trata aparte (`docs/brand-and-naming.md`). Tampoco cambia el logo ni los nombres de fuentes.

## Requisitos

- **REQ-01:** `brand.json` en la raíz define `productName` y `companyName`, y es la única fuente del nombre. La consola, el backend y los scripts lo leen sin copiarlo.
- **REQ-02:** Las traducciones usan `{{brand}}` y `{{company}}`, resueltos por `interpolation.defaultVariables` de i18next, de modo que ningún texto de `locales/*/common.json` contiene el nombre escrito a mano y ninguno muestra el marcador sin resolver.
- **REQ-03:** El título de la pestaña sale de `%BRAND_PRODUCT_NAME%` en `index.html`, sustituido por Vite al compilar. Pasa a ser el nombre del producto en lugar de «Nezu Home».
- **REQ-04:** El código del backend y de la consola usa `BRAND.productName` y `BRAND.companyName` para las frases que lee una persona: respuestas del asistente en ambos idiomas, errores de la API, mensajes de dominio, el nombre por defecto del hogar y los mensajes de arranque. `brand.json` se emite junto al código compilado y llega a la imagen de la API.
- **REQ-05:** Los scripts de instalación, mantenimiento y comprobación cargan `scripts/lib/brand.sh` y usan `$HP_BRAND` y `$HP_BRAND_COMPANY` en sus mensajes y textos de ayuda. La salida con el nombre por defecto es idéntica a la anterior. La herramienta de emparejamiento con la nube lee `brand.json`.
- **REQ-06:** `npm run check:brand`, incluido en `verify:ci`, falla si un archivo que lee una persona escribe el nombre actual o el histórico a mano. Permite identificadores (`HomePilotRequest`, `X-HomePilot-Bridge-Token`), etiquetas de registro (`[HomePilot]`), comentarios y pruebas.
- **REQ-07:** `node scripts/rename-brand.mjs --product "Nombre"` es una simulación por defecto; con `--apply` actualiza `brand.json` y el README y las guías de `docs/`, sin tocar identificadores técnicos, especificaciones ni código. Rechaza nombres vacíos, con comillas o de más de 60 caracteres.
- **REQ-08:** Con el nombre actual, la consola, el asistente y los scripts muestran exactamente los mismos textos que antes.

## Criterios de aceptación

- [x] **AC1:** `BrandIdentity.test.ts` comprueba que el backend lee `brand.json`, que un mensaje de dominio lleva el nombre, que `brand.sh` exporta ambos nombres y es idempotente y que la ayuda de un script muestra otro nombre al cambiarlo.
- [x] **AC2:** `i18n.brand.test.ts` comprueba que ningún texto muestra `{{brand}}` o `{{company}}` sin resolver, que el título de la aplicación es el nombre del producto y que los archivos de traducción no escriben el nombre a mano.
- [x] **AC3:** `BrandIdentity.test.ts` comprueba que la comprobación falla ante un nombre escrito a mano (actual o histórico), indica el archivo y la línea, y pasa con identificadores, etiquetas, comentarios y pruebas.
- [x] **AC4:** `BrandIdentity.test.ts` comprueba que la herramienta de cambio no escribe sin `--apply`, que con `--apply` cambia `brand.json` y la documentación sin tocar identificadores, enlaces ni especificaciones, y que rechaza argumentos inválidos.
- [x] **AC5:** La ayuda de `homepilot-maintenance.sh`, `install-edge-office.sh`, `configure-wol-devices.sh` y `check-pc-integration-readiness.sh` es idéntica a la anterior con el nombre por defecto.
- [x] **AC6:** La consola y el backend compilan, `dist/brand.json` existe y las pruebas existentes de la consola, del backend y de navegador siguen pasando.

## Estrategia de compatibilidad y reversión

Sin migraciones ni cambios de contrato. Con el nombre actual todo se ve igual. Revertir el código vuelve a escribir el nombre en cada texto. Cambiar el nombre exige reconstruir las imágenes; los datos y los identificadores técnicos no cambian.

## Evidencia

- `brand.json`, `apps/operator-console/src/brand.ts`, `packages/shared/config/brand.ts`, `scripts/lib/brand.sh`.
- `apps/operator-console/src/i18n.ts`, `vite.config.ts`, `index.html` y `locales/*/common.json`.
- `scripts/check-brand.mjs`, `scripts/rename-brand.mjs` y `docs/brand-and-naming.md`.
- Pruebas: `__tests__/BrandIdentity.test.ts` y `apps/operator-console/src/i18n.brand.test.ts`.
