FROM node:20-alpine AS builder

# Install build tools for native modules (sharp needs them)
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /build
COPY shared/ /build/shared/
COPY services/research-service/ /build/research-service/

WORKDIR /build/shared
RUN npm install --omit=dev

WORKDIR /build/research-service
RUN npm install --omit=dev

FROM node:20-alpine

# Runtime deps for sharp
RUN apk add --no-cache vips

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /build/research-service /app
COPY --from=builder --chown=nodejs:nodejs /build/shared /shared

RUN mkdir -p /app/node_modules/@biograph && \
    ln -s /shared /app/node_modules/@biograph/shared

# Cache dir for Hugging Face models (mounted as volume)
RUN mkdir -p /home/nodejs/.cache/huggingface && \
    chown -R nodejs:nodejs /home/nodejs/.cache

ENV HF_HOME=/home/nodejs/.cache/huggingface
ENV TRANSFORMERS_CACHE=/home/nodejs/.cache/huggingface

USER nodejs

EXPOSE 5004

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5004/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]