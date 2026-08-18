# Assistant and Ollama Runtime Test

This guide verifies the local Ollama integration and its deterministic fallback
path in HomePilot Edge.

## Prerequisites

Ollama runs as the internal `homepilot-ollama` Docker service when enabled.

```bash
docker exec -it homepilot-api curl http://ollama:11434/api/tags
docker exec -it homepilot-ollama ollama pull phi3
```

## Start with Ollama Enabled

```bash
OLLAMA_ENABLED=true docker compose up --build
```

Confirm the API log records the configured model and `http://ollama:11434`
base URL.

## API Exercise

Use a valid HomePilot session token:

```bash
curl -X POST http://localhost:3000/api/v1/assistant/converse \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"turn on the living-room light"}'
```

## UI Exercise

1. Open the Operator Console.
2. Navigate to **Talk to my home**.
3. Send a scoped request such as turning off kitchen lights or activating a
   named scene.
4. Verify the confirmation and execution response.

## Fallback Exercise

1. Stop Ollama or point `OLLAMA_BASE_URL` at an unavailable port.
2. Repeat a supported command.
3. Verify that the deterministic assistant path continues to process the
   request safely.
4. Verify that the API logs a technical warning without exposing an internal
   failure to the user.