# Multi-stage Dockerfile for NestJS backend

FROM node:20-alpine AS deps
WORKDIR /app
# Install ALL dependencies (including dev) required to build
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Install only production dependencies in separate stage
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
# Ensure no stale .env baked in
RUN rm -f .env || true
EXPOSE 3000
CMD ["node","dist/main.js"]
