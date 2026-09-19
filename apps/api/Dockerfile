# syntax=docker/dockerfile:1
# ============================================================
#  apps/api — NestJS + Prisma, production image
#
#  4 stage build:
#    deps      — cài đủ dependencies (kể cả dev) để build được TypeScript
#    build     — biên dịch (nest build) + sinh Prisma Client
#    prod-deps — cài LẠI chỉ dependencies production (không devDependencies)
#    runner    — image chạy thật: chỉ dist/ + node_modules production + prisma/
#
#  Build context PHẢI là thư mục gốc monorepo (docker-compose.yml đã cấu hình
#  `context: .`), vì cần package-lock.json gốc + packages/shared (workspace
#  dùng chung). Không copy apps/web, apps/mobile vào image này.
# ============================================================

ARG NODE_VERSION=20-alpine

# ---- Stage 1: deps (đủ dependencies để build) ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Chỉ copy manifest trước để tận dụng cache layer — nếu package.json/lock
# không đổi thì Docker dùng lại layer `npm ci` đã cài, không cần cài lại.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---- Stage 2: build (biên dịch + Prisma Client) ----
FROM deps AS build
WORKDIR /app

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# ---- Stage 3: prod-deps (chỉ dependencies production, cài LẠI từ đầu) ----
# Tách riêng thay vì `npm prune` trên node_modules đã build: npm prune trên
# workspaces đôi khi bỏ sót/giữ sai gói do cách resolve hoisting — cài lại
# từ đầu với --omit=dev cho kết quả node_modules đúng và tối giản hơn.
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

# Sinh lại Prisma Client vào đúng node_modules production (không kéo theo
# devDependencies dùng để build). Cần "prisma" ở dependencies (không phải
# devDependencies) của apps/api/package.json để lệnh này và
# `prisma migrate deploy` lúc runtime chạy được trên image đã omit dev deps.
COPY apps/api/prisma ./apps/api/prisma
WORKDIR /app/apps/api
RUN npx prisma generate

# ---- Stage 4: runner (image chạy thật) ----
FROM node:${NODE_VERSION} AS runner

# openssl: Prisma query engine (Alpine/musl) cần libssl lúc runtime.
# tini: làm PID 1 đúng chuẩn — reap zombie process & forward SIGTERM/SIGINT
# cho graceful shutdown (NestJS enableShutdownHooks, đóng kết nối Postgres...).
RUN apk add --no-cache openssl tini

WORKDIR /app/apps/api
ENV NODE_ENV=production

# node:alpine đã có sẵn user "node" (uid/gid 1000) — không chạy container bằng root.
COPY --from=prod-deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=node:node /app/apps/api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./prisma
COPY --chown=node:node apps/api/package.json ./
COPY --chown=node:node apps/api/docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh \
    && mkdir -p ./uploads \
    && chown -R node:node ./uploads

USER node

EXPOSE 4002

# Alpine (busybox) có sẵn wget — không cần cài thêm curl chỉ để healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${API_PORT:-3001}/api/health" > /dev/null || exit 1

# tini là PID 1 thật sự; entrypoint script `exec node dist/main.js` ở bước
# cuối để Node thay thế tiến trình shell (nhận signal trực tiếp, không có
# tiến trình `sh` trung gian che khuất SIGTERM).
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
