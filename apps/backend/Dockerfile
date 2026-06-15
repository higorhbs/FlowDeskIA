# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

FROM base AS builder
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY docker/monorepo/pnpm-lock.yaml docker/monorepo/pnpm-workspace.yaml docker/monorepo/package.json ./
COPY docker/monorepo/packages ./packages
COPY . /tmp/backend
RUN mkdir -p apps/backend \
    && cp -a /tmp/backend/. apps/backend/ \
    && rm -rf /tmp/backend

ENV NODE_OPTIONS="--max-old-space-size=768"

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @flowdesk/backend... \
    && pnpm --filter @flowdesk/backend run build:deps \
    && pnpm --filter @flowdesk/backend run build:whatsapp \
    && node --check apps/backend/src/index.js \
    && mkdir -p apps/backend/dist/lib \
    && cp apps/backend/src/lib/*.js apps/backend/dist/lib/ \
    && test -f apps/backend/dist/lib/log.js \
    && mkdir -p /prod/apps/backend /prod/packages /prod/node_modules \
    && cp -a node_modules/.pnpm /prod/node_modules/ \
    && cp -a packages/. /prod/packages/ \
    && cp -a apps/backend/package.json apps/backend/src apps/backend/dist /prod/apps/backend/ \
    && cp -a apps/backend/node_modules /prod/apps/backend/node_modules

FROM base AS runner
WORKDIR /app/apps/backend

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"
ENV PORT=9031
ENV HOST=0.0.0.0
ENV FFMPEG_PATH=/usr/bin/ffmpeg

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tini ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 flowdesk \
    && useradd --system --uid 1001 --gid flowdesk flowdesk \
    && mkdir -p /app/data \
    && chown flowdesk:flowdesk /app/data

COPY --from=builder --chown=flowdesk:flowdesk /prod/apps /app/apps
COPY --from=builder --chown=flowdesk:flowdesk /prod/packages /app/packages
COPY --from=builder --chown=flowdesk:flowdesk /prod/node_modules /app/node_modules

USER flowdesk
EXPOSE 9031

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/index.js"]
