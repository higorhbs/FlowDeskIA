# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

FROM base AS builder
WORKDIR /app

COPY docker/monorepo/pnpm-lock.yaml docker/monorepo/pnpm-workspace.yaml docker/monorepo/package.json ./
COPY docker/monorepo/packages ./packages
COPY . /tmp/backend
RUN mkdir -p apps/backend \
    && cp -a /tmp/backend/. apps/backend/ \
    && rm -rf apps/backend/docker/monorepo /tmp/backend

ENV NODE_OPTIONS="--max-old-space-size=768"

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @flowdesk/backend...

RUN pnpm --filter @flowdesk/backend build
RUN pnpm deploy --filter=@flowdesk/backend --prod /prod/backend

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"
ENV PORT=3001

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 flowdesk \
    && useradd --system --uid 1001 --gid flowdesk flowdesk \
    && mkdir -p /app/data \
    && chown flowdesk:flowdesk /app/data

COPY --from=builder --chown=flowdesk:flowdesk /prod/backend ./

USER flowdesk
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/index.js"]
