# Multi-stage Dockerfile for NestJS backend

FROM node:20-alpine AS base
WORKDIR /app

# Install all dependencies (dev + prod) so we can rebuild / run migrations inside the running container without extra steps.
COPY package*.json ./
RUN npm ci

# Copy source and build once during image build
COPY . .
RUN npm run build

# Final stage (reuse same layer so dev tooling remains available for future on-container builds)
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy everything from build stage (includes node_modules, dist, and source for rebuilds)
COPY --from=base /app /app

# Remove potential cached env file
RUN rm -f .env || true

EXPOSE 3000
CMD ["node","dist/main.js"]
