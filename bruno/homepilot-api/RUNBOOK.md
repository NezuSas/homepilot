# Ejecución profesional de la colección Bruno

## Requisitos

- Selecciona el entorno local `Local`; no uses `Local.example` para ejecutar.
- Guarda `sessionToken` en la pestaña **Secrets** del entorno. Nunca lo guardes en archivos versionados.
- Confirma que `baseUrl` apunta al servidor correcto antes de enviar solicitudes.

## Etiquetas de seguridad

| Etiqueta | Significado |
| --- | --- |
| `smoke` | Verificaciones seguras de conectividad y autenticación. |
| `read-only` | Solicitud que no cambia datos. |
| `mutant` | Solicitud que crea, modifica o elimina datos. |
| `physical` | Puede provocar una acción sobre un dispositivo. |
| `edge` | Depende de una integración o recurso Edge. |
| `admin` | Afecta configuración o usuarios administrativos. |

## Flujo recomendado

1. Ejecuta solo las solicitudes con etiqueta `smoke`: **Health**, **Setup status** y **Current user**.
2. Bruno validará automáticamente la respuesta de estas tres solicitudes.
3. Ejecuta las solicitudes `read-only` de forma selectiva para inspeccionar recursos reales.
4. Ejecuta cada `mutant`, `physical`, `edge` o `admin` de una en una, revisando URL, cuerpo y variables antes de pulsar **Send**.

No ejecutes toda la colección en bloque contra un entorno con dispositivos reales.

## CLI (opcional)

Si el equipo instala Bruno CLI deliberadamente, desde esta carpeta se puede ejecutar la suite segura:

```powershell
bru run --env Local --tags=smoke --bail
```

El comando no sustituye la revisión humana de las mutaciones. Conserva los secretos solo en el entorno local de Bruno o en el mecanismo seguro de CI.
