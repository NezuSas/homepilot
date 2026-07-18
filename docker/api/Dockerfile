# syntax=docker/dockerfile:1.7

# Stage 1: Build
FROM node:20 AS builder

WORKDIR /app

# Use the lockfile and retain the npm download cache between Docker builds.
# Retry transient registry failures (for example ECONNRESET on an Edge MiniPC).
COPY . .
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund --prefer-offline \
      --fetch-retries=5 \
      --fetch-retry-factor=2 \
      --fetch-retry-mintimeout=10000 \
      --fetch-retry-maxtimeout=120000
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-slim

WORKDIR /app

# Install curl for healthchecks and ffmpeg for native camera HLS transcoding
RUN apt-get update && apt-get install -y curl ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy build artifacts and production-only dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
# (Note: In a more complex setup, we would run 'npm prune --production' here, 
# but copying all for now to ensure workspace complexity doesn't break)

ENV NODE_ENV=production
ENV HOMEPILOT_DB_PATH=/app/data/homepilot.db
ENV PORT=3000

EXPOSE 3000

# Directory for persistent data
RUN mkdir -p /app/data

# Start using the compiled entrypoint
CMD ["node", "dist/main.js"]
