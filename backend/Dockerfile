# Multi-stage Dockerfile for NestJS backend

FROM node:20-alpine AS deps
WORKDIR /app
# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build (will run prebuild script if defined)
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Copy only what we need
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Ensure no stale .env baked in
RUN rm -f .env || true
EXPOSE 3000
CMD ["node","dist/main.js"]
