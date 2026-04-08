# Stage 1: Build React app
FROM node:20-slim AS builder

WORKDIR /app

# Arguments for build-time injection
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
COPY apps/operator-console/package*.json ./apps/operator-console/
RUN npm install && cd apps/operator-console && npm install

COPY . .

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
