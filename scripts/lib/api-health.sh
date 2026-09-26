#!/usr/bin/env bash

# Query the API from its own network namespace. Linux appliances bind to the
# Docker host gateway; Docker Desktop keeps the existing wildcard bind.
homepilot_api_health_status() {
  docker exec homepilot-api sh -c '
    bind="${HOMEPILOT_API_BIND_HOST:-0.0.0.0}"
    if [ "$bind" = "0.0.0.0" ]; then bind=127.0.0.1; fi
    curl --silent --output /dev/null --write-out "%{http_code}" --max-time 10 "http://${bind}:${PORT:-3000}/health"
  '
}
