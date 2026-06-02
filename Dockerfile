# ============================================================
# WebExcels DRM — Multi-stage Production Dockerfile
# ============================================================

# ── Stage 1: Builder ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN npm run build


# ── Stage 2: Production Runtime ──────────────────────────────
FROM node:20-alpine AS production

LABEL maintainer="Excels-Tech DevOps <devops@excels-tech.com>"
LABEL description="WebExcels DRM — CRM & Sales Management Platform"

WORKDIR /app

RUN apk add --no-cache tini curl

# Copy package.json and ALL node_modules from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy the compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Copy shared schema (required at runtime by drizzle ORM)
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/src/db ./src/db

# Copy migration files
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy server config files
COPY --from=builder /app/tsconfig.json ./tsconfig.json

ENV NODE_ENV=production
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "dist/index.js"]
