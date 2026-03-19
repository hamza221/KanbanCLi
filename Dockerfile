# ── Build stage ──────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copy workspace root files needed for npm install
COPY package.json package-lock.json ./

# Copy workspace package.json files (needed for npm workspace resolution)
COPY cli/package.json cli/package.json
COPY web/package.json web/package.json
COPY server/package.json server/package.json

# Install all dependencies (including devDependencies for the build step)
RUN npm ci

# Copy source code
COPY cli/ cli/
COPY web/ web/
COPY server/ server/

# Build the Vue SPA
RUN npm run build

# ── Production stage ────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY cli/package.json cli/package.json
COPY web/package.json web/package.json
COPY server/package.json server/package.json

# Install production dependencies only
RUN npm ci --omit=dev

# Copy server source
COPY server/ server/

# Copy CLI source (for running CLI commands inside the container)
COPY cli/ cli/

# Copy built SPA from the build stage
COPY --from=build /app/web/dist/ web/dist/

# Create boards directory and ensure writable
RUN mkdir -p boards && chown -R node:node boards

# Run as non-root user
USER node

EXPOSE 3000

CMD ["node", "server/src/index.js"]
