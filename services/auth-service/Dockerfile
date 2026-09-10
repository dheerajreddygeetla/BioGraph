FROM node:20-alpine AS builder

WORKDIR /build
COPY shared/ /build/shared/
COPY services/auth-service/ /build/auth-service/

WORKDIR /build/shared
RUN npm install --omit=dev

WORKDIR /build/auth-service
RUN npm install --omit=dev

FROM node:20-alpine

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /build/auth-service /app
COPY --from=builder --chown=nodejs:nodejs /build/shared /shared

RUN mkdir -p /app/node_modules/@biograph && \
    ln -s /shared /app/node_modules/@biograph/shared

USER nodejs

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]