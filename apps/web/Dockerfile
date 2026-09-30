# syntax=docker/dockerfile:1
# ============================================================
#  apps/web — Next.js (App Router), production image
#
#  3 stage build tận dụng `output: 'standalone'` (next.config.js):
#    deps    — cài đủ dependencies (kể cả dev: typescript, tailwind...) để build
#    build   — next build -> .next/standalone đã tự trace & bundle sẵn
#              1 node_modules TỐI THIỂU (chỉ gói thực sự dùng lúc chạy runtime),
#              nên khác với apps/api, KHÔNG cần stage "prod-deps" cài lại riêng.
#    runner  — chỉ copy .next/standalone + .next/static + public — không có
#              source code, không devDependencies, không cache npm.
#
#  Build context PHẢI là thư mục gốc monorepo (docker-compose.yml: context: .),
#  vì cần package-lock.json gốc + packages/shared (workspace dùng chung).
# ============================================================

ARG NODE_VERSION=20-alpine

# ---- Stage 1: deps ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Chỉ copy manifest trước để cache layer `npm ci` — chỉ cài lại khi
# package.json/lock thật sự đổi, không phải mỗi lần đổi source code.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---- Stage 2: build ----
FROM deps AS build
WORKDIR /app

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# NEXT_PUBLIC_* được Next.js INLINE THẲNG vào JS bundle lúc `next build`,
# không phải đọc lúc chạy container — khác với biến server-side thường.
# Vì vậy PHẢI truyền qua --build-arg lúc build image (hoặc build.args
# trong docker-compose.yml), đặt ở "environment:" runtime KHÔNG có tác dụng.
#   docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.vn -f apps/web/Dockerfile .
ARG NEXT_PUBLIC_API_URL=https://rv.librasoft.vn
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Bản đồ GIS — chọn trong file apps/web/.env (NEXT_PUBLIC_MAP_PROVIDER = "leaflet" |
# "google", NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) — file được COPY vào cùng apps/web ở trên và
# `next build` tự đọc. Cố ý KHÔNG đặt mặc định và KHÔNG dùng ENV ở đây: ENV sẽ ghi đè file .env.
# Vẫn ghi đè tạm được khi cần: --build-arg NEXT_PUBLIC_MAP_PROVIDER=google ...
# (xem apps/web/src/components/HouseMap.tsx). Không có file lẫn build-arg → Leaflet.
ARG NEXT_PUBLIC_MAP_PROVIDER
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

WORKDIR /app/apps/web
RUN npm run build

# ---- Stage 3: runner ----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

# tini: PID 1 đúng chuẩn — reap zombie & forward SIGTERM/SIGINT cho graceful
# shutdown thay vì Node nhận trực tiếp không qua init nào.
RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV PORT=3000
# Bắt buộc 0.0.0.0 — mặc định standalone server có thể chỉ bind localhost,
# khiến container không nhận được traffic từ ngoài (từ reverse proxy/host).
ENV HOSTNAME=0.0.0.0

# node:alpine đã có sẵn user "node" (uid/gid 1000) — không chạy container bằng root.
# .next/standalone đã tự chứa node_modules RÚT GỌN (chỉ gói cần lúc chạy) +
# server.js — không cần copy package.json hay node_modules đầy đủ nữa.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

USER node

EXPOSE 3001

# Alpine (busybox) có sẵn wget — không cần cài thêm curl chỉ để healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/" > /dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
