# syntax=docker/dockerfile:1.7

# Stage 1: Build React app
FROM node:20 AS builder

WORKDIR /app

# Arguments for build-time injection
ARG VITE_API_URL
ARG VITE_HOME_CITY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_HOME_CITY=$VITE_HOME_CITY

COPY . .
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund --prefer-offline \
      --fetch-retries=5 \
      --fetch-retry-factor=2 \
      --fetch-retry-mintimeout=10000 \
      --fetch-retry-maxtimeout=120000

# Build the UI
RUN npm run build --workspace=apps/operator-console

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy custom nginx config
COPY docker/ui/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts
COPY --from=builder /app/apps/operator-console/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
