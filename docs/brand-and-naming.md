# Marca y nombre del producto

El nombre que ven las personas vive en **un solo archivo**: `brand.json`, en la raíz del repositorio.

```json
{
  "productName": "HomePilot",
  "companyName": "NEZU"
}
```

## Cambiar el nombre

1. Cambia el nombre y reescribe la documentación en un solo paso (primero sin `--apply`, que solo muestra qué cambiaría):

   ```bash
   node scripts/rename-brand.mjs --product "Nuevo nombre"
   node scripts/rename-brand.mjs --product "Nuevo nombre" --apply
   ```

   También puedes editar `productName` en `brand.json` a mano; la herramienta existe para el README y las guías de `docs/`.

2. Reconstruye las imágenes (`bash scripts/homepilot-maintenance.sh --deploy`) para que la consola y la API empiecen a usar el nombre nuevo.

3. Sustituye el logo y el ícono si cambian (ver «Lo que no cambia solo»).

## Qué cambia con el nombre

| Dónde | Cómo lee el nombre |
| :--- | :--- |
| Textos de la consola (menús, asistentes, mensajes) | `{{brand}}` y `{{company}}` en `locales/*/common.json` |
| Título de la pestaña del navegador | `%BRAND_PRODUCT_NAME%` en `index.html` |
| Código de la consola | `BRAND` de `apps/operator-console/src/brand.ts` |
| Respuestas del asistente, errores de la API, nombre del hogar por defecto | `BRAND` de `packages/shared/config/brand.ts` |
| Mensajes de instalación, mantenimiento y comprobación | `$HP_BRAND` y `$HP_BRAND_COMPANY` de `scripts/lib/brand.sh` |
| Mensaje del emparejamiento con la nube | `brand.json` leído por `scripts/claim-cloud-pairing.mjs` |
| README y guías de `docs/` | herramienta `scripts/rename-brand.mjs` |

## Qué no cambia solo

Estos identificadores técnicos **conservan** `homepilot` a propósito. Renombrarlos obliga a migrar instalaciones que ya funcionan (variables de entorno, contenedores, volúmenes, bases de datos y copias), así que son una fase aparte, con plan de migración y reversión.

| Identificador | Ejemplos |
| :--- | :--- |
| Variables de entorno | `HOMEPILOT_DB_PATH`, `HOMEPILOT_BACKUP_DIR`, `HOMEPILOT_DEV_BOOTSTRAP` |
| Contenedores, imágenes y proyecto de Compose | `homepilot-api`, `homepilot-ui`, `homepilot-homepilot-api`, proyecto `homepilot` |
| Etiquetas de Docker | `io.nezu.homepilot.managed`, `.service`, `.role`, `.revision` |
| Datos en disco | `homepilot.db`, carpeta `~/homepilot` |
| Cabeceras HTTP | `X-HomePilot-Bridge-Token`, `x-homepilot-integration-key` |
| Nombres de código y campos de API | `HomePilotRequest`, `executableInHomePilot`, paquete `homepilot-workspace` |
| Clases de estilos y eventos del navegador | `homepilot-flip-pair`, `homepilot:stop-home-conversation-speech` |
| Dominios asignados | `homepilot-<casa>.nezuecuador.com` |
| Etiquetas de registro | `[HomePilot]` en los mensajes de diagnóstico |
| Servicios auxiliares en Python (pendiente) | el fabricante «HomePilot» que el agente de Linux publica a Home Assistant y los títulos de la documentación de las APIs de voz (`services/stt-whisper`, `services/tts-piper`). No leen `brand.json`; al cambiar el nombre hay que actualizarlos a mano |

También quedan fuera: las especificaciones y pruebas (son registro histórico), el logo `logo.svg` (la «N» de NEZU, sin texto) y los nombres de fuentes.

## Cómo se mantiene

`npm run check:brand` forma parte de `npm run verify:ci` y falla si alguien escribe el nombre a mano en un texto que lee una persona (traducciones, mensajes de la API o del asistente, mensajes de los scripts). Permite los identificadores técnicos de arriba, los comentarios y las pruebas.

Al escribir un texto nuevo usa la variable que corresponde a su lugar, nunca el nombre.
