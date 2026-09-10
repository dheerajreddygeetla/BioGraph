# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /build

# Copy shared library
COPY shared/ /build/shared/

# Copy service
COPY services/api-gateway/ /build/api-gateway/

# Install shared deps
WORKDIR /build/shared
RUN npm install --omit=dev

# Install service deps (with file: reference to /build/shared)
WORKDIR /build/api-gateway
RUN npm install --omit=dev

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM node:20-alpine

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy only what's needed
COPY --from=builder --chown=nodejs:nodejs /build/api-gateway /app
COPY --from=builder --chown=nodejs:nodejs /build/shared /shared

# Node needs to resolve @biograph/shared from ../../shared (relative to /app)
# Symlink /shared into node_modules
RUN mkdir -p /app/node_modules/@biograph && \
    ln -s /shared /app/node_modules/@biograph/shared

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]