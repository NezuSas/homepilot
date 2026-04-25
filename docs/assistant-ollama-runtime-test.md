# Prueba de Integración: Assistant con Ollama (Runtime)

Esta guía describe cómo verificar la correcta integración en tiempo de ejecución del LLM local (Ollama) con HomePilot Edge, incluyendo el comportamiento de fallback defensivo.

## Prerrequisitos

Tener [Ollama](https://ollama.com/) instalado en el host local (Windows/macOS/Linux) o dentro del entorno WSL.

### 1. Verificar Ollama
Asegúrate de que el servicio de Ollama esté ejecutándose y sea accesible:
```bash
curl http://localhost:11434/api/tags
```

### 2. Descargar el Modelo
HomePilot usa `phi3` por defecto. Descárgalo en Ollama si no lo tienes:
```bash
ollama pull phi3
```

## Entorno Docker

### 3. Levantar HomePilot con Ollama Habilitado
Desde la raíz del proyecto, arranca los servicios inyectando la variable de entorno `OLLAMA_ENABLED=true`.

Si usas bash/WSL:
```bash
OLLAMA_ENABLED=true docker compose up --build
```
> **Nota:** Verifica en los logs de inicialización del contenedor `homepilot-api` el mensaje:  
> `[Assistant] Ollama enabled: model=phi3, baseUrl=http://host.docker.internal:11434`

## Ejecución de Pruebas

### 4. Prueba desde la API (cURL)
Ejecuta un comando natural hacia la API de HomePilot (reemplaza `<TOKEN>` con tu token de sesión real de HomePilot):

```bash
curl -X POST http://localhost:3000/api/v1/assistant/preview \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"prende la luz de la sala"}'
```

### 5. Prueba desde la UI (Consola de Operador)
1. Abre [http://localhost](http://localhost) en tu navegador.
2. Navega a la vista **Asistente**.
3. En el Centro de Comandos, escribe instrucciones como:
   - "apaga las luces de la cocina"
   - "enciende todo"
   - "activa la escena de relajación"
4. Observa la ejecución.

## Validación del Fallback (Defensive Runtime)
HomePilot está diseñado con una arquitectura "Zero-Cloud / Local Edge" resiliente. 
Para comprobar la validación defensiva:

1. Apaga el servicio de Ollama en tu sistema o cambia `OLLAMA_BASE_URL` a un puerto cerrado.
2. Vuelve a ejecutar un comando desde la UI o cURL.
3. El comando **DEBE** ejecutarse correctamente utilizando el sistema determinístico de *fallback*. 
4. El usuario no verá errores extraños en la UI, solo se registrará una advertencia técnica en los logs del backend de `homepilot-api` indicando que el modelo LLM falló y se recurrió al sistema determinístico.
